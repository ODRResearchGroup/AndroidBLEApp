import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import { supabase } from './Supabase';
import type { AudioTrackBundle } from './audioTrack';

export type UploadAudioResult = {
  bucket: string;
  storagePath: string;
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

export async function uploadAudioToSupabase(localUri: string, recordingId: string): Promise<UploadAudioResult> {
  const normalizedPath = normalizeFilePath(localUri);

  const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
  if (!exists) {
    throw new Error(`File not found: ${normalizedPath}`);
  }

  const base64 = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'base64');
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

  const bucket = 'audio-recordings';
  const ext = normalizedPath.split('.').pop()?.toLowerCase() || 'm4a';
  const storagePath = `recordings/audio-${recordingId}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: pickAudioContentType(ext),
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { bucket, storagePath };
}

export async function uploadAudioTrackJsonToSupabase(
  track: AudioTrackBundle,
  recordingId: string,
  audioStoragePath: string
) {
  const bucket = 'audio-recordings';
  const storagePath = `recordings/audio-${recordingId}.track.json`;

  const payload = {
    ...track,
    audio: {
      bucket,
      path: audioStoragePath,
    },
  };

  const json = JSON.stringify(payload);
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
