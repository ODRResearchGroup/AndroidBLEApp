import React, { useState } from 'react';
import { View, Text, Button, Image, Platform, PermissionsAndroid } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import { supabase } from '../services/Supabase';

async function ensureCameraPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  return false;
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

function pickContentType(fileName?: string) {
  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

export default function PhotoCaptureUploadScreen() {
  const [status, setStatus] = useState('Idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [lastUploadPath, setLastUploadPath] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) {
        setStatus('Camera permission denied');
        return;
      }

      setStatus('Opening camera...');
      setLastUploadPath(null);

      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        saveToPhotos: false,
        includeExtra: false,
        quality: 0.9,
      });

      if (result.didCancel) {
        setStatus('Cancelled');
        return;
      }

      if (result.errorCode) {
        setStatus(`Camera error: ${result.errorMessage ?? result.errorCode}`);
        return;
      }

      const asset = result.assets && result.assets[0] ? result.assets[0] : null;
      if (!asset || !asset.uri) {
        setStatus('No photo returned');
        return;
      }

      setPhotoUri(asset.uri);
      setPhotoFileName(asset.fileName ?? null);
      setStatus('Photo captured ✅');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const uploadPhoto = async () => {
    try {
      if (!photoUri) {
        setStatus('No photo to upload yet');
        return;
      }

      setStatus('Preparing file...');
      const readablePath = await getReadablePathFromUri(photoUri);

      const exists = await ReactNativeBlobUtil.fs.exists(readablePath);
      if (!exists) {
        setStatus(`File not found: ${readablePath}`);
        return;
      }

      setStatus('Reading bytes...');
      const base64 = await ReactNativeBlobUtil.fs.readFile(readablePath, 'base64');
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

      const bucket = 'images';
      const ext =
        (photoFileName && photoFileName.includes('.'))
          ? photoFileName.split('.').pop()?.toLowerCase()
          : 'jpg';

      const filePath = `photos/photo-${Date.now()}.${ext ?? 'jpg'}`;
      const contentType = pickContentType(photoFileName ?? undefined);

      setStatus('Uploading to Supabase...');
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
          contentType,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      setLastUploadPath(filePath);
      setStatus('Uploaded ✅');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Photo Capture + Upload</Text>

      <Text>{status}</Text>

      <Button title="Take photo" onPress={takePhoto} />
      <Button title="Upload photo" onPress={uploadPhoto} />

      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ width: 240, height: 240, borderRadius: 12 }}
        />
      ) : null}

      {photoUri ? <Text>Local: {photoUri}</Text> : null}
      {lastUploadPath ? <Text>Uploaded: {lastUploadPath}</Text> : null}
    </View>
  );
}
