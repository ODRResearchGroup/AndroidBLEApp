import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  InteractionManager,
  Modal,
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
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {
  ArrowRight,
  CircleStop,
  FingerprintPattern,
  Play,
  X,
} from 'lucide-react-native';

type SensorValue = {label: string; value: number};

export default function SmellWalkScreen() {
  const {characteristicValues, connectedDevice} = useBLE();
  const {location, trail, isSmellWalkActive, startSmellWalk, stopSmellWalk} =
    useInfluxDB();
  const navigation = useNavigation<NavigationProp<{Device: undefined}>>();
  const [mapVisible, setMapVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          setMapVisible(true);
        }
      });

      return () => {
        cancelled = true;
        interaction.cancel();
        setMapVisible(false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const checkConnection = async () => {
        const connected =
          connectedDevice !== null &&
          (await connectedDevice.isConnected().catch(() => false));
        if (active) {
          setIsConnected(connected);
          setShowConnectionModal(!connected);
        }
      };

      checkConnection().catch(() => {
        if (active) {
          setIsConnected(false);
          setShowConnectionModal(true);
        }
      });

      return () => {
        active = false;
      };
    }, [connectedDevice]),
  );

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

  const requireConnectedDevice = async () => {
    const connected =
      connectedDevice !== null &&
      (await connectedDevice.isConnected().catch(() => false));
    if (!connected) {
      Alert.alert('e-nose not connected', 'Connect to the e-nose first.');
    }
    setIsConnected(connected);
    return connected;
  };

  const handleStartWalk = async () => {
    if (await requireConnectedDevice()) {
      startSmellWalk();
    }
  };

  const handleFingerprint = async () => {
    if (await requireConnectedDevice()) {
      setShowFingerprintModal(true);
    }
  };

  const goToDeviceScreen = () => {
    setShowConnectionModal(false);
    navigation.navigate('Device');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.mapPanel}>
        {mapVisible && <LiveLocationMap coordinates={location} trail={trail} />}
        {!location && (
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>Waiting for GPS</Text>
          </View>
        )}
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
            accessibilityState={{disabled: !isSmellWalkActive && !isConnected}}
            onPress={
              isSmellWalkActive
                ? handleStopWalk
                : isConnected
                ? handleStartWalk
                : goToDeviceScreen
            }
            style={({pressed}) => [
              styles.walkButton,
              isSmellWalkActive && styles.endButton,
              !isSmellWalkActive && !isConnected && styles.disabledButton,
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
            accessibilityState={{disabled: !isConnected}}
            style={({pressed}) => [
              styles.actionButton,
              styles.annotationButton,
              !isConnected && styles.disabledButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={isConnected ? handleFingerprint : goToDeviceScreen}>
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

      <Modal
        visible={showConnectionModal}
        transparent
        animationType="fade"
        onRequestClose={goToDeviceScreen}>
        <View style={styles.connectionModalBackdrop}>
          <View style={styles.connectionModalCard}>
            <View style={styles.connectionModalHeader}>
              <Text style={styles.connectionModalTitle}>
                Connect your e-nose
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close connection prompt"
                style={styles.connectionModalClose}
                onPress={() => setShowConnectionModal(false)}>
                <X color="#555" size={22} strokeWidth={2.5} />
              </Pressable>
            </View>
            <Text style={styles.connectionModalText}>
              Connect to the e-nose before starting a walk or taking a
              fingerprint.
            </Text>
            <Pressable
              style={styles.connectionModalButton}
              onPress={goToDeviceScreen}>
              <Text style={styles.buttonText}>Devices</Text>
              <ArrowRight color="#fff" size={20} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </Modal>
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
  disabledButton: {opacity: 0.45},
  buttonText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  connectionModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  connectionModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  connectionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionModalClose: {
    padding: 4,
  },
  connectionModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  connectionModalText: {marginTop: 10, color: '#555', lineHeight: 20},
  connectionModalButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
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
