import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function processingAudio(
  recordingId: string,
  audioExt: string
): Promise<{ exists: boolean; contentLength: number; contentType: string }> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const rawAudioContainer = requireEnv("RAW_AUDIO_CONTAINER");

  const audioBlob = blobService
    .getContainerClient(rawAudioContainer)
    .getBlockBlobClient(`${recordingId}.${audioExt}`);

  const exists = await audioBlob.exists();
  if (!exists) {
    return { exists: false, contentLength: 0, contentType: "" };
  }

  const props = await audioBlob.getProperties();

  return {
    exists: true,
    contentLength: props.contentLength ?? 0,
    contentType: props.contentType ?? "application/octet-stream",
  };
}

async function updateStatus(
  recordingId: string,
  status: string,
  details: Record<string, any> = {}
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const processedContainer = requireEnv("PROCESSED_CONTAINER");

  const statusBlob = blobService
    .getContainerClient(processedContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const payload = JSON.stringify({
    schema: "processed_status_v1",
    recordingId,
    status,
    updatedAt: new Date().toISOString(),
    ...details,
  });

  await statusBlob.upload(payload, Buffer.byteLength(payload), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

app.http("process-audio", {
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
      const result = await processingAudio(recordingId, audioExt);

      if (!result.exists) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Audio blob not found",
            recordingId,
          }),
        };
      }

      await updateStatus(recordingId, "processing", {
        contentLength: result.contentLength,
        contentType: result.contentType,
      });

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          recordingId,
          contentLength: result.contentLength,
          contentType: result.contentType,
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

app.storageBlob("process-audio-blob", {
  path: "audio/{name}",
  connection: "AzureWebJobsStorage",
  handler: async (myBlob, context) => {
    try {
      const name = (context.triggerMetadata?.name ?? "") as string;
      const ext = name.split(".").pop() ?? "wav";
      const recordingId = name.replace(/\.[^.]+$/, "") ?? "";

      if (!recordingId) {
        context.warn("Blob trigger fired with empty recordingId, skipping.");
        return;
      }

      context.log(`Processing audio blob: ${name}`);

      const result = await processingAudio(recordingId, ext);

      if (result.exists) {
        await updateStatus(recordingId, "processing", {
          contentLength: result.contentLength,
          contentType: result.contentType,
          triggeredBy: "blob",
        });
        context.log(`Status updated for ${recordingId}`);
      } else {
        context.warn(`Audio blob not found for ${recordingId}`);
      }
    } catch (e: any) {
      context.error(e);
    }
  },
});