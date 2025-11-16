import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, Text, Button, ScrollView, TextInput, Alert } from 'react-native';
import { useBLE } from '../BLEUniversal';
import { VictoryChart, VictoryTheme, VictoryArea, VictoryPolarAxis } from 'victory-native';
import Slider from '@react-native-community/slider';
import { emitter } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentDirectoryPath, writeFile } from 'react-native-fs';
import useLiveLocation from '../util/useLiveLocation';
import { SensorEvent } from '../types';
import { exportFingerprints } from './dataExport';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Pinch from '../components/pinchtoZoom';

type SavedFingerprintData = {
  fingerprint: SensorEvent;
  location: { latitude: number; longitude: number } | null;
  fingerprintTitle: {title: string};
  humanDescription: { description: string };
  timestamp: string;
};

export default function LiveData() {
  const { characteristicValues } = useBLE();
  const { location } = useLiveLocation();


  const methane = characteristicValues['Methane'] || 0;
  const ammonia = characteristicValues['Ammonia'] || 0;
  const formaldehyde = characteristicValues['Formaldehyde'] || 0;
  const voc = characteristicValues['Voletile Organic Compounds'] || 0;
  const odour = characteristicValues['Odor'] || 0;
  const hydrogenSulfide = characteristicValues['Hydrogen Sulfide'] || 0;
  const ethanol = characteristicValues['Ethanol'] || 0;
  const nitrogenDioxide = characteristicValues['Nitrogen Dioxide'] || 0;

  const [zoomLevel, setZoomLevel] = useState(4);
  const [showTextInput, setShowTextInput] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capturedFingerprint, setCapturedFingerprint] = useState<SensorEvent | null>(null);

  const radarData = [
    { label: '3. Ch4', value: methane },
    { label: '2. NH3', value: ammonia },
    { label: '1. HCHO', value: formaldehyde },
    { label: '8. VOC', value: voc },
    { label: '7. Odour', value: odour },
    { label: '6. H2S', value: hydrogenSulfide },
    { label: '5. Etoh', value: ethanol },
    { label: '4. No2', value: nitrogenDioxide },
  ].filter(item => !isNaN(item.value));

  const createFingerprint = (): SensorEvent => {
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
          CH4: 'ppm', NH3: 'ppm', HCHO: 'ppm', VOC: 'ppm', Odour: 'a.u.', H2S: 'ppm', Etoh: 'ppm', NO2: 'ppm',
        },
      },
    };
  };

  const saveFingerprint = async () => {
    if (!capturedFingerprint) return;

    const savedData: SavedFingerprintData = {
      fingerprint: capturedFingerprint,
      location: location ?? null,
      fingerprintTitle: { title },
      humanDescription: { description },
      timestamp: new Date().toISOString(),
    };

    emitter.emit('sensor_reading', capturedFingerprint);

    const key = `sensor_fingerprint_${Date.now()}`;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(savedData));
      setShowTextInput(false);
      setTitle('');
      setDescription('');
      setCapturedFingerprint(null);
      Alert.alert('Saved', 'Fingerprint saved!');
    } catch (err) {
      console.error('Failed to save fingerprint:', err);
      Alert.alert('Save failed', String(err));
    }
  };

  const saveFile = async () => {
    const path = `${DocumentDirectoryPath}/${Date.now()}.json`;
    // For convenience we just create a small export of current radar data
    await writeFile(path, JSON.stringify(radarData, null, 2), 'utf8');
    return path;
  };

  return (
    <ScrollView>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Live Data</Text>




        <VictoryChart polar theme={VictoryTheme.clean} domain={{ y: [0.01, zoomLevel] }}>
          <VictoryPolarAxis dependentAxis labelPlacement="vertical" tickFormat={() => ''} />
          <VictoryPolarAxis labelPlacement="parallel" />
          <VictoryArea interpolation="linear" data={radarData.map(d => ({ x: d.label, y: d.value }))} />
        </VictoryChart>

        <Slider style={{ width: '50%', height: 40 }} minimumValue={0.1} step={0.05} value={zoomLevel} onValueChange={setZoomLevel} />

        {!showTextInput ? (
          <Button title="Fingerprint" onPress={() => {
            setCapturedFingerprint(createFingerprint());
            setShowTextInput(true);
          }} />
        ) : (
          <View>
            <TextInput placeholderTextColor="#7f97deff" placeholder="Title" value={title} onChangeText={setTitle} />
            <TextInput placeholderTextColor="#7f97deff" placeholder="I smelled..." value={description} onChangeText={setDescription} />
            <Button title="Save" onPress={saveFingerprint} />
          </View>
        )}

        <Button
          onPress={() => exportFingerprints(true).catch(err => Alert.alert('Export failed', err?.message || String(err)))}
          title="Share"
        />

        <View style={styles.values}>
          {radarData.map((item, i) => (
            <Text key={item.label}>{i + 1}. {item.label}: {item.value.toFixed(4)}</Text>
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  values: { marginTop: 20 },
});

