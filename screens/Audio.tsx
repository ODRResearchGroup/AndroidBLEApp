import React, { useRef, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { startAudioRecording, stopAudioRecording } from '../services/audioRecorder';
import { startAudioTrack, stopAudioTrack, type AudioTrackBundle } from '../services/audioTrack';
import { uploadAudioToSupabase, uploadAudioTrackJsonToSupabase } from '../services/audioUpload';

export default function AudioScreen() {
  const [status, setStatus] = useState('Idle');
  const [isRecording, setIsRecording] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [lastUploadPath, setLastUploadPath] = useState<string | null>(null);
  const [lastTrackPath, setLastTrackPath] = useState<string | null>(null);

  const recordingIdRef = useRef<string | null>(null);
  const plannedPathRef = useRef<string | null>(null);
  const trackRef = useRef<AudioTrackBundle | null>(null);

  const startRecording = async () => {
    try {
      setStatus('Starting recording...');
      setLastUploadPath(null);
      setLastTrackPath(null);

      const recordingId = `${Date.now()}`;
      recordingIdRef.current = recordingId;
      trackRef.current = null;

      await startAudioTrack(Number(recordingId));

      const res = await startAudioRecording(recordingId);
      plannedPathRef.current = res.plannedPath;

      setIsRecording(true);
      setLocalUri(res.localUri);
      setStatus('Recording...');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const stopRecording = async () => {
    try {
      setStatus('Stopping recording...');

      const res = await stopAudioRecording();
      const track = stopAudioTrack();

      trackRef.current = track;

      setIsRecording(false);

      const finalUri = res.localUri || plannedPathRef.current;
      if (finalUri) {
        setLocalUri(finalUri);
      }

      setStatus('Recorded ✅ (ready to upload)');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const uploadBundle = async () => {
    try {
      if (!localUri) {
        setStatus('No recording found yet');
        return;
      }

      if (isRecording) {
        setStatus('Stop recording before uploading');
        return;
      }

      const recordingId = recordingIdRef.current;
      if (!recordingId) {
        setStatus('Missing recording id');
        return;
      }

      const track = trackRef.current;
      if (!track) {
        setStatus('Missing track data');
        return;
      }

      setStatus('Uploading audio...');
      const audioRes = await uploadAudioToSupabase(localUri, recordingId);

      setStatus('Uploading track JSON...');
      const trackRes = await uploadAudioTrackJsonToSupabase(
        track,
        recordingId,
        audioRes.storagePath
      );

      setLastUploadPath(audioRes.storagePath);
      setLastTrackPath(trackRes.storagePath);
      setStatus('Bundle uploaded ✅');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Audio + Track</Text>

      <Text>{status}</Text>

      {!isRecording ? (
        <Button title="Start recording" onPress={startRecording} />
      ) : (
        <Button title="Stop recording" onPress={stopRecording} />
      )}

      <Button title="Upload bundle" onPress={uploadBundle} />

      {localUri ? <Text>Local: {localUri}</Text> : null}
      {lastUploadPath ? <Text>Uploaded audio: {lastUploadPath}</Text> : null}
      {lastTrackPath ? <Text>Uploaded track: {lastTrackPath}</Text> : null}

      {trackRef.current ? <Text>Points: {trackRef.current.points.length}</Text> : null}
    </View>
  );
}
