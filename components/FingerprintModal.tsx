import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useBLE } from '../BLEUniversal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentDirectoryPath, copyFile } from 'react-native-fs';
import useLiveLocation from '../util/useLiveLocation';
import { SensorEvent, emitter } from '../types';
import CameraModal from './CameraCapture';

type SavedFingerprintData = {
  fingerprint: SensorEvent;
  location: { latitude: number; longitude: number } | null;
  fingerprintTitle: { title: string };
  humanDescription: { description: string };
  photoPath?: string;
  timestamp: string;
};

interface FingerprintModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function FingerprintModal({ visible, onClose }: FingerprintModalProps) {
  const { characteristicValues } = useBLE();
  const { location } = useLiveLocation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedFingerprint, setCapturedFingerprint] = useState<SensorEvent | null>(null);

  // Create fingerprint snapshot
  const createFingerprint = (): SensorEvent => {
    const methane = characteristicValues['Methane'] || 0;
    const ammonia = characteristicValues['Ammonia'] || 0;
    const formaldehyde = characteristicValues['Formaldehyde'] || 0;
    const voc = characteristicValues['Voletile Organic Compounds'] || 0;
    const odour = characteristicValues['Odor'] || 0;
    const hydrogenSulfide = characteristicValues['Hydrogen Sulfide'] || 0;
    const ethanol = characteristicValues['Ethanol'] || 0;
    const nitrogenDioxide = characteristicValues['Nitrogen Dioxide'] || 0;

    return {
      type: 'sensor_reading',
      timestamp: new Date(),
      source: 'BLE Device',
      olfactoryData: {
        readings: {
          CH4: methane,
          NH3: ammonia,
          HCHO: formaldehyde,
          VOC: voc,
          Odour: odour,
          H2S: hydrogenSulfide,
          Etoh: ethanol,
          NO2: nitrogenDioxide,
        },
        units: {
          CH4: 'ppm',
          NH3: 'ppm',
          HCHO: 'ppm',
          VOC: 'ppm',
          Odour: 'a.u.',
          H2S: 'ppm',
          Etoh: 'ppm',
          NO2: 'ppm',
        },
      },
    };
  };

  // Handle photo capture
  const handlePhotoTaken = async (tempPhotoPath: string) => {
    const permanentPath = `${DocumentDirectoryPath}/fingerprint_${Date.now()}.jpg`;
    try {
      await copyFile(tempPhotoPath, permanentPath);
      setPhotoPath(permanentPath);
      Alert.alert('Photo captured', 'Photo added to fingerprint');
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert('Photo save failed', String(error));
    }
  };

  // Save fingerprint
  const handleSave = async () => {
    const fingerprint = capturedFingerprint || createFingerprint();

    const savedData: SavedFingerprintData = {
      fingerprint,
      location: location ?? null,
      fingerprintTitle: { title: title || 'Untitled' },
      humanDescription: { description: description || '' },
      photoPath: photoPath || undefined,
      timestamp: new Date().toISOString(),
    };

    emitter.emit('sensor_reading', fingerprint);

    const key = `sensor_fingerprint_${Date.now()}`;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(savedData));
      Alert.alert('Saved', 'Fingerprint saved successfully!');
      handleCancel();
    } catch (err) {
      console.error('Failed to save fingerprint:', err);
      Alert.alert('Save failed', String(err));
    }
  };

  // Cancel and reset
  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setPhotoPath(null);
    setCapturedFingerprint(null);
    onClose();
  };

  // Capture fingerprint snapshot when modal opens
  React.useEffect(() => {
    if (visible && !capturedFingerprint) {
      setCapturedFingerprint(createFingerprint());
    }
  }, [visible]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Fingerprint</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Input Card */}
            <View style={styles.inputCard}>
              <TextInput
                style={styles.titleInput}
                placeholder="Title"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
              />
              <View style={styles.divider} />
              <TextInput
                style={styles.descriptionInput}
                placeholder="Description"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Take Photo Button */}
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => setShowCamera(true)}
            >
              <Text style={styles.photoButtonText}>Take photo</Text>
              <View style={styles.photoIconContainer}>
                <Text style={styles.photoIcon}>📷</Text>
              </View>
            </TouchableOpacity>

            {/* Photo Preview */}
            {photoPath && (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: `file://${photoPath}` }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => setPhotoPath(null)}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Camera Modal */}
      <CameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onPhotoTaken={handlePhotoTaken}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cancelText: {
    fontSize: 16,
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'right',
  },
  inputCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#000',
    paddingVertical: 8,
    minHeight: 80,
  },
  photoButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#000',
  },
  photoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 18,
  },
  photoPreviewContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});