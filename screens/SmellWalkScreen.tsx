import React, {useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useBLE} from '../BLEUniversal';
import FingerprintModal from '../components/FingerprintModal';
import LiveLocationMap from '../components/LiveLocationMap';
import {useInfluxDB} from '../services/InfluxDBService';
import {CircleStop, FingerprintPattern, Play} from 'lucide-react-native';

type SensorValue = {label: string; value: number};

export default function SmellWalkScreen() {
  const {characteristicValues} = useBLE();
  const {location, trail, isSmellWalkActive, startSmellWalk, stopSmellWalk} =
    useInfluxDB();
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);

  const sensorValues = useMemo<SensorValue[]>(
    () => [
      {label: 'CH4', value: characteristicValues.Methane || 0},
      {label: 'NH3', value: characteristicValues.Ammonia || 0},
      {label: 'HCHO', value: characteristicValues.Formaldehyde || 0},
      {
        label: 'VOC',
        value: characteristicValues['Voletile Organic Compounds'] || 0,
      },
      {label: 'Odour', value: characteristicValues.Odor || 0},
      {label: 'H2S', value: characteristicValues['Hydrogen Sulfide'] || 0},
      {label: 'Etoh', value: characteristicValues.Ethanol || 0},
      {label: 'NO2', value: characteristicValues['Nitrogen Dioxide'] || 0},
    ],
    [characteristicValues],
  );

  const handleStopWalk = () => {
    stopSmellWalk().catch(error => {
      Alert.alert('Could not end smell walk', String(error));
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.mapPanel}>
        <LiveLocationMap coordinates={location} trail={trail} />
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            {trail.length > 1
              ? `${trail.length} GPS points`
              : 'Waiting for GPS'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Smell Walk</Text>
            <Text style={styles.status}>
              {isSmellWalkActive
                ? 'Recording data every 5 seconds'
                : 'Ready to record'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isSmellWalkActive ? 'End smell walk' : 'Start smell walk'
            }
            accessibilityHint={
              isSmellWalkActive
                ? 'Stops recording and sends the final sample'
                : 'Begins recording sensor data and your GPS trail'
            }
            onPress={isSmellWalkActive ? handleStopWalk : startSmellWalk}
            style={({pressed}) => [
              styles.walkButton,
              isSmellWalkActive && styles.endButton,
              pressed && styles.buttonPressed,
            ]}>
            {isSmellWalkActive ? (
              <CircleStop color="#fff" size={21} strokeWidth={2.5} />
            ) : (
              <Play color="#fff" size={21} strokeWidth={2.5} />
            )}
            <Text style={styles.buttonText}>
              {isSmellWalkActive ? 'End walk' : 'Start walk'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create fingerprint"
            accessibilityHint="Opens the fingerprint annotation form"
            style={({pressed}) => [
              styles.actionButton,
              styles.annotationButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setShowFingerprintModal(true)}>
            <FingerprintPattern color="#fff" size={20} strokeWidth={2.25} />
            <Text style={styles.buttonText}>Fingerprint</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Live Sensors</Text>
        <View style={styles.sensorGrid}>
          {sensorValues.map(sensor => (
            <View key={sensor.label} style={styles.sensorCell}>
              <Text style={styles.sensorLabel}>{sensor.label}</Text>
              <Text style={styles.sensorValue}>{sensor.value.toFixed(4)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.locationText}>
          {location
            ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
                6,
              )}`
            : 'GPS location unavailable'}
        </Text>
      </ScrollView>

      <FingerprintModal
        visible={showFingerprintModal}
        onClose={() => setShowFingerprintModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#fff'},
  mapPanel: {flex: 1, minHeight: 280, position: 'relative'},
  mapBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  mapBadgeText: {fontSize: 12, color: '#333', fontWeight: '600'},
  contentScroll: {flexGrow: 0, flexShrink: 1},
  content: {padding: 18, paddingBottom: 28},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {fontSize: 24, fontWeight: '700', color: '#111'},
  status: {fontSize: 13, color: '#666', marginTop: 4},
  actions: {gap: 10, marginTop: 16},
  walkButton: {
    minWidth: 135,
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 24,
  },
  buttonPressed: {opacity: 0.65, transform: [{scale: 0.94}]},
  actionButton: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 13,
  },
  endButton: {backgroundColor: '#b42318'},
  annotationButton: {backgroundColor: '#2563eb'},
  buttonText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#111', marginTop: 22},
  sensorGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  sensorCell: {
    width: '23%',
    minWidth: 72,
    backgroundColor: '#f1f3f5',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sensorLabel: {fontSize: 12, color: '#555', fontWeight: '600'},
  sensorValue: {fontSize: 13, color: '#111', marginTop: 4},
  locationText: {fontSize: 12, color: '#666', marginTop: 16},
});
