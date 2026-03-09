import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function getProcessingStatus(recordingId: string): Promise<any> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const processedContainer = requireEnv("PROCESSED_CONTAINER");

  const statusBlob = blobService
    .getContainerClient(processedContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  try {
    const data = await statusBlob.downloadToBuffer();
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

app.http("processed-status", {
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

      const status = await getProcessingStatus(recordingId);

      if (!status) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Not found" }),
        };
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, recordingId, status }),
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

export async function updateProcessingStatus(
  recordingId: string,
  status: Record<string, any>
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const blobService = BlobServiceClient.fromConnectionString(conn);
  const processedContainer = requireEnv("PROCESSED_CONTAINER");

  const statusBlob = blobService
    .getContainerClient(processedContainer)
    .getBlockBlobClient(`${recordingId}.json`);

  const content = JSON.stringify({
    schema: "processed_status_v1",
    recordingId,
    updatedAt: new Date().toISOString(),
    ...status,
  });

  await statusBlob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}
