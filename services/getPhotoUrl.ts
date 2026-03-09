import Config from 'react-native-config';

export type GetPhotoUrlResponse = {
  ok: boolean;
  captureId: string;
  photoUrl: string;   // use as <Image source={{ uri: photoUrl }} />
  expiresAt: string;  // ISO timestamp — refetch before this
};

/**
 * Fetches a short-lived signed read URL for a photo stored in Azure Blob Storage.
 *
 * The returned URL is valid for 30 minutes. Call this when navigating to any
 * screen that needs to display the photo (HomeScreen card, EditPhotoCard).
 * Cache the result per captureId and only refetch if expiresAt is approaching.
 *
 * @param captureId  - the UUID of the photo capture
 * @param blobName   - the blob path stored in the annotation (e.g. "photos/abc.jpg")
 * @param container  - the container name (e.g. "photos")
 */
export async function getPhotoUrl(
  captureId: string,
  blobName: string,
  container?: string,
): Promise<GetPhotoUrlResponse> {
  const baseUrl     = Config.AZURE_FUNCTION_BASE_URL;
  const functionKey = Config.AZURE_GET_PHOTO_URL_KEY;

  if (!baseUrl || !functionKey) {
    throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_GET_PHOTO_URL_KEY');
  }

  const params = new URLSearchParams({
    code:      functionKey,
    captureId,
    blobName,
    ...(container ? { container } : {}),
  });

  const res = await fetch(
    `${baseUrl}/api/get-photo-url?${params.toString()}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`get-photo-url failed: ${res.status} ${text}`);
  }

  return (await res.json()) as GetPhotoUrlResponse;
}
