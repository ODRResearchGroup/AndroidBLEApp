import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

/**
 * photo-upload-complete
 *
 * Called by the mobile app immediately after uploading a photo image and its
 * bundle JSON to Azure Blob Storage via SAS URLs.
 *
 * Responsibilities:
 *  1. Verify both the image blob and the bundle blob actually exist in storage
 *  2. Read the bundle JSON to extract GPS point, timestamp, and image reference
 *  3. Write a status blob to PROCESSED_CONTAINER so the app can poll the same
 *     status pattern used for audio ("uploaded" → the photo is fully persisted)
 *
 * POST body:
 * {
 *   captureId:       string   — UUID for this photo capture
 *   imageBlobName:   string   — e.g. "photos/abc-123.jpg"
 *   bundleBlobName:  string   — e.g. "photos/abc-123.bundle.json"
 *   imageExt?:       string   — "jpg" | "png" (default "jpg")
 * }
 *
 * Returns:
 * {
 *   ok: true,
 *   captureId: string,
 *   gpsPoint: { lat, lon, accuracy_m } | null,
 *   capturedAtMs: number
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

async function blobExists(
  blobService: BlobServiceClient,
  containerName: string,
  blobName: string
): Promise<boolean> {
  try {
    const exists = await blobService
      .getContainerClient(containerName)
      .getBlockBlobClient(blobName)
      .exists();
    return exists;
  } catch {
    return false;
  }
}

async function readBundleJson(
  blobService: BlobServiceClient,
  containerName: string,
  blobName: string
): Promise<any | null> {
  try {
    const data = await blobService
      .getContainerClient(containerName)
      .getBlockBlobClient(blobName)
      .downloadToBuffer();
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

async function writePhotoStatus(
  blobService: BlobServiceClient,
  captureId: string,
  status: string,
  details: Record<string, any> = {}
): Promise<void> {
  const processedContainer = requireEnv("PROCESSED_CONTAINER");

  const content = JSON.stringify({
    schema:    "processed_status_v1",
    recordingId: captureId, // photos share the same status schema as audio
    captureId,
    type:      "photo",
    status,
    updatedAt: new Date().toISOString(),
    ...details,
  });

  const blob = blobService
    .getContainerClient(processedContainer)
    .getBlockBlobClient(`${captureId}.json`);

  await blob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

app.http("photo-upload-complete", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const captureId      = body?.captureId      as string | undefined;
      const imageBlobName  = body?.imageBlobName  as string | undefined;
      const bundleBlobName = body?.bundleBlobName as string | undefined;

      if (!captureId || !imageBlobName || !bundleBlobName) {
        return json({ error: "Missing captureId, imageBlobName or bundleBlobName" }, 400);
      }

      const conn                     = requireEnv("AzureWebJobsStorage");
      const rawPhotosContainer        = requireEnv("RAW_PHOTOS_CONTAINER");
      const rawPhotoBundlesContainer  = requireEnv("RAW_PHOTO_BUNDLES_CONTAINER");

      const blobService = BlobServiceClient.fromConnectionString(conn);

      // 1. Verify both blobs actually landed
      const [imageOk, bundleOk] = await Promise.all([
        blobExists(blobService, rawPhotosContainer,       imageBlobName),
        blobExists(blobService, rawPhotoBundlesContainer, bundleBlobName),
      ]);

      if (!imageOk || !bundleOk) {
        return json({
          error:   "Upload not complete yet",
          captureId,
          missing: { image: !imageOk, bundle: !bundleOk },
        }, 409);
      }

      // 2. Read bundle to extract GPS point, timestamp, strokes reference
      const bundle = await readBundleJson(blobService, rawPhotoBundlesContainer, bundleBlobName);
      const gpsPoint    = bundle?.point        ?? null;
      const capturedAtMs = bundle?.captured_at_ms ?? Date.now();

      // 3. Write status blob so the app (and any future pipeline) can track state
      await writePhotoStatus(blobService, captureId, "uploaded", {
        imageBlobName,
        bundleBlobName,
        gpsPoint,
        capturedAtMs,
        imageContainer:  rawPhotosContainer,
        bundleContainer: rawPhotoBundlesContainer,
      });

      context.log(`[photo-upload-complete] ${captureId} verified and status written`);

      return json({
        ok:           true,
        captureId,
        gpsPoint,
        capturedAtMs,
      });

    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});
