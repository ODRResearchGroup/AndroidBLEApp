import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Animated, TouchableWithoutFeedback,
  StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Play, Pause } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { RootStackParamList } from '../App';
import { startAudioRecording, stopAudioRecording } from '../services/audioRecorder';
import { startAudioTrack, stopAudioTrack } from '../services/audioTrack';
import { uploadsPrepare } from '../services/uploadsPrepare';
import { uploadAudioToAzure, uploadAudioTrackJsonToAzure } from '../services/audioUpload';
import { notifyUploadComplete } from '../services/uploadComplete';
import {
  insertRecording, updateRecordingStatus, updateRecordingTranscript, updateRecordingTags,
} from '../services/recordingsDb';
import { fetchProcessedStatus } from '../services/processedStatus';
import { fetchProcessedTranscript, transcriptToPlainText } from '../services/processedTranscript';
import { fetchSuggestedDescriptors } from '../services/suggestDescriptors';
import { saveAnnotation } from '../services/annotationService';
import { usePressAnimation } from '../services/usePressAnimation';

const C = {
  black: '#1A1A1A', darkGray: '#4D4D4D', lightGray: '#B3B3B3',
  white: '#FAFAFA', border: '#E0E0E0', error: '#C0392B',
};

type Phase = 'idle' | 'recording' | 'paused' | 'uploading' | 'processing' | 'tagging' | 'saving' | 'done' | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '', recording: 'Recording…', paused: 'Paused',
  uploading: 'Uploading…', processing: 'Processing transcript…',
  tagging: 'Suggesting tags…', saving: 'Saving annotation…',
  done: 'Annotation saved ✓', error: 'Something went wrong',
};

const formatDuration = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(v => String(v).padStart(2, '0')).join(':');

