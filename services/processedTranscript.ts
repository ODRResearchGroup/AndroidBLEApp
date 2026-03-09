import Config from 'react-native-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranscriptPhrase = {
  index: number;
  text: string;
  start_ms: number;
  end_ms: number;
  timestamp_ms: number;
  coord: { lat: number; lon: number };
};

export type ProcessedTranscriptResponse = {
  schema: string;
  recordingId: string;
  phrases: TranscriptPhrase[];
};

/**
 * Extracts a plain text string from a transcript response.
 * Joins all phrases in order, separated by spaces.
 */
export function transcriptToPlainText(t: ProcessedTranscriptResponse): string {
  return t.phrases
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(p => p.text.trim())
    .filter(Boolean)
    .join(' ');
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetches the processed transcript for a recording.
 *
 * The backend wraps the result:
 *   { ok: true, recordingId, transcript: { ... actual transcript blob ... } }
 *
 * The transcript blob itself (from Azure Speech) looks like:
 *   { combinedRecognizedPhrases: [...], recognizedPhrases: [...] }
 *
 * We normalise both shapes into ProcessedTranscriptResponse so callers
 * always get schema / recordingId / phrases[].
 *
 * Returns null when the transcript blob doesn't exist yet (404).
 */
export async function fetchProcessedTranscript(
  recordingId: string
): Promise<ProcessedTranscriptResponse | null> {
  const baseUrl = Config.AZURE_FUNCTION_BASE_URL;
  const functionKey = Config.AZURE_PROCESSED_TRANSCRIPT_KEY;

  if (!baseUrl || !functionKey) {
    throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_PROCESSED_TRANSCRIPT_KEY');
  }

  const url =
    `${baseUrl}/api/processed-transcript` +
    `?recordingId=${encodeURIComponent(recordingId)}` +
    `&code=${encodeURIComponent(functionKey)}`;

  const res = await fetch(url, { method: 'GET' });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`processed-transcript failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  // Backend envelope: { ok, recordingId, transcript: <blob> }
  const blob = json?.transcript ?? json;

  // Already in our normalised shape (saved by stt-poll)?
  if (Array.isArray(blob?.phrases)) {
    return blob as ProcessedTranscriptResponse;
  }

  // Azure Speech transcript shape — normalise to our schema
  const recognizedPhrases: any[] = blob?.recognizedPhrases ?? [];
  const phrases: TranscriptPhrase[] = recognizedPhrases.map((p: any, i: number) => ({
    index: i,
    text: p.nBest?.[0]?.display ?? p.nBest?.[0]?.lexical ?? '',
    start_ms: offsetToMs(p.offset),
    end_ms: offsetToMs(p.offset) + offsetToMs(p.duration),
    timestamp_ms: offsetToMs(p.offset),
    coord: { lat: 0, lon: 0 }, // GPS coords matched in bundle; default to 0
  }));

  return {
    schema: 'processed_transcript_v1',
    recordingId,
    phrases,
  };
}

/** Azure Speech uses ISO 8601 duration ticks (PT0.45S etc) or raw tick strings. */
function offsetToMs(raw: string | number | undefined): number {
  if (!raw) {return 0;}
  if (typeof raw === 'number') {return Math.round(raw / 10_000);} // 100-ns ticks → ms
  // "PT1M3.45S" style
  const m = String(raw).match(/PT(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (m) {
    return Math.round(((Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0)) * 1000);
  }
  return 0;
}
