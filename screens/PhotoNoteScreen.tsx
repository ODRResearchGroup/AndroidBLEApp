import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Animated, TouchableWithoutFeedback,
  StyleSheet, SafeAreaView, StatusBar, ScrollView,
  PanResponder, GestureResponderEvent, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { ArrowLeft, Eraser } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { photosPrepare } from '../services/photosPrepare';
import { uploadPhotoToAzure, uploadPhotoBundleJsonToAzure } from '../services/photoUpload';
import { notifyPhotoUploadComplete } from '../services/photoUploadComplete';
import { insertRecording } from '../services/recordingsDb';
import { saveAnnotation } from '../services/annotationService';
import { usePressAnimation } from '../services/usePressAnimation';
import type { PhotoBundle } from '../services/photoTypes';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = { black: '#1A1A1A', darkGray: '#4D4D4D', lightGray: '#B3B3B3', white: '#FAFAFA', border: '#E0E0E0' };
const STROKE_WIDTH = 3.5;

// ─── Drawing types ────────────────────────────────────────────────────────────

type Point  = { x: number; y: number };
type Stroke = { id: string; points: Point[]; color: string; shape: number };

const toHSLA      = (hue: number, opacity: number) => `hsla(${Math.round(hue)},100%,50%,${opacity.toFixed(2)})`;
const toSVGPoints = (pts: Point[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const toDashArray = (shape: number) => {
  if (shape < 0.1) {return 'none';}
  return `${Math.max(1, STROKE_WIDTH * (1 - shape * 0.6)).toFixed(1)},${(2 + shape * 18).toFixed(1)}`;
};

// ─── Slider ───────────────────────────────────────────────────────────────────

const Slider = ({ value, onChange, track }: { value: number; onChange: (v: number) => void; track: React.ReactNode }) => {
  const tw = useRef(0);
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => onChange(Math.min(1, Math.max(0, e.nativeEvent.locationX / (tw.current || 1)))),
    onPanResponderMove:  (e: GestureResponderEvent) => onChange(Math.min(1, Math.max(0, e.nativeEvent.locationX / (tw.current || 1)))),
  })).current;
  return (
    <View style={styles.sliderTrackWrap} onLayout={e => { tw.current = e.nativeEvent.layout.width; }} {...pr.panHandlers}>
      {track}
      <View style={[styles.sliderThumb, { left: `${(value * 100).toFixed(1)}%` as any }]} />
    </View>
  );
};

const HUE_STOPS = ['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000'];
const HueTrack = () => (
  <View style={styles.hueTrack}>
    {HUE_STOPS.slice(0, -1).map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
  </View>
);
const OpacityTrack = ({ hue }: { hue: number }) => (
  <View style={styles.opacityTrack}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.lightGray }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: `hsl(${hue},100%,50%)` }]} />
  </View>
);
const ShapeTrack = () => (
  <View style={styles.shapeTrack}>
    {Array.from({ length: 28 }).map((_, i) => (
      <View key={i} style={{ width: 6, height: i % 2 === 0 ? 2 : 10, backgroundColor: C.lightGray, borderRadius: 1, alignSelf: 'center' }} />
    ))}
  </View>
);

// ─── SVG drawing canvas ───────────────────────────────────────────────────────

let Svg: any, Polyline: any;
try { const r = require('react-native-svg'); Svg = r.Svg; Polyline = r.Polyline; }
catch { Svg = ({ children, ...p }: any) => <View {...p}>{children}</View>; Polyline = () => null; }

