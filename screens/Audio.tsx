import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Button, ScrollView } from 'react-native';
import Config from 'react-native-config';
import { startAudioRecording, stopAudioRecording } from '../services/audioRecorder';
import { startAudioTrack, stopAudioTrack, type AudioTrackBundle } from '../services/audioTrack';
import { uploadsPrepare } from '../src/uploadsPrepare.ts';
import { uploadAudioToAzure, uploadAudioTrackJsonToAzure } from '../services/audioUpload';
import {
  listRecordings,
  insertRecording,
  updateRecordingStatus,
  updateRecordingTranscript,
  type RecordingRow,
} from '../src/recordingsDb.ts';
import { fetchProcessedStatus } from '../src/processedStatus.ts';
import { fetchProcessedTranscript } from '../services/processedTranscript';

export default function AudioScreen() {
  const [status, setStatus] = useState('Idle');
  const [isRecording, setIsRecording] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [lastUploadPath, setLastUploadPath] = useState<string | null>(null);
  const [lastTrackPath, setLastTrackPath] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);

  const recordingIdRef = useRef<string | null>(null);
  const plannedPathRef = useRef<string | null>(null);
  const trackRef = useRef<AudioTrackBundle | null>(null);

  const refreshRecordings = useCallback(async () => {
    const rows = await listRecordings(50);
    setRecordings(rows);
  }, []);

  const getTranscriptText = (r: RecordingRow) => {
    if (!r.transcriptJson) {
      return null;
    }

    try {
      const parsed = JSON.parse(r.transcriptJson) as { phrases?: Array<{ text: string }> };
      if (!parsed.phrases || parsed.phrases.length === 0) {
        return '(Transcript empty)';
      }
      return parsed.phrases.map((p) => p.text).join('\n\n');
    } catch {
      return '(Transcript parse error)';
    }
  };

  const refreshOneStatus = useCallback(
    async (recordingId: string) => {
      try {
        setStatus(`Fetching status for ${recordingId}...`);

        const s = await fetchProcessedStatus(recordingId);
        if (!s?.status) {
          setStatus(`Status not ready yet (${recordingId})`);
          return;
        }

        await updateRecordingStatus(recordingId, s.status);
        await refreshRecordings();

        setStatus(`Status updated ✅ (${recordingId}: ${s.status})`);
      } catch (e: any) {
        console.error(e);
        setStatus(`Error: ${e?.message ?? String(e)}`);
      }
    },
    [refreshRecordings]
  );

  const fetchOneTranscript = useCallback(
    async (recordingId: string) => {
      try {
        setStatus(`Fetching transcript for ${recordingId}...`);

        const transcript = await fetchProcessedTranscript(recordingId);
        if (!transcript) {
          setStatus(`Transcript not ready yet (${recordingId})`);
          return;
        }

        await updateRecordingTranscript(recordingId, JSON.stringify(transcript));
        await refreshRecordings();

        setStatus(`Transcript saved ✅ (${recordingId})`);
      } catch (e: any) {
        console.error(e);
        setStatus(`Transcript error: ${e?.message ?? String(e)}`);
      }
    },
    [refreshRecordings]
  );

  const autoRefreshAll = useCallback(async () => {
    try {
      const rows = await listRecordings(50);

      for (const r of rows) {
        if (r.status === 'transcribed') {
          if (!r.transcriptJson) {
            const transcript = await fetchProcessedTranscript(r.recordingId);
            if (transcript) {
              await updateRecordingTranscript(r.recordingId, JSON.stringify(transcript));
            }
          }
          continue;
        }

        const s = await fetchProcessedStatus(r.recordingId);
        if (!s?.status) {
          continue;
        }

        await updateRecordingStatus(r.recordingId, s.status);

        if (s.status === 'transcribed') {
          const transcript = await fetchProcessedTranscript(r.recordingId);
          if (transcript) {
            await updateRecordingTranscript(r.recordingId, JSON.stringify(transcript));
          }
        }
      }

      await refreshRecordings();
    } catch (e: any) {
      console.error(e);
    }
  }, [refreshRecordings]);

  useEffect(() => {
    refreshRecordings().catch(() => {});
    autoRefreshAll().catch(() => {});
  }, [refreshRecordings, autoRefreshAll]);

  useEffect(() => {
    const tick = setInterval(() => {
      autoRefreshAll().catch(() => {});
    }, 10000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        autoRefreshAll().catch(() => {});
      }
    });

    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [autoRefreshAll]);

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
      setLocalUri(res.localUri || plannedPathRef.current);
      setStatus('Recorded ✅ (ready to upload)');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  const uploadBundle = async () => {
    try {
      if (!localUri || isRecording || !recordingIdRef.current || !trackRef.current) {
        setStatus('Recording not ready to upload');
        return;
      }

      const recordingId = recordingIdRef.current;
      const track = trackRef.current;

      setStatus('Preparing upload URLs...');
      const prep = await uploadsPrepare(recordingId, 'm4a');

      setStatus('Uploading audio...');
      const audioRes = await uploadAudioToAzure(
        localUri,
        prep.audioUpload.uploadUrl,
        prep.audioUpload.container,
        prep.audioUpload.blobName
      );

      setStatus('Uploading track JSON...');
      const trackRes = await uploadAudioTrackJsonToAzure(
        track,
        prep.bundleUpload.uploadUrl,
        prep.bundleUpload.container,
        prep.bundleUpload.blobName,
        audioRes
      );

      const audioPath = `${audioRes.container}/${audioRes.blobName}`;
      const bundlePath = `${trackRes.container}/${trackRes.blobName}`;

      setLastUploadPath(audioPath);
      setLastTrackPath(bundlePath);

      await insertRecording({
        recordingId,
        audioPath,
        bundlePath,
        createdAt: Date.now(),
        status: 'uploaded',
        processedPrefix: null,
      });

      setStatus('Notifying backend (upload complete)...');

      const baseUrl = Config.AZURE_FUNCTION_BASE_URL;
      const key = Config.AZURE_UPLOAD_COMPLETE_KEY;

      if (!baseUrl || !key) {
        throw new Error('Missing AZURE_FUNCTION_BASE_URL or AZURE_UPLOAD_COMPLETE_KEY');
      }

      const url =
        `${baseUrl}/api/upload-complete` +
        `?recordingId=${encodeURIComponent(recordingId)}` +
        `&code=${encodeURIComponent(key)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId, audioExt: 'm4a' }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`upload-complete failed: ${res.status} ${text}`);
      }

      await refreshRecordings();
      setStatus('Bundle uploaded ✅ (backend processing started)');
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Audio + Track</Text>
      <Text>{status}</Text>

      {lastUploadPath ? <Text>Uploaded audio: {lastUploadPath}</Text> : null}
      {lastTrackPath ? <Text>Uploaded bundle: {lastTrackPath}</Text> : null}

      {!isRecording ? (
        <Button title="Start recording" onPress={startRecording} />
      ) : (
        <Button title="Stop recording" onPress={stopRecording} />
      )}

      <Button title="Upload bundle" onPress={uploadBundle} />

      <View style={{ marginTop: 12, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Saved uploads</Text>

        {recordings.map((r) => (
          <View key={r.recordingId} style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
            <Text>{r.recordingId}</Text>
            <Text>Status: {r.status}</Text>

            {r.transcriptJson ? (
              <>
                <Text style={{ fontWeight: "600" }}>Transcript</Text>
                <Text>{getTranscriptText(r)}</Text>
              </>
            ) : null}

            <Button title="Refresh status" onPress={() => refreshOneStatus(r.recordingId)} />
            <Button title="Fetch transcript" onPress={() => fetchOneTranscript(r.recordingId)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
