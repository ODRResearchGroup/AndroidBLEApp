import Config from 'react-native-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SuggestDescriptorsResponse = {
  suggestedDescriptors: string[];  // ranked, from canonical 138-term list
  reasoning: string;
  availableDescriptors: string[];
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Sends a plain-text transcript to the backend which calls Azure OpenAI
 * and returns ranked odor descriptor tags from the canonical 138-term list.
 *
 * Call this after a transcript is received and before showing the card editor.
 */
export async function fetchSuggestedDescriptors(
  transcriptText: string,
  recordingId?: string
): Promise<SuggestDescriptorsResponse> {
  const baseUrl = Config.AZURE_FUNCTION_BASE_URL;
  const functionKey = Config.AZURE_SUGGEST_DESCRIPTORS_KEY;

  if (!baseUrl || !functionKey) {
    throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_SUGGEST_DESCRIPTORS_KEY');
  }

  const res = await fetch(
    `${baseUrl}/api/suggest-descriptors?code=${encodeURIComponent(functionKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcriptText, recordingId }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`suggest-descriptors failed: ${res.status} ${text}`);
  }

  return (await res.json()) as SuggestDescriptorsResponse;
}
