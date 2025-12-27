import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import { supabase } from './Supabase';
import type { PhotoBundle } from './photoTypes';

export type UploadPhotoResult = {
  bucket: string;
  storagePath: string;
  contentType: string;
};

function normalizeFilePath(path: string) {
  if (path.startsWith('file://')) {
    return path.replace(/^file:\/\//, '');
  }
  return path;
}

async function getReadablePathFromUri(uri: string) {
  if (uri.startsWith('file://')) {
    return uri.replace(/^file:\/\//, '');
  }

  if (uri.startsWith('content://')) {
    const stat = await ReactNativeBlobUtil.fs.stat(uri);
    if (stat && stat.path) {
      return stat.path;
    }
  }

  return uri;
}

function pickImageContentType(fileName?: string | null) {
  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

function pickExtension(fileName?: string | null) {
  const name = fileName ?? '';
  if (name.includes('.')) {
    return name.split('.').pop()?.toLowerCase() ?? 'jpg';
  }
  return 'jpg';
}

export async function uploadPhotoToSupabase(
  localUri: string,
  captureId: string,
  originalFileName?: string | null
): Promise<UploadPhotoResult> {
  const readablePath = await getReadablePathFromUri(localUri);
  const normalized = normalizeFilePath(readablePath);

  const exists = await ReactNativeBlobUtil.fs.exists(normalized);
  if (!exists) {
    throw new Error(`File not found: ${normalized}`);
  }

  const base64 = await ReactNativeBlobUtil.fs.readFile(normalized, 'base64');
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

  const bucket = 'images';
  const ext = pickExtension(originalFileName);
  const contentType = pickImageContentType(originalFileName);

  const storagePath = `photos/photo-${captureId}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { bucket, storagePath, contentType };
}

export async function uploadPhotoBundleJsonToSupabase(bundle: PhotoBundle, captureId: string) {
  const bucket = 'images';
  const storagePath = `photos/photo-${captureId}.bundle.json`;

  const json = JSON.stringify(bundle);
  const bytes = Uint8Array.from(Buffer.from(json, 'utf8'));

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: 'application/json',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { bucket, storagePath };
}
