import Config from 'react-native-config';

export type ProcessedStatusResponse = {
  schema: string;
  recordingId: string;
  status: string;
};

export async function fetchProcessedStatus(
  recordingId: string
): Promise<ProcessedStatusResponse | null> {
  const baseUrl = Config.AZURE_FUNCTION_BASE_URL;
  const functionKey = Config.AZURE_PROCESSED_STATUS_KEY;

  if (!baseUrl || !functionKey) {
    throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_PROCESSED_STATUS_KEY');
  }

  const url =
    `${baseUrl}/api/processed-status` +
    `?recordingId=${encodeURIComponent(recordingId)}` +
    `&code=${encodeURIComponent(functionKey)}`;

  const res = await fetch(url, { method: 'GET' });

  // Status not ready yet — valid state
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`processed-status failed: ${res.status} ${text}`);
  }

  return (await res.json()) as ProcessedStatusResponse;
}
