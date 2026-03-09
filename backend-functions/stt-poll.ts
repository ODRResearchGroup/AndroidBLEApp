import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function checkTranscriptionStatus(operationId: string): Promise<any> {
  const speechKey = requireEnv("SPEECH_API_KEY");
  const speechRegion = requireEnv("SPEECH_REGION");

  const url = `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/${operationId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Speech API status check failed: ${res.status} ${text}`);
  }

  return await res.json();
}

async function fetchTranscriptionFiles(filesUrl: string): Promise<any> {
  const speechKey = requireEnv("SPEECH_API_KEY");

  const res = await fetch(filesUrl, {
    method: "GET",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch transcription files: ${res.status} ${text}`);
  }

  return await res.json();
}

/**
 * Download the actual transcript content from the Speech API's contentUrl.
 * The files listing contains links to the real transcription data — we need
 * to follow those links to get the actual text.
 */
async function downloadTranscriptContent(filesResponse: any): Promise<any> {
  const transcriptionFile = filesResponse.values?.find(
    (f: any) => f.kind === "Transcription"
  );

  if (!transcriptionFile?.links?.contentUrl) {
    return null;
  }

  // The contentUrl is a SAS-signed URL from the Speech API — no auth header needed
  const res = await fetch(transcriptionFile.links.contentUrl);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download transcript content: ${res.status} ${text}`);
  }

  return await res.json();
}

async function saveResults(recordingId: string, results: any): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const resultsContainer = requireEnv("RESULTS_CONTAINER");

  const resultsBlob = blobService
    .getContainerClient(resultsContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const content = JSON.stringify(results);
  await resultsBlob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

async function saveTranscript(recordingId: string, transcript: any): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const transcriptsContainer = requireEnv("TRANSCRIPTS_CONTAINER");

  const transcriptBlob = blobService
    .getContainerClient(transcriptsContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const content = JSON.stringify(transcript);
  await transcriptBlob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

async function saveStatus(recordingId: string, status: string): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const processedContainer = requireEnv("PROCESSED_CONTAINER");

  const statusBlob = blobService
    .getContainerClient(processedContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const content = JSON.stringify({
    schema: "processed_status_v1",
    recordingId,
    status,
    updatedAt: new Date().toISOString(),
  });

  await statusBlob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

async function reEnqueuePollingJob(
  operationId: string,
  recordingId: string,
  attempt: number
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const queueName = process.env["POLLING_QUEUE"] ?? "stt-polling";
  const queue = new QueueClient(conn, queueName);
  await queue.createIfNotExists();

  const message = JSON.stringify({ operationId, recordingId, attempt });
  const encoded = Buffer.from(message).toString("base64");

  const delaySec = Math.min(120, 15 * Math.pow(2, attempt));
  await queue.sendMessage(encoded, { visibilityTimeout: delaySec });
}

async function handleSuccess(recordingId: string, filesUrl: string, context: any): Promise<void> {
  const filesResponse = await fetchTranscriptionFiles(filesUrl);

  // Save raw files listing to results
  await saveResults(recordingId, filesResponse);
  context.log(`Raw results saved for ${recordingId}`);

  // Download and save actual transcript content
  const transcript = await downloadTranscriptContent(filesResponse);
  if (transcript) {
    await saveTranscript(recordingId, transcript);
    context.log(`Transcript content saved for ${recordingId}`);
  } else {
    context.warn(`No transcript content found for ${recordingId}`);
  }

  // Update status to transcribed
  await saveStatus(recordingId, "transcribed");
  context.log(`Status updated to transcribed for ${recordingId}`);
}

app.http("stt-poll", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const operationId = body?.operationId as string | undefined;
      const recordingId = body?.recordingId as string | undefined;

      if (!operationId || !recordingId) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Missing operationId or recordingId",
          }),
        };
      }

      const result = await checkTranscriptionStatus(operationId);

      if (result.status === "Succeeded" && result.links?.files) {
        await handleSuccess(recordingId, result.links.files, context);
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          recordingId,
          operationId,
          transcriptionStatus: result.status,
        }),
      };
    } catch (e: any) {
      context.error(e);
      return {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: e?.message ?? String(e) }),
      };
    }
  },
});

app.storageQueue("stt-poll-queue", {
  queueName: process.env["POLLING_QUEUE"] ?? "stt-polling",
  connection: "AzureWebJobsStorage",
  handler: async (queueItem, context) => {
    try {
      const message =
        typeof queueItem === "string" ? JSON.parse(queueItem) : (queueItem as any);

      const operationId = message?.operationId as string | undefined;
      const recordingId = message?.recordingId as string | undefined;
      const attempt = (message?.attempt ?? 0) as number;

      if (!operationId || !recordingId) {
        context.warn(
          "Polling queue message missing operationId or recordingId, skipping."
        );
        return;
      }

      const maxAttempts = 120;
      if (attempt >= maxAttempts) {
        context.error(
          `Polling timed out for ${recordingId} after ${attempt} attempts`
        );
        await saveStatus(recordingId, "failed");
        return;
      }

      context.log(
        `Polling STT status for ${recordingId} (attempt ${attempt + 1})`
      );

      const result = await checkTranscriptionStatus(operationId);

      if (result.status === "Succeeded") {
        context.log(`Transcription succeeded for ${recordingId}`);

        if (result.links?.files) {
          await handleSuccess(recordingId, result.links.files, context);
        }
        return;
      }

      if (result.status === "Failed") {
        context.error(
          `Transcription failed for ${recordingId}: ${result.error ?? "unknown error"}`
        );
        await saveStatus(recordingId, "failed");
        return;
      }

      context.log(
        `Transcription still ${result.status} for ${recordingId}, re-enqueuing...`
      );
      await reEnqueuePollingJob(operationId, recordingId, attempt + 1);
    } catch (e: any) {
      context.error(e);
      throw e;
    }
  },
});