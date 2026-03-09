import { app } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

const MAX_RETRIES = 5;

function calculateBackoffSeconds(attempt: number): number {
  const base = Math.pow(2, Math.min(5, attempt));
  const jitter = 0.5 + Math.random();
  return Math.min(300, Math.max(30, base * jitter));
}

function extractErrorDetails(err: any): {
  statusMessage: string;
  details?: string;
} | null {
  if (err && typeof err === "object") {
    if (typeof err.statusMessage === "string") {
      return {
        statusMessage: err.statusMessage,
        details: typeof err.message === "string" ? err.message : undefined,
      };
    }
    if (typeof err.message === "string") {
      return { statusMessage: err.message };
    }
  }

  if (typeof err === "string") {
    try {
      const parsed = JSON.parse(err);
      if (typeof parsed.statusMessage === "string") {
        return {
          statusMessage: parsed.statusMessage,
          details:
            typeof parsed.message === "string" ? parsed.message : undefined,
        };
      }
    } catch {
      return { statusMessage: err };
    }
  }

  return null;
}

async function enqueueRetry(
  jobId: string,
  retryCount: number,
  originalMessage: Record<string, any>
): Promise<void> {
  const queueName = process.env["AUDIO_JOBS_QUEUE"] ?? "audio-queue";
  const connectionString = requireEnv("AzureWebJobsStorage");
  const queue = new QueueClient(connectionString, queueName);
  await queue.createIfNotExists();

  const backoffSec = calculateBackoffSeconds(retryCount);

  const retryMessage = {
    ...originalMessage,
    retryCount: retryCount + 1,
    lastError: `Retry scheduled at attempt ${retryCount + 1}`,
  };

  const encoded = Buffer.from(JSON.stringify(retryMessage)).toString("base64");
  await queue.sendMessage(encoded, { visibilityTimeout: backoffSec });

  console.log(
    `Scheduled retry for ${jobId}: in ${Math.round(backoffSec)}s — attempt ${retryCount + 1}`
  );
}

async function processJob(
  message: Record<string, any>,
  context: any
): Promise<void> {
  const jobId = message.recordingId ?? message.jobId ?? "unknown";

  context.log(`[AudioJobWorker] Processing job: ${jobId}`);

  const baseUrl = process.env["AZURE_FUNCTION_BASE_URL"]?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("Missing AZURE_FUNCTION_BASE_URL");
  }

  if (message.type === "stt" || message.recordingId) {
    const key = requireEnv("AZURE_STT_SUBMIT_KEY");
    const url = `${baseUrl}/api/stt-submit?code=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordingId: message.recordingId,
        audioExt: message.audioExt ?? "m4a",
        locale: message.locale ?? "en-US",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`stt-submit failed: ${res.status} ${text}`);
    }

    context.log(`[AudioJobWorker] STT submitted for ${jobId}`);
  }
}

app.storageQueue("audio-jobs-worker", {
  queueName: process.env["AUDIO_JOBS_QUEUE"] ?? "audio-queue",
  connection: "AzureWebJobsStorage",
  handler: async (queueItem, context) => {
    let message: Record<string, any>;

    try {
      message =
        typeof queueItem === "string"
          ? JSON.parse(queueItem)
          : (queueItem as any);
    } catch {
      context.error(
        `[AudioJobWorker] Failed to parse queue message: ${queueItem}`
      );
      return;
    }

    const jobId = message.recordingId ?? message.jobId ?? "unknown";
    const retryCount = (message.retryCount ?? 0) as number;

    try {
      await processJob(message, context);
    } catch (err: any) {
      const errDetail = extractErrorDetails(err);
      const statusMessage =
        errDetail?.statusMessage ?? err?.message ?? String(err);

      context.error(
        `[AudioJobWorker] Job ${jobId} failed (attempt ${retryCount + 1}): ${statusMessage}`
      );

      if (retryCount < MAX_RETRIES) {
        try {
          await enqueueRetry(jobId, retryCount, message);
        } catch (retryErr) {
          context.error(
            `[AudioJobWorker] Failed to enqueue retry for ${jobId}: ${retryErr}`
          );
        }
      } else {
        context.error(
          `[AudioJobWorker] Job ${jobId} exhausted all ${MAX_RETRIES} retries. Giving up.`
        );
      }
    }
  },
});
