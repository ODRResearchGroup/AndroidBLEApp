import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import type { PhotoBundle } from './photoTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadPhotoResult = {
  container: string;
  blobName: string;
  contentType: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickImageContentType(fileName?: string | null): string {
  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.png')) {return 'image/png';}
  return 'image/jpeg';
}

function normalizeFilePath(path: string): string {
  return path.startsWith('file://') ? path.replace(/^file:\/\//, '') : path;
}

async function getReadablePath(uri: string): Promise<string> {
  if (uri.startsWith('file://')) {return uri.replace(/^file:\/\//, '');}
  if (uri.startsWith('content://')) {
    const stat = await ReactNativeBlobUtil.fs.stat(uri);
    if (stat?.path) {return stat.path;}
  }
  return uri;
}

async function putBytesToSasUrl(
  sasUrl: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const res = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
    },
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure photo PUT failed: ${res.status} ${text}`);
  }
}

// ─── Upload photo image ───────────────────────────────────────────────────────

/**
 * Uploads a photo file to Azure Blob Storage using a SAS URL obtained from
 * the photos-prepare backend endpoint.
 *
 * @param localUri      - file:// or content:// URI from the camera
 * @param sasUploadUrl  - SAS URL returned by photos-prepare
 * @param container     - container name (from photos-prepare response)
 * @param blobName      - blob name (from photos-prepare response)
 * @param originalFileName - optional original filename for content-type detection
 */
export async function uploadPhotoToAzure(
  localUri: string,
  sasUploadUrl: string,
  container: string,
  blobName: string,
  originalFileName?: string | null
): Promise<UploadPhotoResult> {
  const readablePath = await getReadablePath(localUri);
  const normalized   = normalizeFilePath(readablePath);

  const exists = await ReactNativeBlobUtil.fs.exists(normalized);
  if (!exists) {throw new Error(`File not found: ${normalized}`);}

  const contentType = pickImageContentType(originalFileName ?? blobName);
  const base64      = await ReactNativeBlobUtil.fs.readFile(normalized, 'base64');
  const bytes       = Uint8Array.from(Buffer.from(base64, 'base64'));

  await putBytesToSasUrl(sasUploadUrl, bytes, contentType);

  return { container, blobName, contentType };
}

// ─── Upload photo bundle JSON ─────────────────────────────────────────────────

/**
 * Uploads the GPS + photo metadata bundle to Azure Blob Storage.
 */
export async function uploadPhotoBundleJsonToAzure(
  bundle: PhotoBundle,
  sasUploadUrl: string,
  container: string,
  blobName: string
): Promise<{ container: string; blobName: string }> {
  const json  = JSON.stringify(bundle);
  const bytes = Uint8Array.from(Buffer.from(json, 'utf8'));

  await putBytesToSasUrl(sasUploadUrl, bytes, 'application/json');

  return { container, blobName };
}
