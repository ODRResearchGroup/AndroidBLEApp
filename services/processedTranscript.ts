import Config from 'react-native-config';

export type ProcessedTranscriptResponse = {
  schema: string;
  recordingId: string;
  phrases: Array<{
    index: number;
    text: string;
    start_ms: number;
    end_ms: number;
    timestamp_ms: number;
    coord: { lat: number; lon: number };
  }>;
};

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

  // Transcript not ready yet — valid state
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`processed-transcript failed: ${res.status} ${text}`);
  }

  return (await res.json()) as ProcessedTranscriptResponse;
}
