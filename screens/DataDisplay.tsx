import React, {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Text,
  Button,
  ScrollView,
  TextInput,
} from 'react-native';
import {useBLE} from '../BLEUniversal';
import {
  VictoryChart,
  VictoryTheme,
  VictoryArea,
  VictoryPolarAxis,
} from 'victory-native';
import Slider from '@react-native-community/slider';
import {emitter} from '../types';

import Share from 'react-native-share';

import {SensorEvent} from '../types';
import {DocumentDirectoryPath, writeFile} from 'react-native-fs';
import useLiveLocation from '../util/useLiveLocation';

type savedFingerprintData = {
  fingerprint: SensorEvent;
  location: {latitude: number; longitude: number} | null;
  humanDescription: {description: string};
  timestamp: Date;
};

const DataDisplay = () => {
  const {characteristicValues} = useBLE();
  const {location} = useLiveLocation();
  const methane = characteristicValues.Methane || 0;
  const ammonia = characteristicValues.Ammonia || 0;
  const formaldehyde = characteristicValues.Formaldehyde || 0;
  const voc = characteristicValues['Voletile Organic Compounds'] || 0;
  const odour = characteristicValues.Odor || 0;
  const hydrogenSulfide = characteristicValues['Hydrogen Sulfide'] || 0;
  const ethanol = characteristicValues.Ethanol || 0;
  const nitrogenDioxide = characteristicValues['Nitrogen Dioxide'] || 0;

  const [zoomLevel, setZoomLevel] = useState(4);
  const [historicalfingerprints, setHistoricalfingerprints] = useState<
    savedFingerprintData[]
  >([]);
  const [showfingerprints, setShowfingerprints] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [description, setDescription] = useState('');

  // Transform BLE data for radar chart
  const radarData = [
    {label: '3. Ch4', value: methane},
    {label: '2. NH3', value: ammonia},
    {label: '1. HCHO', value: formaldehyde},
    {label: '8. VOC', value: voc},
    {label: '7. Odour', value: odour},
    {label: '6. H2S', value: hydrogenSulfide},
    {label: '5. Etoh', value: ethanol},
    {label: '4. No2', value: nitrogenDioxide},
  ].filter(item => !isNaN(item.value));

  useEffect(() => {
    const loadFingerprints = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const fingerprintKeys = keys.filter(k =>
          k.startsWith('sensor_fingerprint_'),
        );
        const savedData = await AsyncStorage.multiGet(fingerprintKeys);
        console.log(savedData);

        // Filter out null values before parsing
        const parsedData = savedData
          .map(([_, value]) => (value ? JSON.parse(value) : null))
          .filter(item => item !== null);

        setHistoricalfingerprints(parsedData as savedFingerprintData[]);
      } catch (err) {
        console.error('Error loading fingerprints:', err);
      }
    };

    loadFingerprints();
  }, []);

  const fingerprint: SensorEvent = {
  const saveFingerprint = async () => {
    const fingerprint: SensorEvent = {
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

    const savedData: savedFingerprintData = {
      fingerprint,
      location,
      humanDescription: {description},
      timestamp: new Date(),
    };
    emitter.emit('sensor_reading', fingerprint);

    const stringData = JSON.stringify(savedData);
    const key = `sensor_fingerprint_${savedData.timestamp.getTime()}`;

    try {
      await AsyncStorage.setItem(key, stringData);
      setHistoricalfingerprints(prev => [savedData, ...prev]);
      setShowTextInput(false);
      setDescription('');
    } catch (err) {
      console.error('Failed to save fingerprint:', err);
    }
  };
  const saveFile = async () => {
    const path = `${DocumentDirectoryPath}/${Date.now()}.json`;
    await writeFile(path, JSON.stringify(historicalfingerprints));
    return path;
  };

  const onShare = async () => {
    try {
      const path = await saveFile();
      console.log('saved');
      const shareOptions = {
        title: 'Share file',
        failOnCancel: false,
        saveToFiles: true,
        urls: [path],
        //here you need to mention saving file
      };
      const ShareResponse = await Share.open(shareOptions);
      console.log('Result =>', ShareResponse);
    } catch (error) {
      console.log('Error =>', error);
    }
  };

  return (
    <ScrollView>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Data Dashboard</Text>
        <VictoryChart
          polar
          theme={VictoryTheme.clean}
          domain={{y: [0, zoomLevel]}}>
          <VictoryPolarAxis
            dependentAxis
            labelPlacement="vertical"
            tickFormat={() => ''}
          />
          <VictoryPolarAxis labelPlacement="parallel" />
          <VictoryArea
            interpolation="linear"
            data={radarData.map(d => ({x: d.label, y: d.value}))}
          />
        </VictoryChart>

        <Slider
          style={{width: '50%', height: 40}}
          minimumValue={0.1}
          step={0.05}
          value={zoomLevel}
          onValueChange={setZoomLevel}
        />

        {!showTextInput ? (
          <Button title="Fingerprint" onPress={() => setShowTextInput(true)} />
        ) : (
          <View>
            <TextInput
              placeholder="I smelled..."
              value={description}
              onChangeText={setDescription}
            />
            <Button
              title="Save"
              onPress={() => {
                saveFingerprint();
                setShowTextInput(false); // hide input after saving
                saveFile();
              }}
            />
          </View>
        )}
        {/* this button is for sharing the data file, which we have to later put in view */}
        <Button onPress={onShare} title="Share" />
        {/* Show raw values for reference */}
        <View style={styles.values}>
          {radarData.map((item, index) => (
            <Text key={item.label}>
              {index + 1}. {item.label}: {item.value.toFixed(4)}
            </Text>
          ))}
        </View>
        <Button
          title={showfingerprints ? 'Hide Fingerprints' : 'Show Fingerprints'}
          onPress={() => setShowfingerprints(prev => !prev)}
        />

        {/* Historical fingerprints */}

        {/* Here we are rendering the fingerprint data using victory native visualisation chart */}
        {showfingerprints && (
          <View style={{width: '100%', marginTop: 20}}>
            {historicalfingerprints.map((saved, idx) => {
              const sensorReadings = saved.fingerprint?.olfactoryData?.readings;

              return (
                <View key={idx} style={[styles.container, {marginBottom: 30}]}>
                  <Text>{new Date(saved.timestamp).toLocaleString()}</Text>
                  <VictoryChart
                    polar
                    theme={VictoryTheme.clean}
                    domain={{y: [0, 4]}}>
                    <VictoryPolarAxis
                      dependentAxis
                      labelPlacement="vertical"
                      tickFormat={() => ''}
                    />
                    <VictoryPolarAxis labelPlacement="parallel" />
                    <VictoryArea
                      interpolation="catmullRom"
                      data={Object.entries(sensorReadings || {}).map(
                        ([label, value]) => ({
                          x: label,
                          y: value,
                        }),
                      )}
                    />
                  </VictoryChart>
                  {sensorReadings &&
                    Object.entries(sensorReadings).map(
                      ([key, value], index) => (
                        <Text key={key}>
                          {index + 1}. {key}: {value.toFixed(4)}
                        </Text>
                      ),
                    )}

                  <Text>
                    Description: {saved.humanDescription?.description}
                  </Text>
                  <Text>
                    {' '}
                    Location: {saved.location?.latitude}{' '}
                    {saved.location?.longitude}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </SafeAreaView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  values: {
    marginTop: 20,
  },
});

export default DataDisplay;
