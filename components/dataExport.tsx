import React from 'react';
import { View, Button, Alert } from 'react-native';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentDirectoryPath, writeFile } from 'react-native-fs';

/**
 * Component: DataExport
 * - Collects stored fingerprints from AsyncStorage (keys starting with 'sensor_fingerprint_')
 * - Writes them to a JSON file in the app document directory
 * - Opens the native share dialog to share the file
 */
/**
 * Programmatic export function
 * @param share - if true, will open the native share dialog after writing the file
 * @returns path to the written file
 */
export async function exportFingerprints(share = true): Promise<string> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const fingerprintKeys = keys.filter(k => k.startsWith('sensor_fingerprint_'));
    const pairs = await AsyncStorage.multiGet(fingerprintKeys);

    const parsed = pairs
      .map(([_, v]) => {
        if (!v) return null;
        try {
          return JSON.parse(v);
        } catch (e) {
          console.warn('Failed to parse stored fingerprint', e);
          return null;
        }
      })
      .filter(Boolean);

    const filename = `fingerprints_${Date.now()}.json`;
    const path = `${DocumentDirectoryPath}/${filename}`;

    await writeFile(path, JSON.stringify(parsed, null, 2), 'utf8');

    if (share) {
      const shareOptions = {
        title: 'Share file',
        failOnCancel: false,
        saveToFiles: true,
        urls: [path] as string[],
      };
      await Share.open(shareOptions);
    }

    return path;
  } catch (err: any) {
    console.error('Error exporting fingerprints:', err);
    throw err;
  }
}

const DataExport: React.FC = () => {
  const onShare = async () => {
    try {
      await exportFingerprints(true);
    } catch (err: any) {
      Alert.alert('Export failed', err?.message || String(err));
    }
  };

  return (
    <View style={{ padding: 8 }}>
      <Button title="Export Data" onPress={onShare} />
    </View>
  );
};

export default DataExport;