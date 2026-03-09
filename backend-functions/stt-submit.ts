import { app } from "@azure/functions";
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  SASProtocol,
} from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function submitToSpeechApi(
  audioUrl: string,
  locale: string
): Promise<any> {
  const speechKey = requireEnv("SPEECH_API_KEY");
  const speechRegion = requireEnv("SPEECH_REGION");

  const url = `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentUrls: [audioUrl],
      locale: locale ?? "en-US",
      displayName: `transcription-${Date.now()}`,
      properties: {
        wordLevelTimestampsEnabled: true,
        punctuationMode: "DictatedAndAutomatic",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Speech API submit failed: ${res.status} ${text}`);
  }

  return await res.json();
}

async function enqueuePollingJob(
  operationId: string,
  recordingId: string
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const queueName = process.env["POLLING_QUEUE"] ?? "stt-polling";
  const queue = new QueueClient(conn, queueName);
  await queue.createIfNotExists();

  const message = JSON.stringify({ operationId, recordingId });
  const encoded = Buffer.from(message).toString("base64");
  await queue.sendMessage(encoded);
}

async function getAudioUrl(
  recordingId: string,
  audioExt: string
): Promise<string> {
  const conn = requireEnv("AzureWebJobsStorage");
  const rawAudioContainer = requireEnv("RAW_AUDIO_CONTAINER");

  const accountNameMatch = conn.match(/AccountName=([^;]+)/);
  const accountKeyMatch = conn.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error("Connection string must contain AccountName and AccountKey");
  }

  const credential = new StorageSharedKeyCredential(
    accountNameMatch[1],
    accountKeyMatch[1]
  );
  const blobService = new BlobServiceClient(
    `https://${accountNameMatch[1]}.blob.core.windows.net`,
    credential
  );

  const blobName = `${recordingId}.${audioExt}`;
  const blockBlob = blobService
    .getContainerClient(rawAudioContainer)
    .getBlockBlobClient(blobName);

  const startsOn = new Date();
  startsOn.setMinutes(startsOn.getMinutes() - 5);

  const expiresOn = new Date();
  expiresOn.setHours(expiresOn.getHours() + 2); // 2 hours for STT to process

  const sasParams = generateBlobSASQueryParameters(
    {
      containerName: rawAudioContainer,
      blobName,
      permissions: BlobSASPermissions.parse("r"), // read-only
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  );

  return `${blockBlob.url}?${sasParams.toString()}`;
}

app.http("stt-submit", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const recordingId = body?.recordingId as string | undefined;

      if (!recordingId) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing recordingId" }),
        };
      }

      const audioExt = (body?.audioExt ?? "m4a") as string;
      const locale = (body?.locale ?? "en-US") as string;
      const audioUrl = await getAudioUrl(recordingId, audioExt);
      const result = await submitToSpeechApi(audioUrl, locale);

      const transcriptionUrl = result.self as string | undefined;
      const operationId =
        transcriptionUrl?.split("/").pop() ?? result.id ?? null;

      if (operationId) {
        await enqueuePollingJob(operationId, recordingId);
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, recordingId, operationId }),
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

app.storageQueue("stt-submit-queue", {
  queueName: process.env["SUBMIT_QUEUE"] ?? "stt-submit-queue",
  connection: "AzureWebJobsStorage",
  handler: async (queueItem, context) => {
    try {
      const message =
        typeof queueItem === "string" ? JSON.parse(queueItem) : (queueItem as any);
      const recordingId = message?.recordingId as string | undefined;
      const audioExt = (message?.audioExt ?? "m4a") as string;
      const locale = (message?.locale ?? "en-US") as string;

      if (!recordingId) {
        context.warn("Queue message missing recordingId, skipping.");
        return;
      }

      context.log(`Processing STT submission for ${recordingId}`);

      const audioUrl = await getAudioUrl(recordingId, audioExt);
      const result = await submitToSpeechApi(audioUrl, locale);

      const transcriptionUrl = result.self as string | undefined;
      const operationId =
        transcriptionUrl?.split("/").pop() ?? result.id ?? null;

      if (operationId) {
        await enqueuePollingJob(operationId, recordingId);
        context.log(
          `STT submitted for ${recordingId}, polling job enqueued: ${operationId}`
        );
      } else {
        context.warn(
          `STT submission for ${recordingId} returned no operationId`
        );
      }
    } catch (e: any) {
      context.error(e);
      throw e;
    }
  },
});