import { app } from "@azure/functions";
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  SASProtocol,
} from "@azure/storage-blob";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function generateSasUploadUrl(
  blobService: BlobServiceClient,
  credential: StorageSharedKeyCredential,
  containerName: string,
  blobName: string,
  expiresInMin = 60
): string {
  const containerClient = blobService.getContainerClient(containerName);
  const blockBlob = containerClient.getBlockBlobClient(blobName);

  const startsOn = new Date();
  startsOn.setMinutes(startsOn.getMinutes() - 5);

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMin);

  const sasParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  );

  return `${blockBlob.url}?${sasParams.toString()}`;
}

function credentialFromConnectionString(connStr: string): {
  credential: StorageSharedKeyCredential;
  blobService: BlobServiceClient;
} {
  const accountNameMatch = connStr.match(/AccountName=([^;]+)/);
  const accountKeyMatch  = connStr.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error(
      "Connection string must contain AccountName and AccountKey for SAS generation"
    );
  }

  const credential = new StorageSharedKeyCredential(
    accountNameMatch[1],
    accountKeyMatch[1]
  );
  const blobService = new BlobServiceClient(
    `https://${accountNameMatch[1]}.blob.core.windows.net`,
    credential
  );

  return { credential, blobService };
}

// ── POST /api/uploads-prepare  (audio) ───────────────────────────────────────

app.http("uploads-prepare", {
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

      const conn               = requireEnv("AzureWebJobsStorage");
      const rawAudioContainer  = requireEnv("RAW_AUDIO_CONTAINER");
      const rawBundlesContainer = requireEnv("RAW_AUDIO_BUNDLES_CONTAINER");

      const { credential, blobService } = credentialFromConnectionString(conn);

      const audioBlobName  = `${recordingId}.${audioExt}`;
      const bundleBlobName = `${recordingId}.json`;

      const audioUploadUrl  = generateSasUploadUrl(blobService, credential, rawAudioContainer,  audioBlobName);
      const bundleUploadUrl = generateSasUploadUrl(blobService, credential, rawBundlesContainer, bundleBlobName);

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          recordingId,
          audioUpload:  { container: rawAudioContainer,  blobName: audioBlobName,  uploadUrl: audioUploadUrl },
          bundleUpload: { container: rawBundlesContainer, blobName: bundleBlobName, uploadUrl: bundleUploadUrl },
          expiresIn: 3600,
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

// ── POST /api/photos-prepare  (photo + bundle) ────────────────────────────────
//
// Body: { captureId: string, imageExt?: "jpg" | "png" }
// Returns SAS upload URLs for:
//   - the image file  → RAW_PHOTOS_CONTAINER / photos/{captureId}.{ext}
//   - the bundle JSON → RAW_PHOTO_BUNDLES_CONTAINER / photos/{captureId}.bundle.json

app.http("photos-prepare", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const captureId = body?.captureId as string | undefined;

      if (!captureId) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing captureId" }),
        };
      }

      const imageExt = (body?.imageExt ?? "jpg") as string;

      const conn                  = requireEnv("AzureWebJobsStorage");
      const rawPhotosContainer    = requireEnv("RAW_PHOTOS_CONTAINER");
      const rawPhotoBundlesContainer = requireEnv("RAW_PHOTO_BUNDLES_CONTAINER");

      const { credential, blobService } = credentialFromConnectionString(conn);

      const imageBlobName  = `photos/${captureId}.${imageExt}`;
      const bundleBlobName = `photos/${captureId}.bundle.json`;

      const imageUploadUrl  = generateSasUploadUrl(blobService, credential, rawPhotosContainer,       imageBlobName);
      const bundleUploadUrl = generateSasUploadUrl(blobService, credential, rawPhotoBundlesContainer, bundleBlobName);

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          captureId,
          imageUpload:  { container: rawPhotosContainer,       blobName: imageBlobName,  uploadUrl: imageUploadUrl },
          bundleUpload: { container: rawPhotoBundlesContainer,  blobName: bundleBlobName, uploadUrl: bundleUploadUrl },
          expiresIn: 3600,
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

// ── GET /api/uploads-list ─────────────────────────────────────────────────────

app.http("uploads-list", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const conn           = requireEnv("AzureWebJobsStorage");
      const blobService    = BlobServiceClient.fromConnectionString(conn);
      const rawAudioContainer = requireEnv("RAW_AUDIO_CONTAINER");
      const containerClient = blobService.getContainerClient(rawAudioContainer);

      const blobs: { name: string; size: number | undefined }[] = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        blobs.push({ name: blob.name, size: blob.properties.contentLength });
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, blobs }),
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
