import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function getTranscript(recordingId: string): Promise<any> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const transcriptContainer = requireEnv("TRANSCRIPTS_CONTAINER");

  const transcriptBlob = blobService
    .getContainerClient(transcriptContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  try {
    const data = await transcriptBlob.downloadToBuffer();
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

app.http("processed-transcript", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const recordingId = req.query.get("recordingId");

      if (!recordingId) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing recordingId" }),
        };
      }

      const transcript = await getTranscript(recordingId);

      if (!transcript) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Not found" }),
        };
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, recordingId, transcript }),
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

export async function saveTranscript(
  recordingId: string,
  transcript: any
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const transcriptContainer = requireEnv("TRANSCRIPTS_CONTAINER");

  const transcriptBlob = blobService
    .getContainerClient(transcriptContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const content = JSON.stringify(transcript);
  await transcriptBlob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}
