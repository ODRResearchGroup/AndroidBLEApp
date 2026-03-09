import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Animated, TouchableWithoutFeedback,
  Image, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { listRecordings, updateRecordingTags, RecordingRow } from '../services/recordingsDb';
import { saveAnnotation } from '../services/annotationService';
import { usePressAnimation } from '../services/usePressAnimation';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  black: '#1A1A1A', darkGray: '#4D4D4D', lightGray: '#B3B3B3',
  white: '#FAFAFA', border: '#E0E0E0',
};

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

// Simple deterministic color from tag string (so same tag always looks the same)
function tagColor(tag: string): TagColor {
  const colors: TagColor[] = ['green','orange','pink','teal','yellow','lavender','sand'];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {hash = tag.charCodeAt(i) + ((hash << 5) - hash);}
  return colors[Math.abs(hash) % colors.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CardData = {
  recordingId: string;
  index: number;
  type: 'audio' | 'photo';
  timestamp: string;
  latitude: string;
  longitude: string;
  description: string;
  photoUri?: string | null;
  selectedTags: string[];
  suggestedTags: string[];
};

function rowToCard(row: RecordingRow, i: number): CardData {
  return {
    recordingId:  row.recordingId,
    index:        row.annotationIndex ?? (i + 1),
    type:         (row.type as 'audio' | 'photo') ?? 'audio',
    timestamp:    row.timestamp ?? '00:00:00',
    latitude:     row.latitude  ?? '00.0000° N',
    longitude:    row.longitude ?? '00.0000° E',
    description:  row.description ?? (row.transcriptJson
      ? (() => { try { const t = JSON.parse(row.transcriptJson!); return t.phrases?.map((p:any)=>p.text).join(' ') ?? ''; } catch { return ''; } })()
      : ''),
    photoUri:     row.photoUri,
    selectedTags:  row.selectedTagsJson  ? JSON.parse(row.selectedTagsJson)  : [],
    suggestedTags: row.suggestedTagsJson ? JSON.parse(row.suggestedTagsJson) : [],
  };
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

// ─── Edit icon button ─────────────────────────────────────────────────────────

function EditButton({ onPress }: { onPress: () => void }) {
  const { scale, handlers, fireHaptic } = usePressAnimation({ scaleTo: 0.80, haptic: 'light' });
  return (
    <TouchableWithoutFeedback onPress={() => { fireHaptic(); onPress(); }} {...handlers}
      hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.editIcon}>✎</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FAB({ onPress }: { onPress: () => void }) {
  const { scale, handlers, fireHaptic } = usePressAnimation({ scaleTo: 0.97, haptic: 'medium' });
  return (
    <View style={styles.fabContainer}>
      <TouchableWithoutFeedback onPress={() => { fireHaptic(); onPress(); }} {...handlers}>
        <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
          <Text style={styles.fabLabel}>Add New Note</Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

// ─── CardShell ────────────────────────────────────────────────────────────────

function CardShell({ card, onEdit, onRemove, onAdd, children }: {
  card: CardData;
  onEdit: () => void;
  onRemove: (tag: string) => void;
  onAdd:    (tag: string) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.timestamp}>{card.timestamp}</Text>
        <View style={styles.coordsBlock}>
          <Text style={styles.coords}>{card.latitude}</Text>
          <Text style={styles.coords}>{card.longitude}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.annotationRow}>
        <Text style={styles.annotationLabel}>ANNOTATION #{card.index}</Text>
        <EditButton onPress={onEdit} />
      </View>
      {children}
      <View style={styles.divider} />
      <Text style={styles.tagsLabel}>TAGS</Text>
      <View style={styles.selectedTagsWrap}>
        {card.selectedTags.map(t => (
          <TagPill key={t} label={t} mode="selected" onPress={() => onRemove(t)} />
        ))}
      </View>
      {card.suggestedTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedTagsRow}>
          {card.suggestedTags.map(t => (
            <TagPill key={t} label={t} mode="suggested" onPress={() => onAdd(t)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [cards,      setCards]      = useState<CardData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      const rows = await listRecordings(50);
      setCards(rows.map(rowToCard));
    } catch (e) {
      console.warn('Failed to load recordings:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the screen gains focus (after saving a new annotation)
  useFocusEffect(useCallback(() => { loadCards(); }, [loadCards]));

  const persistTagChange = async (recordingId: string, selected: string[], suggested: string[]) => {
    try {
      await updateRecordingTags(recordingId, selected, suggested);
      // Also patch cloud annotation so the card stays in sync
      const card = cards.find(c => c.recordingId === recordingId);
      if (card) {
        await saveAnnotation({
          recordingId,
          type:           card.type,
          description:    card.description,
          selectedTags:   selected,
          timestamp:      card.timestamp,
          latitude:       card.latitude,
          longitude:      card.longitude,
          photoUri:       card.photoUri ?? undefined,
          annotationIndex: card.index,
        });
      }
    } catch (e) { console.warn('Tag persist failed (non-fatal):', e); }
  };

  const handleRemoveTag = (recordingId: string, tag: string) => {
    setCards(prev => prev.map(c => {
      if (c.recordingId !== recordingId) {return c;}
      const next = {
        ...c,
        selectedTags:  c.selectedTags.filter(t => t !== tag),
        suggestedTags: c.suggestedTags.includes(tag) ? c.suggestedTags : [...c.suggestedTags, tag],
      };
      persistTagChange(recordingId, next.selectedTags, next.suggestedTags);
      return next;
    }));
  };

  const handleAddTag = (recordingId: string, tag: string) => {
    setCards(prev => prev.map(c => {
      if (c.recordingId !== recordingId) {return c;}
      const next = {
        ...c,
        selectedTags:  c.selectedTags.includes(tag) ? c.selectedTags : [...c.selectedTags, tag],
        suggestedTags: c.suggestedTags.filter(t => t !== tag),
      };
      persistTagChange(recordingId, next.selectedTags, next.suggestedTags);
      return next;
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.darkGray} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadCards(); }}
            tintColor={C.darkGray}
          />
        }
      >
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No annotations yet</Text>
            <Text style={styles.emptyBody}>Tap "Add New Note" to record your first smell walk entry.</Text>
          </View>
        ) : (
          cards.map(card => (
            <CardShell
              key={card.recordingId}
              card={card}
              onEdit={() => navigation.navigate('EditPhotoCard', { annotationId: card.recordingId })}
              onRemove={tag => handleRemoveTag(card.recordingId, tag)}
              onAdd={tag => handleAddTag(card.recordingId, tag)}
            >
              {card.type === 'photo' ? (
                <>
                  {card.description ? <Text style={styles.description}>{card.description}</Text> : null}
                  <View style={styles.photoContainer}>
                    {card.photoUri
                      ? <Image source={{ uri: card.photoUri }} style={styles.photo} resizeMode="cover" />
                      : <View style={styles.photoPlaceholder} />
                    }
                  </View>
                </>
              ) : (
                <Text style={styles.transcript}>{card.description}</Text>
              )}
            </CardShell>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB onPress={() => navigation.navigate('AddNote')} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: 'Montserrat-SemiBold', fontSize: 18, color: C.black, marginBottom: 10 },
  emptyBody:  { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.lightGray, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  timestamp: { fontFamily: 'Montserrat-Regular', fontSize: 13, color: C.darkGray, letterSpacing: 0.2 },
  coordsBlock: { alignItems: 'flex-end' },
  coords: { fontFamily: 'Montserrat-Regular', fontSize: 12, color: C.darkGray, lineHeight: 17 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  annotationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  annotationLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2 },
  editIcon: { fontSize: 20, color: C.darkGray, lineHeight: 24 },
  description: { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.black, lineHeight: 20, marginBottom: 12, textAlign: 'justify' },
  photoContainer: { borderRadius: 8, overflow: 'hidden', marginBottom: 14, backgroundColor: C.black, height: 200 },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: C.black },
  transcript: { fontFamily: 'Montserrat-Regular', fontSize: 14, color: C.black, lineHeight: 22, marginBottom: 14, textAlign: 'justify' },
  tagsLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 11, color: C.darkGray, letterSpacing: 1.2, marginBottom: 8 },
  selectedTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  suggestedTagsRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  tagPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  tagIcon:  { fontFamily: 'Montserrat-SemiBold', fontSize: 16, lineHeight: 18, marginTop: -1 },
  tagLabel: { fontFamily: 'Montserrat-Medium', fontSize: 13 },
  fabContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, backgroundColor: C.white, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 },
  fab: { backgroundColor: C.black, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  fabLabel: { fontFamily: 'Montserrat-SemiBold', fontSize: 16, color: C.white, letterSpacing: 0.3 },
});