const formatCoord = (lat: number, lon: number) => ({
  latitude:  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`,
  longitude: `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`,
});

const formatTimestamp = (ms: number) => {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(v => String(v).padStart(2, '0')).join(':');
};

// ─── Waveform ─────────────────────────────────────────────────────────────────

const WAVEFORM_BARS = Array.from({ length: 60 }, (_, i) => {
  const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return 0.15 + Math.abs(seed - Math.floor(seed)) * 0.85;
});

const Waveform = ({ isActive }: { isActive: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isActive) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.85, duration: 500, useNativeDriver: true }),
      ])).start();
    } else { pulse.stopAnimation(); pulse.setValue(1); }
  }, [isActive, pulse]);
  return (
    <Animated.View style={[styles.waveform, isActive && { transform: [{ scaleY: pulse }] }]}>
      {WAVEFORM_BARS.map((h, i) => (
        <View key={i} style={[styles.waveBar,
          { height: 4 + h * 28, backgroundColor: isActive ? C.black : C.lightGray }]} />
      ))}
    </Animated.View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'AudioNote'>;

export default function AudioNoteScreen({ navigation, route }: Props) {
  const { annotationIndex } = route.params;

  const [phase,   setPhase]   = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recordingIdRef = useRef<string | null>(null);
  const startedAtMsRef = useRef<number | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => { timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000); };
  const stopTimer  = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => () => {
    stopTimer();
    if (pollRef.current) {clearInterval(pollRef.current);}
  }, []);

  // ── Start ──────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    try {
      const recordingId = uuidv4();
      recordingIdRef.current = recordingId;
      const startedAt = Date.now();
      startedAtMsRef.current = startedAt;
      await Promise.all([startAudioRecording(recordingId), startAudioTrack(startedAt)]);
      setElapsed(0);
      setPhase('recording');
      startTimer();
    } catch (err: any) {
      Alert.alert('Recording error', err.message ?? String(err));
      setPhase('error');
    }
  };

  // ── Pause / Resume ─────────────────────────────────────────────────────────

  const handlePauseResume = () => {
    if (phase === 'recording') { stopTimer(); setPhase('paused'); }
    else if (phase === 'paused') { startTimer(); setPhase('recording'); }
  };

  // ── Stop → full pipeline ───────────────────────────────────────────────────

  const handleStop = async () => {
    stopTimer();
    setPhase('uploading');

    try {
      const recordingId = recordingIdRef.current!;
      const startedAt   = startedAtMsRef.current ?? Date.now();

      // 1. Stop recorder + GPS track simultaneously
      const [stopResult, trackBundle] = await Promise.all([
        stopAudioRecording(),
        Promise.resolve(stopAudioTrack()),
      ]);
      if (!stopResult.localUri) {throw new Error('No audio file produced');}

      const firstPt  = trackBundle.points[0] ?? null;
      const coords   = firstPt ? formatCoord(firstPt.lat, firstPt.lon)
                                : { latitude: '00.0000° N', longitude: '00.0000° E' };
      const timestamp = formatTimestamp(startedAt);

      // 2. Get SAS upload URLs
      const prep = await uploadsPrepare(recordingId, 'm4a');

      // 3. Upload audio + GPS bundle in parallel
      await Promise.all([
        uploadAudioToAzure(
          stopResult.localUri,
          prep.audioUpload.uploadUrl,
          prep.audioUpload.container,
          prep.audioUpload.blobName,
        ),
        uploadAudioTrackJsonToAzure(
          trackBundle,
          prep.bundleUpload.uploadUrl,
          prep.bundleUpload.container,
          prep.bundleUpload.blobName,
          { container: prep.audioUpload.container, blobName: prep.audioUpload.blobName },
        ),
      ]);

      // 4. Persist local SQLite record
      await insertRecording({
        recordingId,
        audioPath:       stopResult.localUri,
        bundlePath:      prep.bundleUpload.blobName,
        createdAt:       startedAt,
        status:          'uploaded',
        processedPrefix: prep.audioUpload.blobName.replace(/\.[^.]+$/, ''),
        annotationIndex,
        type:            'audio',
        timestamp,
        latitude:        coords.latitude,
        longitude:       coords.longitude,
      });

      // 5. Tell backend uploads are done → triggers STT job
      await notifyUploadComplete(recordingId, 'm4a');

      setPhase('processing');

      // 6. Poll every 10 s for STT completion
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetchProcessedStatus(recordingId);
          if (!statusRes) {return;} // 404 = not ready, keep polling

          if (statusRes.status === 'transcribed') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await updateRecordingStatus(recordingId, 'transcribed');

            // 7. Fetch transcript
            const transcriptRes = await fetchProcessedTranscript(recordingId);
            let plainText = '';
            if (transcriptRes) {
              plainText = transcriptToPlainText(transcriptRes);
              await updateRecordingTranscript(recordingId, JSON.stringify(transcriptRes));
            }

            // 8. Suggest odor descriptor tags via Azure OpenAI
            setPhase('tagging');
            let selectedTags: string[]  = [];
            let suggestedTags: string[] = [];
            if (plainText) {
              try {
                const tagRes  = await fetchSuggestedDescriptors(plainText, recordingId);
                selectedTags  = tagRes.suggestedDescriptors.slice(0, 5);
                suggestedTags = tagRes.suggestedDescriptors.slice(5);
                await updateRecordingTags(recordingId, selectedTags, suggestedTags);
              } catch (e) { console.warn('Tag suggestion failed (non-fatal):', e); }
            }

            // 9. Persist annotation to Azure
            setPhase('saving');
            await saveAnnotation({
              recordingId,
              type:           'audio',
              description:    plainText,
              selectedTags,
              timestamp,
              latitude:       coords.latitude,
              longitude:      coords.longitude,
              latitudeRaw:    firstPt?.lat  ?? undefined,
              longitudeRaw:   firstPt?.lon  ?? undefined,
              capturedAtMs:   startedAt,
              annotationIndex,
            });

            setPhase('done');
            setTimeout(() => navigation.navigate('Home'), 900);

          } else if (statusRes.status === 'failed') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await updateRecordingStatus(recordingId, 'failed');
            setPhase('error');
          }
        } catch (e) { console.warn('Poll error (will retry):', e); }
      }, 10_000);

    } catch (err: any) {
      Alert.alert('Upload error', err.message ?? String(err));
      setPhase('error');
    }
  };

  // ── Derived UI state ───────────────────────────────────────────────────────

  const isRecording = phase === 'recording';
  const isPaused    = phase === 'paused';
  const isActive    = isRecording || isPaused;
  const isBusy      = !['idle', 'recording', 'paused', 'error'].includes(phase);

  const pauseAnim  = usePressAnimation({ scaleTo: 0.88, haptic: 'light' });
  const actionAnim = usePressAnimation({ scaleTo: 0.96, haptic: 'medium' });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={styles.card}>
        <Text style={styles.annotationLabel}>ANNOTATION #{annotationIndex}</Text>
        <View style={styles.headerDivider} />
        <Text style={styles.title}>Voice Note</Text>
        <View style={styles.spacer} />
        <Text style={styles.duration}>{formatDuration(elapsed)}</Text>
        <Waveform isActive={isRecording} />

        <TouchableWithoutFeedback
          onPress={() => { if (isActive) { pauseAnim.fireHaptic(); handlePauseResume(); } }}
          {...pauseAnim.handlers}
          disabled={!isActive}
        >
          <Animated.View style={[
            styles.playPauseButton,
            !isActive && styles.playPauseDisabled,
            { transform: [{ scale: pauseAnim.scale }] },
          ]}>
            {isPaused
              ? <Play  size={22} color={C.white} fill={C.white} strokeWidth={0} />
              : <Pause size={22} color={C.white} fill={C.white} strokeWidth={0} />
            }
          </Animated.View>
        </TouchableWithoutFeedback>

        <View style={styles.spacer} />

        {PHASE_LABEL[phase] !== '' && (
          <Text style={[styles.statusLabel, phase === 'error' && { color: C.error }]}>
            {PHASE_LABEL[phase]}
          </Text>
        )}

        <TouchableWithoutFeedback
          onPress={() => { if (!isBusy) { actionAnim.fireHaptic(); isActive ? handleStop() : handleStart(); } }}
          {...actionAnim.handlers}
          disabled={isBusy}
        >
          <Animated.View style={[
            styles.actionButton,
            isBusy && styles.actionButtonDisabled,
            { transform: [{ scale: actionAnim.scale }] },
          ]}>
            <Text style={styles.actionButtonLabel}>
              {isActive ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  card: {
    flex: 1, margin: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.white, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  annotationLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2, marginBottom: 12 },
  headerDivider: { height: 1, backgroundColor: C.border, marginBottom: 28 },
  title: { fontFamily: 'Montserrat-Bold', fontSize: 22, color: C.black, textAlign: 'center' },
  spacer: { flex: 1 },
  duration: { fontFamily: 'Montserrat-Regular', fontSize: 18, color: C.darkGray, textAlign: 'center', letterSpacing: 1, marginBottom: 14 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, gap: 2, marginBottom: 28, overflow: 'hidden' },
  waveBar: { width: 2.5, borderRadius: 2 },
  playPauseButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.darkGray, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  playPauseDisabled: { backgroundColor: C.lightGray },
  statusLabel: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: C.darkGray, textAlign: 'center', marginBottom: 12 },
  actionButton: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  actionButtonDisabled: { backgroundColor: C.lightGray },
  actionButtonLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 16, color: C.white, letterSpacing: 0.3 },
});
