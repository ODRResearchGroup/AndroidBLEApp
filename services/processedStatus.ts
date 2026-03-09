import Config from 'react-native-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProcessedStatusResponse = {
  schema: string;
  recordingId: string;
  status: string; // "uploaded" | "processing" | "transcribed" | "failed"
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Polls the processed-status endpoint.
 *
 * The backend wraps the status blob inside a top-level envelope:
 *   { ok: true, recordingId, status: { schema, recordingId, status, updatedAt } }
 *
 * We unwrap it here so callers always get a flat ProcessedStatusResponse.
 *
 * Returns null when the status blob doesn't exist yet (404 = not ready).
 */
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

  if (res.status === 404) {
    return null; // not ready yet — valid poll state
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`processed-status failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  // Backend returns: { ok, recordingId, status: { schema, recordingId, status, updatedAt } }
  // Unwrap the nested status object into a flat shape.
  const inner = json?.status ?? json;

  return {
    schema: inner.schema ?? '',
    recordingId: inner.recordingId ?? recordingId,
    status: inner.status ?? '',
  } as ProcessedStatusResponse;
}
