import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import type { AudioTrackBundle } from './audioTrack';

export type UploadAudioResult = {
  container: string;
  blobName: string;
};

function pickAudioContentType(ext: string) {
  if (ext === 'm4a') {
    return 'audio/mp4';
  }
  if (ext === 'aac') {
    return 'audio/aac';
  }
  if (ext === 'wav') {
    return 'audio/wav';
  }
  return 'application/octet-stream';
}

function normalizeFilePath(path: string) {
  if (path.startsWith('file://')) {
    return path.replace(/^file:\/\//, '');
  }
  return path;
}

async function putBytesToSasUrl(sasUrl: string, bytes: Uint8Array, contentType: string) {
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
    throw new Error(`Azure PUT failed: ${res.status} ${text}`);
  }
}

export async function uploadAudioToAzure(localUri: string, sasUploadUrl: string, container: string, blobName: string): Promise<UploadAudioResult> {
  const normalizedPath = normalizeFilePath(localUri);

  const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
  if (!exists) {
    throw new Error(`File not found: ${normalizedPath}`);
  }

  const ext = normalizedPath.split('.').pop()?.toLowerCase() || 'm4a';
  const base64 = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'base64');
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

  await putBytesToSasUrl(sasUploadUrl, bytes, pickAudioContentType(ext));

  return { container, blobName };
}

export async function uploadAudioTrackJsonToAzure(
  track: AudioTrackBundle,
  sasUploadUrl: string,
  container: string,
  blobName: string,
  audioRef: { container: string; blobName: string }
) {
  const payload = {
    ...track,
    audio: audioRef,
  };

  const json = JSON.stringify(payload);
  const bytes = Uint8Array.from(Buffer.from(json, 'utf8'));

  await putBytesToSasUrl(sasUploadUrl, bytes, 'application/json');

  return { container, blobName };
}
