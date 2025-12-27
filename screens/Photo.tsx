import React, { useRef, useState } from 'react';
import { View, Text, Button, Image } from 'react-native';
import { capturePhoto } from '../services/photoCapture';
import { getOneShotLocation } from '../services/photoLocation';
import { uploadPhotoToSupabase, uploadPhotoBundleJsonToSupabase } from '../services/photoUpload';
import type { PhotoBundle } from '../services/photoTypes';

export default function PhotoScreen() {
  const [status, setStatus] = useState('Idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [lastUploadPath, setLastUploadPath] = useState<string | null>(null);
  const [lastBundlePath, setLastBundlePath] = useState<string | null>(null);

  const captureIdRef = useRef<string | null>(null);
  const capturedAtMsRef = useRef<number | null>(null);
  const pointRef = useRef<PhotoBundle['point']>(null);

  const takePhoto = async () => {
    try {
      setStatus('Capturing photo...');
      setLastUploadPath(null);
      setLastBundlePath(null);

      const captureId = `${Date.now()}`;
      captureIdRef.current = captureId;

      const capturedAtMs = Date.now();
      capturedAtMsRef.current = capturedAtMs;

      const loc = await getOneShotLocation();
      if (loc) {
        pointRef.current = {
          t_ms: 0,
          lat: loc.lat,
          lon: loc.lon,
          accuracy_m: loc.accuracy_m,
        };
      } else {
        pointRef.current = null;
      }

      const photo = await capturePhoto();

      setPhotoUri(photo.uri);
      setPhotoFileName(photo.fileName);
      setStatus('Photo captured ✅ (ready to upload)');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const uploadBundle = async () => {
    try {
      if (!photoUri) {
        setStatus('No photo to upload yet');
        return;
      }

      const captureId = captureIdRef.current;
      const capturedAtMs = capturedAtMsRef.current;

      if (!captureId || !capturedAtMs) {
        setStatus('Missing capture metadata');
        return;
      }

      setStatus('Uploading photo...');
      const photoRes = await uploadPhotoToSupabase(photoUri, captureId, photoFileName);

      const bundle: PhotoBundle = {
        schema: 'photo_gps_bundle_v1',
        captured_at_ms: capturedAtMs,
        photo: {
          bucket: photoRes.bucket,
          path: photoRes.storagePath,
          contentType: photoRes.contentType,
          originalFileName: photoFileName,
        },
        point: pointRef.current,
      };

      setStatus('Uploading bundle JSON...');
      const bundleRes = await uploadPhotoBundleJsonToSupabase(bundle, captureId);

      setLastUploadPath(photoRes.storagePath);
      setLastBundlePath(bundleRes.storagePath);
      setStatus('Bundle uploaded ✅');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Photo + Location Bundle</Text>

      <Text>{status}</Text>

      <Button title="Take photo" onPress={takePhoto} />
      <Button title="Upload bundle" onPress={uploadBundle} />

      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: 240, height: 240, borderRadius: 12 }} />
      ) : null}

      {photoUri ? <Text>Local: {photoUri}</Text> : null}
      {lastUploadPath ? <Text>Uploaded photo: {lastUploadPath}</Text> : null}
      {lastBundlePath ? <Text>Uploaded bundle: {lastBundlePath}</Text> : null}
    </View>
  );
}
