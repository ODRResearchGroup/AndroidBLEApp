import Config from 'react-native-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadCompleteResponse = {
  ok: boolean;
  recordingId: string;
  kickedOff: boolean;
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Called immediately after audio + GPS bundle are uploaded to Azure Blob.
 *
 * This triggers the backend to:
 *  1. Verify both blobs exist
 *  2. Call stt-submit → enqueue polling job
 *
 * Without this call, transcription never starts.
 */
export async function notifyUploadComplete(
  recordingId: string,
  audioExt: 'm4a' | 'wav' = 'm4a',
  locale: string = 'en-US'
): Promise<UploadCompleteResponse> {
  const baseUrl = Config.AZURE_FUNCTION_BASE_URL;
  const functionKey = Config.AZURE_UPLOAD_COMPLETE_KEY;

  if (!baseUrl || !functionKey) {
    throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_UPLOAD_COMPLETE_KEY');
  }

  const res = await fetch(
    `${baseUrl}/api/upload-complete?code=${encodeURIComponent(functionKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, audioExt, locale }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload-complete failed: ${res.status} ${text}`);
  }

  return (await res.json()) as UploadCompleteResponse;
}
