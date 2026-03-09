import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Animated, TouchableWithoutFeedback,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { ArrowLeft } from 'lucide-react-native';
import { loadAnnotation, saveAnnotation, AnnotationRecord } from '../services/annotationService';
import { getRecording, updateRecordingTags } from '../services/recordingsDb';
import { usePressAnimation } from '../services/usePressAnimation';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = { black: '#1A1A1A', darkGray: '#4D4D4D', lightGray: '#B3B3B3', white: '#FAFAFA', border: '#E0E0E0' };

type TagColor = 'green' | 'orange' | 'pink' | 'teal' | 'yellow' | 'lavender' | 'sand';
const TAG_PALETTE: Record<TagColor, { bg: string; border: string; text: string }> = {
  green:    { bg: '#D6EDD6', border: '#7DC47D', text: '#3A7A3A' },
  orange:   { bg: '#FDEBD0', border: '#E8A96A', text: '#9A5C1A' },
  pink:     { bg: '#FADDE1', border: '#E88A9A', text: '#9A2A3A' },
  teal:     { bg: '#D6EDEA', border: '#6DBFB8', text: '#1A6B65' },
  yellow:   { bg: '#FDF8D0', border: '#D4C84A', text: '#7A6A00' },
  lavender: { bg: '#E5E0F5', border: '#9B8FD4', text: '#3D2E8A' },
  sand:     { bg: '#F0EAD6', border: '#C4A96A', text: '#6B4E1A' },
};

function tagColor(tag: string): TagColor {
  const colors: TagColor[] = ['green','orange','pink','teal','yellow','lavender','sand'];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {hash = tag.charCodeAt(i) + ((hash << 5) - hash);}
  return colors[Math.abs(hash) % colors.length];
}

// ─── TagPill ──────────────────────────────────────────────────────────────────