const DrawingCanvas = ({
  strokes, onAddStroke, onErase, currentColor, currentShape, isErasing,
}: {
  strokes: Stroke[]; onAddStroke: (s: Stroke) => void; onErase: (id: string) => void;
  currentColor: string; currentShape: number; isErasing: boolean;
}) => {
  const pts      = useRef<Point[]>([]);
  const activeId = useRef<string | null>(null);
  const [, fu]   = useState(0);

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      if (isErasing) {return;}
      activeId.current = `s-${Date.now()}`;
      pts.current = [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
      fu(n => n + 1);
    },
    onPanResponderMove: (e: GestureResponderEvent) => {
      if (isErasing) {return;}
      pts.current = [...pts.current, { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
      fu(n => n + 1);
    },
    onPanResponderRelease: () => {
      if (isErasing || pts.current.length < 2) { pts.current = []; return; }
      onAddStroke({ id: activeId.current!, points: [...pts.current], color: currentColor, shape: currentShape });
      pts.current = []; activeId.current = null; fu(n => n + 1);
    },
  })).current;

  return (
    <View style={styles.canvas} {...pr.panHandlers}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        {strokes.map(s => (
          <Polyline key={s.id} points={toSVGPoints(s.points)} fill="none"
            stroke={s.color} strokeWidth={STROKE_WIDTH} strokeLinecap="round"
            strokeLinejoin="round" strokeDasharray={toDashArray(s.shape)}
            onPress={() => isErasing && onErase(s.id)} />
        ))}
        {pts.current.length > 1 && (
          <Polyline points={toSVGPoints(pts.current)} fill="none"
            stroke={currentColor} strokeWidth={STROKE_WIDTH}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={toDashArray(currentShape)} />
        )}
      </Svg>
      {isErasing && (
        <View style={styles.eraserHint}>
          <Text style={styles.eraserHintText}>Tap a stroke to erase</Text>
        </View>
      )}
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoNote'>;

export default function PhotoNoteScreen({ navigation, route }: Props) {
  const {
    annotationIndex,
    photoUri,
    timestamp,
    capturedAtMs,
    latitude,
    longitude,
    latitudeRaw,
    longitudeRaw,
    accuracyM,
  } = route.params;

  const [description, setDescription] = useState('');
  const [strokes,     setStrokes]     = useState<Stroke[]>([]);
  const [hue,         setHue]         = useState(0.33);
  const [opacity,     setOpacity]     = useState(0.8);
  const [shape,       setShape]       = useState(0);
  const [isErasing,   setIsErasing]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveStatus,  setSaveStatus]  = useState('');

  const hueDeg       = hue * 360;
  const currentColor = toHSLA(hueDeg, opacity);

  const backAnim   = usePressAnimation({ scaleTo: 0.80, haptic: 'light' });
  const eraserAnim = usePressAnimation({ scaleTo: 0.90, haptic: 'light' });
  const saveAnim   = usePressAnimation({ scaleTo: 0.96, haptic: 'medium' });

  const handleSave = async () => {
    if (saving) {return;}
    setSaving(true);

    try {
      const captureId   = uuidv4();
      const recordingId = captureId;
      const ext         = (photoUri.split('.').pop()?.toLowerCase() ?? 'jpg') as 'jpg' | 'png';

      // 1. Get SAS write URLs from backend
      setSaveStatus('Preparing upload…');
      const prep = await photosPrepare(captureId, ext);

      // 2. Build the GPS bundle with REAL coordinates (raw floats, not display strings)
      const gpsPoint = (latitudeRaw !== null && longitudeRaw !== null)
        ? {
            t_ms:       0,                // photo is an instant, not a track
            lat:        latitudeRaw,
            lon:        longitudeRaw,
            accuracy_m: accuracyM ?? undefined,
          }
        : null;

      const bundle: PhotoBundle = {
        schema:         'photo_gps_bundle_v1',
        captured_at_ms: capturedAtMs,
        photo: {
          container:   prep.imageUpload.container,
          blobName:    prep.imageUpload.blobName,
          contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        },
        point: gpsPoint,
      };

      // 3. Upload image + bundle to Azure in parallel
      setSaveStatus('Uploading photo…');
      await Promise.all([
        uploadPhotoToAzure(
          photoUri,
          prep.imageUpload.uploadUrl,
          prep.imageUpload.container,
          prep.imageUpload.blobName,
        ),
        uploadPhotoBundleJsonToAzure(
          bundle,
          prep.bundleUpload.uploadUrl,
          prep.bundleUpload.container,
          prep.bundleUpload.blobName,
        ),
      ]);

      // 4. Tell backend uploads are done — it verifies blobs + writes status
      setSaveStatus('Verifying upload…');
      await notifyPhotoUploadComplete(
        captureId,
        prep.imageUpload.blobName,
        prep.bundleUpload.blobName,
      );

      // 5. Persist local SQLite record
      await insertRecording({
        recordingId,
        audioPath:       '',
        bundlePath:      prep.bundleUpload.blobName,
        createdAt:       capturedAtMs,
        status:          'uploaded',
        annotationIndex,
        type:            'photo',
        timestamp,
        latitude,
        longitude,
        photoUri,
      });

      // 6. Save full annotation to Azure — includes strokes, GPS, blob references
      setSaveStatus('Saving annotation…');
      await saveAnnotation({
        recordingId,
        type:            'photo',
        description,
        strokes,
        selectedTags:    [],  // user sets tags in EditPhotoCard
        timestamp,
        latitude,
        longitude,
        latitudeRaw:     latitudeRaw  ?? undefined,
        longitudeRaw:    longitudeRaw ?? undefined,
        accuracyM:       accuracyM    ?? undefined,
        capturedAtMs,
        photoUri,
        annotationIndex,
        // Store blob references so get-photo-url can sign the image later
        imageBlobName:   prep.imageUpload.blobName,
        imageContainer:  prep.imageUpload.container,
        bundleBlobName:  prep.bundleUpload.blobName,
        bundleContainer: prep.bundleUpload.container,
      });

      // 7. Go to tag editor
      navigation.navigate('EditPhotoCard', { annotationId: recordingId });

    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? String(err));
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableWithoutFeedback
              onPress={() => { backAnim.fireHaptic(); navigation.goBack(); }}
              {...backAnim.handlers}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Animated.View style={{ transform: [{ scale: backAnim.scale }] }}>
                <ArrowLeft size={20} color={C.darkGray} strokeWidth={2} />
              </Animated.View>
            </TouchableWithoutFeedback>
            <View style={styles.topBarMeta}>
              <Text style={styles.timestamp}>{timestamp}</Text>
              <View style={styles.coordsBlock}>
                <Text style={styles.coords}>{latitude}</Text>
                <Text style={styles.coords}>{longitude}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.annotationLabel}>ANNOTATION #{annotationIndex}</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Write a description…"
            placeholderTextColor={C.lightGray}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.divider} />

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <TouchableWithoutFeedback
              onPress={() => { eraserAnim.fireHaptic(); setIsErasing(e => !e); }}
              {...eraserAnim.handlers}>
              <Animated.View style={[
                styles.eraserButton,
                isErasing && styles.eraserButtonActive,
                { transform: [{ scale: eraserAnim.scale }] },
              ]}>
                <Eraser size={18} color={isErasing ? C.white : C.lightGray} strokeWidth={2} />
                <Text style={[styles.eraserLabel, isErasing && styles.eraserLabelActive]}>Eraser</Text>
              </Animated.View>
            </TouchableWithoutFeedback>
            <View style={[styles.colorDot, { backgroundColor: currentColor }]} />
          </View>

          {/* Photo + drawing canvas */}
          <View style={styles.photoWrapper}>
            <View style={styles.photoPlaceholder} />
            <DrawingCanvas
              strokes={strokes}
              onAddStroke={s => setStrokes(p => [...p, s])}
              onErase={id => setStrokes(p => p.filter(s => s.id !== id))}
              currentColor={currentColor}
              currentShape={shape}
              isErasing={isErasing}
            />
          </View>

          <Text style={styles.sliderLabel}>Hue</Text>
          <Slider value={hue}     onChange={setHue}     track={<HueTrack />} />
          <Text style={styles.sliderLabel}>Opacity</Text>
          <Slider value={opacity} onChange={setOpacity} track={<OpacityTrack hue={hueDeg} />} />
          <Text style={styles.sliderLabel}>Shape</Text>
          <Slider value={shape}   onChange={setShape}   track={<ShapeTrack />} />

          {saving && saveStatus !== '' && (
            <Text style={styles.statusLabel}>{saveStatus}</Text>
          )}

          <TouchableWithoutFeedback onPress={handleSave} {...saveAnim.handlers} disabled={saving}>
            <Animated.View style={[
              styles.saveButton,
              saving && styles.saveButtonBusy,
              { transform: [{ scale: saveAnim.scale }] },
            ]}>
              <Text style={styles.saveButtonLabel}>
                {saving ? 'Saving…' : 'Save Annotation'}
              </Text>
            </Animated.View>
          </TouchableWithoutFeedback>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  topBarMeta: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  timestamp: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: C.darkGray },
  coordsBlock: { alignItems: 'flex-end' },
  coords: { fontFamily: 'Montserrat-Regular', fontSize: 12, color: C.darkGray, lineHeight: 17 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  annotationLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2, marginBottom: 6 },
  descriptionInput: { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.black, lineHeight: 20, minHeight: 48, marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eraserButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  eraserButtonActive: { backgroundColor: C.darkGray, borderColor: C.darkGray },
  eraserLabel: { fontFamily: 'Montserrat-Medium', fontSize: 13, color: C.lightGray },
  eraserLabelActive: { color: C.white },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.border },
  photoWrapper: { height: 260, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111', marginBottom: 20 },
  photoPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
  canvas: { ...StyleSheet.absoluteFillObject },
  eraserHint: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  eraserHintText: { fontFamily: 'Montserrat-Regular', fontSize: 11, color: C.white },
  sliderLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: C.black, letterSpacing: 0.3, marginBottom: 8 },
  sliderTrackWrap: { height: 28, justifyContent: 'center', marginBottom: 20 },
  hueTrack: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  opacityTrack: { height: 12, borderRadius: 6, overflow: 'hidden' },
  shapeTrack: { height: 12, borderRadius: 6, backgroundColor: '#eee', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2, overflow: 'hidden' },
  sliderThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: C.white, borderWidth: 2, borderColor: C.darkGray, marginLeft: -10, top: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  statusLabel: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: C.darkGray, textAlign: 'center', marginBottom: 12 },
  saveButton: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveButtonBusy: { backgroundColor: C.lightGray },
  saveButtonLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 16, color: C.white, letterSpacing: 0.3 },
});
