import React, { useRef, useState } from 'react';
import { View, Text, Button, Platform, PermissionsAndroid } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Buffer } from 'buffer';
import { supabase } from '../services/Supabase';

async function ensureMicPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  return false;
}

function pickFileExtension() {
  return 'm4a';
}

function pickContentType(ext: string) {
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
  // iOS often returns file:///... which blob-util does not accept.
  if (path.startsWith('file://')) {
    return path.replace(/^file:\/\//, '');
  }
  return path;
}

export default function AudioRecordUploadScreen() {
  const [status, setStatus] = useState('Idle');
  const [isRecording, setIsRecording] = useState(false);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [lastUploadPath, setLastUploadPath] = useState<string | null>(null);

  const recordPathRef = useRef<string | null>(null);

  const startRecording = async () => {
    try {
      const ok = await ensureMicPermission();
      if (!ok) {
        setStatus('Microphone permission denied');
        return;
      }

      setStatus('Starting recording...');
      setLastUploadPath(null);

      const ext = pickFileExtension();

      const baseDir =
        Platform.OS === 'android'
          ? ReactNativeBlobUtil.fs.dirs.CacheDir
          : ReactNativeBlobUtil.fs.dirs.DocumentDir;

      const path = `${baseDir}/recording-${Date.now()}.${ext}`;
      recordPathRef.current = path;

      const resultPath = await AudioRecorderPlayer.startRecorder(path);

      setIsRecording(true);
      setLocalPath(resultPath);
      setStatus('Recording...');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const stopRecording = async () => {
    try {
      setStatus('Stopping recording...');

      const resultPath = await AudioRecorderPlayer.stopRecorder();
      AudioRecorderPlayer.removeRecordBackListener();

      setIsRecording(false);
      setLocalPath(resultPath || recordPathRef.current);
      setStatus('Recorded ✅ (ready to upload)');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const uploadRecording = async () => {
    try {
      if (!localPath) {
        setStatus('No recording found yet');
        return;
      }

      if (isRecording) {
        setStatus('Stop recording before uploading');
        return;
      }

      const normalizedPath = normalizeFilePath(localPath);

      setStatus('Checking file...');
      const exists = await ReactNativeBlobUtil.fs.exists(normalizedPath);
      if (!exists) {
        setStatus(`File not found: ${normalizedPath}`);
        return;
      }

      setStatus('Reading file...');
      const base64 = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'base64');
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

      const bucket = 'audio-recordings';
      const ext = normalizedPath.split('.').pop()?.toLowerCase() || 'm4a';
      const filePath = `recordings/audio-${Date.now()}.${ext}`;

      setStatus('Uploading to Supabase...');
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
          contentType: pickContentType(ext),
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
      <Text style={{ fontSize: 18, fontWeight: '600' }}>
        Audio Record + Upload
      </Text>

      <Text>{status}</Text>

      {!isRecording ? (
        <Button title="Start recording" onPress={startRecording} />
      ) : (
        <Button title="Stop recording" onPress={stopRecording} />
      )}

      <Button title="Upload recording" onPress={uploadRecording} />

      {localPath ? <Text>Local: {localPath}</Text> : null}
      {lastUploadPath ? <Text>Uploaded: {lastUploadPath}</Text> : null}
    </View>
  );
}