function TagPill({ label, mode, onPress }: { label: string; mode: 'selected' | 'suggested'; onPress: () => void }) {
  const p = TAG_PALETTE[tagColor(label)];
  const { scale, handlers, fireHaptic } = usePressAnimation({ scaleTo: 0.88, haptic: 'light' });
  return (
    <TouchableWithoutFeedback onPress={() => { fireHaptic(); onPress(); }} {...handlers}>
      <Animated.View style={[styles.tagPill, { backgroundColor: p.bg, borderColor: p.border, transform: [{ scale }] }]}>
        <Text style={[styles.tagIcon,  { color: p.text }]}>{mode === 'selected' ? '−' : '+'}</Text>
        <Text style={[styles.tagLabel, { color: p.text }]}>{label}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'EditPhotoCard'>;

export default function EditPhotoCardScreen({ navigation, route }: Props) {
  const { annotationId } = route.params;

  const [annotation,     setAnnotation]     = useState<AnnotationRecord | null>(null);
  const [selectedTags,   setSelectedTags]   = useState<string[]>([]);
  const [suggestedTags,  setSuggestedTags]  = useState<string[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);

  // ── Load annotation ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        // Try cloud first, fall back to SQLite
        let ann = await loadAnnotation(annotationId);

        if (!ann) {
          // Construct from SQLite row
          const row = await getRecording(annotationId);
          if (row) {
            ann = {
              annotationId,
              recordingId:    annotationId,
              type:           (row.type as 'audio' | 'photo') ?? 'audio',
              description:    row.description ?? '',
              selectedTags:   row.selectedTagsJson  ? JSON.parse(row.selectedTagsJson)  : [],
              suggestedTags:  row.suggestedTagsJson ? JSON.parse(row.suggestedTagsJson) : [],
              timestamp:      row.timestamp ?? '00:00:00',
              latitude:       row.latitude  ?? '00.0000° N',
              longitude:      row.longitude ?? '00.0000° E',
              annotationIndex: row.annotationIndex ?? 1,
              savedAt:        new Date(row.createdAt).toISOString(),
              schema:         'annotation_v1',
            } as AnnotationRecord & { suggestedTags: string[] };
          }
        }

        if (ann) {
          setAnnotation(ann);
          setSelectedTags(ann.selectedTags ?? []);
          // suggestedTags may not exist on the cloud blob — pull from SQLite
          const row = await getRecording(annotationId);
          const suggested = row?.suggestedTagsJson ? JSON.parse(row.suggestedTagsJson) : [];
          // Remove any that are already selected
          setSuggestedTags(suggested.filter((t: string) => !(ann!.selectedTags ?? []).includes(t)));
        }
      } catch (e) {
        console.warn('Failed to load annotation:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [annotationId]);

  // ── Tag mutations ──────────────────────────────────────────────────────────

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(p => p.filter(t => t !== tag));
    setSuggestedTags(p => p.includes(tag) ? p : [...p, tag]);
  };

  const handleAddTag = (tag: string) => {
    setSuggestedTags(p => p.filter(t => t !== tag));
    setSelectedTags(p => p.includes(tag) ? p : [...p, tag]);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!annotation || saving) {return;}
    setSaving(true);
    try {
      // Persist to SQLite
      await updateRecordingTags(annotationId, selectedTags, suggestedTags);

      // Overwrite cloud annotation with updated tags
      await saveAnnotation({
        recordingId:    annotation.recordingId,
        type:           annotation.type,
        description:    annotation.description,
        strokes:        annotation.strokes,
        selectedTags,
        timestamp:      annotation.timestamp,
        latitude:       annotation.latitude,
        longitude:      annotation.longitude,
        photoUri:       annotation.photoUri,
        annotationIndex: annotation.annotationIndex,
      });

      navigation.navigate('Home');
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Animations ─────────────────────────────────────────────────────────────

  const backAnim = usePressAnimation({ scaleTo: 0.80, haptic: 'light' });
  const saveAnim = usePressAnimation({ scaleTo: 0.97, haptic: 'medium' });

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.darkGray} />
        </View>
      </SafeAreaView>
    );
  }

  if (!annotation) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Annotation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableWithoutFeedback
              onPress={() => { backAnim.fireHaptic(); navigation.goBack(); }}
              {...backAnim.handlers}
              hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
              <Animated.View style={{ transform: [{ scale: backAnim.scale }] }}>
                <ArrowLeft size={20} color={C.darkGray} strokeWidth={2} />
              </Animated.View>
            </TouchableWithoutFeedback>
            <View style={styles.topBarMeta}>
              <Text style={styles.timestamp}>{annotation.timestamp}</Text>
              <View style={styles.coordsBlock}>
                <Text style={styles.coords}>{annotation.latitude}</Text>
                <Text style={styles.coords}>{annotation.longitude}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.annotationLabel}>ANNOTATION #{annotation.annotationIndex}</Text>
          {!!annotation.description && (
            <Text style={styles.description}>{annotation.description}</Text>
          )}

          {/* Photo placeholder — TODO: render from Azure Blob SAS read URL */}
          {annotation.type === 'photo' && (
            <View style={styles.photoPlaceholder} />
          )}

          <View style={styles.divider} />
          <Text style={styles.tagsLabel}>TAGS</Text>

          {/* Selected tags — wrapping */}
          <View style={styles.selectedTagsWrap}>
            {selectedTags.map(tag => (
              <TagPill key={tag} label={tag} mode="selected" onPress={() => handleRemoveTag(tag)} />
            ))}
            {selectedTags.length === 0 && (
              <Text style={styles.noTagsHint}>No tags selected. Add from suggestions below.</Text>
            )}
          </View>

          {/* Suggested tags — horizontal scroll */}
          {suggestedTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedTagsRow}>
              {suggestedTags.map(tag => (
                <TagPill key={tag} label={tag} mode="suggested" onPress={() => handleAddTag(tag)} />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Fixed save FAB */}
      <View style={styles.fabContainer}>
        <TouchableWithoutFeedback onPress={handleSave} {...saveAnim.handlers} disabled={saving}>
          <Animated.View style={[styles.fab, saving && styles.fabBusy, { transform: [{ scale: saveAnim.scale }] }]}>
            <Text style={styles.fabLabel}>{saving ? 'Saving…' : 'Save & Go Home'}</Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.darkGray },
  scrollContent: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  topBarMeta: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  timestamp: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: C.darkGray },
  coordsBlock: { alignItems: 'flex-end' },
  coords: { fontFamily: 'Montserrat-Regular', fontSize: 12, color: C.darkGray, lineHeight: 17 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  annotationLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2, marginBottom: 6 },
  description: { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.black, lineHeight: 20, marginBottom: 12, textAlign: 'justify' },
  photoPlaceholder: { height: 200, borderRadius: 8, backgroundColor: C.black, marginBottom: 14 },
  tagsLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2, marginBottom: 8 },
  noTagsHint: { fontFamily: 'Montserrat-Regular', fontSize: 12, color: C.lightGray, fontStyle: 'italic' },
  selectedTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, minHeight: 32 },
  suggestedTagsRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tagPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  tagIcon:  { fontFamily: 'Montserrat-SemiBold', fontSize: 16, lineHeight: 18, marginTop: -1 },
  tagLabel: { fontFamily: 'Montserrat-Medium', fontSize: 13 },
  fabContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, backgroundColor: C.white, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 },
  fab: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  fabBusy: { backgroundColor: C.lightGray },
  fabLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 16, color: C.white, letterSpacing: 0.3 },
});
