import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

function json(body: unknown, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function blobExists(client: any): Promise<boolean> {
  try {
    return await client.exists();
  } catch {
    return false;
  }
}

async function callSttSubmit(
  recordingId: string,
  audioExt: string,
  locale: string
) {
  const baseUrl = requireEnv("AZURE_FUNCTION_BASE_URL").replace(/\/+$/, "");
  const key = requireEnv("AZURE_STT_SUBMIT_KEY");
  const url = `${baseUrl}/api/stt-submit?code=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId, audioExt, locale }),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`stt-submit failed: ${res.status} ${text}`);
  }

  return parsed;
}

app.http("upload-complete", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const recordingId = body?.recordingId as string | undefined;

      if (!recordingId) {
        return json({ error: "Missing recordingId" }, 400);
      }

      const audioExt = (body?.audioExt ?? "m4a") as string;
      const locale = (body?.locale ?? "en-US") as string;

      const conn = requireEnv("AzureWebJobsStorage");
      const blobService = BlobServiceClient.fromConnectionString(conn);
      const rawAudioContainer = requireEnv("RAW_AUDIO_CONTAINER");
      const rawBundlesContainer = requireEnv("RAW_AUDIO_BUNDLES_CONTAINER");

      const audioBlob = blobService
        .getContainerClient(rawAudioContainer)
        .getBlockBlobClient(`${recordingId}.${audioExt}`);
      const bundleBlob = blobService
        .getContainerClient(rawBundlesContainer)
        .getBlockBlobClient(`${recordingId}.json`);

      const [audioOk, bundleOk] = await Promise.all([
        blobExists(audioBlob),
        blobExists(bundleBlob),
      ]);

      if (!audioOk || !bundleOk) {
        return json(
          {
            error: "Upload not complete yet",
            recordingId,
            missing: { audio: !audioOk, bundle: !bundleOk },
          },
          409
        );
      }

      const stt = await callSttSubmit(recordingId, audioExt, locale);
      return json({ ok: true, recordingId, kickedOff: true, stt });
    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});
