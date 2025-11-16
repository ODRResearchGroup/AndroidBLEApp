import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View, Text, ScrollView, Pressable, Button, Alert } from 'react-native';
import { SensorEvent } from '../types';
import { DocumentDirectoryPath, writeFile } from 'react-native-fs';
import Share from 'react-native-share';

//cretae state for any amount fo readings, make it unlimited or something
//then fetch the dtaa depending on what the user has selected. 
//withing history you could have the function for comparing
type SavedFingerprintData = {
  fingerprint: SensorEvent;
  location: { latitude: number; longitude: number } | null;
  humanDescription: { description: string };
    fingerprintTitle: {title: string};
  timestamp: string; 
};

type StoredItem = { key: string; data: SavedFingerprintData };


export default function FingerprintsHistory() {
  const [historical, setHistorical] = useState<SavedFingerprintData[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [items, setItems] = useState<StoredItem[]>([]);
  // expandedIndex controls single-item expansion

  // --- LOAD FINGERPRINTS ---
  useEffect(() => {
    const loadFingerprints = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const fingerprintKeys = keys.filter(k => k.startsWith("sensor_fingerprint_"));
        const savedData = await AsyncStorage.multiGet(fingerprintKeys);

        const parsedData = savedData
          .map(([_, value]) => (value ? JSON.parse(value) : null))
          .filter(item => item !== null) as SavedFingerprintData[];

        parsedData.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setHistorical(parsedData);
      } catch (err) {
        console.error("Error loading fingerprints:", err);
      }
    };

    loadFingerprints();
  }, []);

	const exportSelected = async () => {
		try {
			const selected = items.filter(i => selectedKeys.includes(i.key)).map(i => i.data);
			if (selected.length === 0) return Alert.alert('No selection', 'Please select fingerprints to export.');

			const filename = `fingerprints_selected_${Date.now()}.json`;
			const path = `${DocumentDirectoryPath}/${filename}`;
			await writeFile(path, JSON.stringify(selected, null, 2), 'utf8');

			await Share.open({ title: 'Share selected fingerprints', urls: [path], saveToFiles: true, failOnCancel: false });
		} catch (err: any) {
			console.error('Export selected failed', err);
			Alert.alert('Export failed', err?.message || String(err));
		}
	};

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Saved Fingerprints</Text>
        <Button title="Export Selected" onPress={exportSelected} />

      {/* Note: selection and comparison moved to Analysis tab */}

      {/* comparison moved to Analysis tab */}

      {/* --- LIST OF FINGERPRINTS --- */}
      {expandedIndex === null && historical.map((saved, idx) => {
        // If a card is expanded, render only that expanded view below (outside the map of items)
        return (
          <Pressable
            key={idx}
            onPress={() => setExpandedIndex(idx)}
            onLongPress={() => setExpandedIndex(idx)}
          >
            <View style={[styles.item, styles.card]}>
              <Text style={styles.cardTitle}>{saved.fingerprintTitle?.title || "Fingerprint"}</Text>
              <Text style={styles.cardText}>{saved.humanDescription?.description || "Description"}</Text>
              <Text style={styles.cardSmall}>{new Date(saved.timestamp).toLocaleString()}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Expanded single-fingerprint view */}
      {expandedIndex !== null && historical[expandedIndex] && (
        <View style={styles.expandedWrap}>
          <View style={styles.expandedCard}>
            <Pressable onPress={() => setExpandedIndex(null)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>

            <Text style={[styles.cardTitle, { marginTop: 8 }]}>
              {historical[expandedIndex].fingerprintTitle?.title || 'Fingerprint'}
            </Text>
            <Text style={styles.cardText}>{historical[expandedIndex].humanDescription?.description}</Text>

            <Text style={styles.sectionTitle}>Readings</Text>
            {Object.entries(historical[expandedIndex].fingerprint?.olfactoryData?.readings || {}).map(([key, value], i) => (
              <Text key={key}>
                {i + 1}. {key}: {value.toFixed(4)}
              </Text>
            ))}

            <Text style={styles.cardSmall}>{new Date(historical[expandedIndex].timestamp).toLocaleString()}</Text>
            <Text style={styles.cardSmall}>
              Location: {historical[expandedIndex].location?.latitude ?? '-'} {historical[expandedIndex].location?.longitude ?? ''}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  item: {
    marginBottom: 24,
  },
    card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 8,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
    cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
      cardText: { fontSize: 14, marginBottom: 6 },
        cardSmall: { fontSize: 12, color: '#666' },

        expandedWrap: { width: '100%', alignItems: 'center', marginTop: 12 },
        expandedCard: {
          width: '100%',
          backgroundColor: 'rgba(255,255,255,0.98)',
          padding: 16,
          borderRadius: 8,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        },
        backButton: { padding: 6 },
        backText: { color: '#007aff', fontSize: 14 },
        sectionTitle: { fontSize: 15, fontWeight: '600', marginTop: 10, marginBottom: 6 },
      });