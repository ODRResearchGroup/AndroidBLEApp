import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

/**
 * save-annotation
 *
 * Persists a completed annotation (description, drawing strokes, selected tags)
 * to the annotations container. Called by the mobile app after the user saves
 * from PhotoNoteScreen (for photos) or after tags are edited in EditPhotoCardScreen.
 *
 * POST body:
 * {
 *   recordingId: string         — links back to the audio/photo recording
 *   type: "photo" | "audio"
 *   description: string         — free-text description written by the user
 *   strokes?: DrawingStroke[]   — SVG drawing strokes (photo only)
 *   selectedTags: string[]      — descriptor tags chosen by user
 *   timestamp: string           — display timestamp (HH:MM:SS)
 *   latitude: string            — display coord string
 *   longitude: string           — display coord string
 *   photoUri?: string           — local URI of the photo (photo type only)
 *   annotationIndex: number     — ordinal shown in the UI
 * }
 *
 * Writes to: annotations/{recordingId}.json
 * Returns: { ok: true, annotationId: string }
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

async function writeAnnotation(
  annotationId: string,
  payload: Record<string, any>
): Promise<void> {
  const conn = requireEnv("AzureWebJobsStorage");
  const container = requireEnv("ANNOTATIONS_CONTAINER");
  const blobService = BlobServiceClient.fromConnectionString(conn);

  const blob = blobService
    .getContainerClient(container)
    .getBlockBlobClient(`${annotationId}.json`);

  const content = JSON.stringify({
    schema: "annotation_v1",
    annotationId,
    savedAt: new Date().toISOString(),
    ...payload,
  });

  await blob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: "application/json" },
    // overwrite=true so edits replace previous saves
    conditions: {},
  });
}

async function readAnnotation(annotationId: string): Promise<any | null> {
  const conn = requireEnv("AzureWebJobsStorage");
  const container = requireEnv("ANNOTATIONS_CONTAINER");
  const blobService = BlobServiceClient.fromConnectionString(conn);

  const blob = blobService
    .getContainerClient(container)
    .getBlockBlobClient(`${annotationId}.json`);

  try {
    const data = await blob.downloadToBuffer();
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

// ── POST /api/save-annotation ─────────────────────────────────────────────────

app.http("save-annotation", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const recordingId = body?.recordingId as string | undefined;

      if (!recordingId) {
        return json({ error: "Missing recordingId" }, 400);
      }

      // annotationId == recordingId for a 1:1 relationship.
      // If you later support multiple annotations per recording, extend this.
      const annotationId = recordingId;

      await writeAnnotation(annotationId, {
        recordingId,
        type:            body.type            ?? "audio",
        description:     body.description     ?? "",
        strokes:         body.strokes         ?? [],
        selectedTags:    body.selectedTags    ?? [],
        timestamp:       body.timestamp       ?? "",
        latitude:        body.latitude        ?? "",
        longitude:       body.longitude       ?? "",
        latitudeRaw:     body.latitudeRaw     ?? null,
        longitudeRaw:    body.longitudeRaw    ?? null,
        accuracyM:       body.accuracyM       ?? null,
        capturedAtMs:    body.capturedAtMs    ?? null,
        annotationIndex: body.annotationIndex ?? 1,
        imageBlobName:   body.imageBlobName   ?? null,
        imageContainer:  body.imageContainer  ?? null,
        bundleBlobName:  body.bundleBlobName  ?? null,
        bundleContainer: body.bundleContainer ?? null,
      });

      context.log(`Annotation saved: ${annotationId}`);

      return json({ ok: true, annotationId });
    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});

// ── GET /api/save-annotation?annotationId=... ─────────────────────────────────
// Used by EditPhotoCardScreen to load an existing annotation for editing.

app.http("get-annotation", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const annotationId = req.query.get("annotationId");
      if (!annotationId) return json({ error: "Missing annotationId" }, 400);

      const annotation = await readAnnotation(annotationId);
      if (!annotation) return json({ error: "Not found" }, 404);

      return json({ ok: true, annotation });
    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});

// ── GET /api/list-annotations ─────────────────────────────────────────────────
// Used by HomeScreen to load the annotation feed.

app.http("list-annotations", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const conn = requireEnv("AzureWebJobsStorage");
      const container = requireEnv("ANNOTATIONS_CONTAINER");
      const blobService = BlobServiceClient.fromConnectionString(conn);
      const containerClient = blobService.getContainerClient(container);

      const annotations: any[] = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        try {
          const blockBlob = containerClient.getBlockBlobClient(blob.name);
          const data = await blockBlob.downloadToBuffer();
          annotations.push(JSON.parse(data.toString()));
        } catch {
          // skip corrupt blobs
        }
      }

      // Sort newest first by savedAt
      annotations.sort(
        (a, b) =>
          new Date(b.savedAt ?? 0).getTime() -
          new Date(a.savedAt ?? 0).getTime()
      );

      return json({ ok: true, annotations });
    } catch (e: any) {
      context.error(e);
      return json({ error: e?.message ?? String(e) }, 500);
    }
  },
});
