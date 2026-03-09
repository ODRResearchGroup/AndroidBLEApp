import { app } from "@azure/functions";
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  SASProtocol,
} from "@azure/storage-blob";

/**
 * get-photo-url
 *
 * Returns a short-lived, read-only SAS URL for a photo blob stored in Azure.
 * The mobile app uses this URL directly as the `source` for a React Native
 * <Image> component — no download, no base64 conversion needed.
 *
 * The SAS URL expires in 30 minutes by default (configurable via expiresInMin).
 * The app should refetch this URL when navigating to a screen that shows the photo.
 *
 * GET ?captureId=abc-123&container=photos&blobName=photos/abc-123.jpg
 *
 * OR POST body:
 * {
 *   captureId:  string   — used for logging only
 *   container:  string   — Azure container name (e.g. "photos")
 *   blobName:   string   — full blob path (e.g. "photos/abc-123.jpg")
 *   expiresInMin?: number — default 30
 * }
 *
 * Returns:
 * {
 *   ok:         true,
 *   captureId:  string,
 *   photoUrl:   string,   ← use this as <Image source={{ uri: photoUrl }} />
 *   expiresAt:  string    ← ISO timestamp when URL expires
 * }
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function json(body: unknown, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function credentialFromConnectionString(connStr: string): {
  credential: StorageSharedKeyCredential;
  accountName: string;
} {
  const accountNameMatch = connStr.match(/AccountName=([^;]+)/);
  const accountKeyMatch  = connStr.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error("Connection string must contain AccountName and AccountKey");
  }

  return {
    credential:  new StorageSharedKeyCredential(accountNameMatch[1], accountKeyMatch[1]),
    accountName: accountNameMatch[1],
  };
}

function generateReadSasUrl(
  containerName: string,
  blobName: string,
  credential: StorageSharedKeyCredential,
  accountName: string,
  expiresInMin: number
): { url: string; expiresAt: Date } {
  const startsOn  = new Date();
  startsOn.setMinutes(startsOn.getMinutes() - 2); // small clock skew buffer

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMin);

  const sasParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"), // read-only
      startsOn,
      expiresOn: expiresAt,
      protocol:  SASProtocol.Https,
    },
    credential
  );

  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasParams.toString()}`;
  return { url, expiresAt };
}

// ── Handler (supports both GET and POST) ─────────────────────────────────────

async function handle(
  captureId: string,
  containerName: string,
  blobName: string,
  expiresInMin: number,
  context: any
) {
  const conn = requireEnv("AzureWebJobsStorage");
  const { credential, accountName } = credentialFromConnectionString(conn);

  // Verify the blob actually exists before issuing a URL for it
  const blobService = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  const exists = await blobService
    .getContainerClient(containerName)
    .getBlockBlobClient(blobName)
    .exists();

  if (!exists) {
    return json({ error: "Photo blob not found", captureId, blobName }, 404);
  }

  const { url, expiresAt } = generateReadSasUrl(
    containerName,
    blobName,
    credential,
    accountName,
    expiresInMin
  );

  context.log(`[get-photo-url] Issued SAS for ${blobName}, expires ${expiresAt.toISOString()}`);

  return json({
    ok:        true,
    captureId,
    photoUrl:  url,
    expiresAt: expiresAt.toISOString(),
  });
}

app.http("get-photo-url", {
  methods: ["GET", "POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      let captureId: string;
      let containerName: string;
      let blobName: string;
      let expiresInMin: number;

      if (req.method === "GET") {
        captureId    = req.query.get("captureId")  ?? "";
        containerName = req.query.get("container") ?? requireEnv("RAW_PHOTOS_CONTAINER");
        blobName     = req.query.get("blobName")   ?? "";
        expiresInMin = parseInt(req.query.get("expiresInMin") ?? "30", 10);
      } else {
        const body   = (await req.json()) as any;
        captureId    = body?.captureId    ?? "";
        containerName = body?.container  ?? requireEnv("RAW_PHOTOS_CONTAINER");
        blobName     = body?.blobName    ?? "";
        expiresInMin = body?.expiresInMin ?? 30;
      }

      if (!captureId || !blobName) {
        return json({ error: "Missing captureId or blobName" }, 400);
      }

      return await handle(captureId, containerName, blobName, expiresInMin, context);

    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});
