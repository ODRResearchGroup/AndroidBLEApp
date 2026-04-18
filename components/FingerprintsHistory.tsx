import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SensorEvent } from '../types';
import { SavedFingerprintData, SensorReadings, StoredItem as StoredItemType } from './sharedTypes';
import ExpandedFingerprintView from '../components/ExpandedFingerprintView';
import ComparisonView from '../components/ComparisonView';

type StoredItem = StoredItemType;

export default function FingerprintsHistory() {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Load fingerprints
  useEffect(() => {
    const loadFingerprints = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const fingerprintKeys = keys.filter(k => k.startsWith('sensor_fingerprint_'));
        const pairs = await AsyncStorage.multiGet(fingerprintKeys);

        const parsed: StoredItem[] = pairs
          .map(([key, value]) => ({ key, data: value ? JSON.parse(value) : null }))
          .filter(item => item.data !== null) as StoredItem[];

        parsed.sort((a, b) => new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime());
        setItems(parsed);
      } catch (err) {
        console.error('Error loading fingerprints:', err);
      }
    };

    loadFingerprints();
  }, []);

  // Toggle selection mode
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedKeys([]);
  };

  // Toggle individual selection
  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  // Handle fingerprint click (browse or select)
  const handleFingerprintPress = (index: number, key: string) => {
    if (isSelectMode) {
      toggleSelect(key);
    } else {
      setExpandedIndex(index);
    }
  };

  // If showing comparison, render ComparisonView
  if (showComparison) {
    const selectedItems = items.filter(i => selectedKeys.includes(i.key));
    return (
      <ComparisonView
        selectedItems={selectedItems}
        onBack={() => setShowComparison(false)}
      />
    );
  }

  // If expanded, show detail view
  if (expandedIndex !== null && items[expandedIndex]) {
    return (
      <ExpandedFingerprintView
        data={items[expandedIndex].data}
        onBack={() => setExpandedIndex(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        
        

        <View style={styles.headerButtons}>
          {!isSelectMode ? (
            <Pressable style={styles.selectButton} onPress={toggleSelectMode}>
              <Text style={styles.selectButtonText}>Select</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.cancelButton} onPress={toggleSelectMode}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.analyseButton, selectedKeys.length < 2 && styles.disabledButton]}
                onPress={() => setShowComparison(true)}
                disabled={selectedKeys.length < 2}
              >
                <Text style={styles.analyseButtonText}>analyse</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Fingerprints List */}
      <ScrollView style={styles.listSection} contentContainerStyle={styles.listContent}>
        {items.map((item, idx) => {
          const isSelected = selectedKeys.includes(item.key);

          return (

            
            <Pressable
              key={item.key}
              onPress={() => handleFingerprintPress(idx, item.key)}
              style={[
                styles.fingerprintCard,
                isSelectMode && isSelected && styles.selectedCard,
              ]}
            >
              <View style={styles.cardContent}>
                {/* Selection Circle (only in select mode) */}
                {isSelectMode && (
                  <View style={styles.selectionCircle}>
                    {isSelected ? (
                      <View style={styles.selectedCircle}>
                        <View style={styles.selectedCircleInner} />
                      </View>
                    ) : (
                      <View style={styles.unselectedCircle} />
                    )}
                  </View>
                )}

                {/* Text content */}
                <View style={styles.textContent}>
                  <Text style={styles.cardTitle}>
                    {item.data.fingerprintTitle?.title || `Fingerprint 01`}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {item.data.humanDescription?.description || 'Capture fingerprints and view the live data'}
                  </Text>
                  {item.data.deltaReadings && (
                    <Text style={styles.deltaText}>
                      Δ CH4: {Number(item.data.deltaReadings.CH4).toFixed(4)}
                    </Text>
                  )}
                </View>

                {/* Thumbnail image */}
                <View style={styles.thumbnailContainer}>
                  {item.data.photoPath ? (
                    <Image
                      source={{ uri: `file://${item.data.photoPath}` }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder} />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No fingerprints saved yet</Text>
            <Text style={styles.emptySubtext}>Create a fingerprint to get started</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const GUTTER = 20;
const MARGIN = 20;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  selectButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  analyseButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#000',
  },
  analyseButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.4,
  },
  listSection: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: MARGIN,
    paddingBottom: 100,
  },
  fingerprintCard: {
    marginBottom: GUTTER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  selectedCard: {
    backgroundColor: '#f0f0f0',
    borderColor: '#000',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  selectionCircle: {
    marginRight: 12,
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
  },
  selectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  textContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  deltaText: {
    marginTop: 6,
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});