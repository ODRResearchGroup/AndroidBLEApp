import React, { useState } from 'react';
import {
  Text,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  View,
  Pressable,
  Alert,
} from 'react-native';
import {Device} from 'react-native-ble-plx';
import KeepAwake from 'react-native-keep-awake';
import {useBLE} from '../BLEUniversal'; // adjust relative path

//this is the BLE screen where you can scan for and connect to BLE devices
//you can also read data from connected devices
//connection state is now maintained globally via BLEProvider

//ignore the styling for now, later we will apply a seprate stylesheet
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eaeaea', // light gray background
  },
  container: {
    padding: 24,
    backgroundColor: '#eaeaea',
  },
  item: {
    padding: 12,
    fontSize: 16,
    color: '#000000', // black text
  },
  selectedItem: {
    backgroundColor: '#d0f0ff',
    borderRadius: 6,
    padding: 12,
  },
  latestValue: {
    padding: 16,
    fontSize: 18,
    color: '#000000', // black text
  },
});

const BLELoggerApp = () => {
  // Get everything from the global BLE hook
  const {
    devices,
    connectedDevice,
    scanForDevices,
    connectToDevice,
    enableNotifications,
    characteristicValues,
  } = useBLE();

  // local UI state for selecting a device before connecting
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Reusable notification specification list used when connecting
  const notificationSpecs = [
    // ESS service
    {
      serviceUUID: '0000181a-0000-1000-8000-00805f9b34fb',
      characteristicUUID: '00002bd1-0000-1000-8000-00805f9b34fb',
      label: 'Methane',
    },
    {
      serviceUUID: '0000181a-0000-1000-8000-00805f9b34fb',
      characteristicUUID: '00002bd2-0000-1000-8000-00805f9b34fb',
      label: 'Nitrogen Dioxide',
    },
    {
      serviceUUID: '0000181a-0000-1000-8000-00805f9b34fb',
      characteristicUUID: '00002bd3-0000-1000-8000-00805f9b34fb',
      label: 'Voletile Organic Compounds',
    },
    {
      serviceUUID: '0000181a-0000-1000-8000-00805f9b34fb',
      characteristicUUID: '00002bcf-0000-1000-8000-00805f9b34fb',
      label: 'Ammonia',
    },
    // Custom service
    {
      serviceUUID: 'de664a17-7db4-449f-97ba-5514e19a9d94',
      characteristicUUID: '6a135b89-f360-4f64-86fc-5a14092034b4',
      label: 'Formaldehyde',
    },
    {
      serviceUUID: 'de664a17-7db4-449f-97ba-5514e19a9d94',
      characteristicUUID: '4c28fcb8-d69b-404a-8668-41655d814e7f',
      label: 'Odor',
    },
    {
      serviceUUID: 'de664a17-7db4-449f-97ba-5514e19a9d94',
      characteristicUUID: 'f8156843-6d98-4ba2-8014-1cf03d7dedb8',
      label: 'Ethanol',
    },
    {
      serviceUUID: 'de664a17-7db4-449f-97ba-5514e19a9d94',
      characteristicUUID: '87dc71bd-29a4-4218-a2a7-83fd2a69cc40',
      label: 'Hydrogen Sulfide',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeepAwake />

      {/* Button to start scanning for devices */}
      <Button title="Scan for Devices" onPress={scanForDevices} />

      {/* List of discovered devices */}
      <FlatList
        style={styles.container}
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <Pressable
            onPress={() => setSelectedDeviceId(item.id)}
            style={({ pressed }) => [
              styles.item,
              selectedDeviceId === item.id && styles.selectedItem,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text>{item.name || 'Unnamed Device'}</Text>
          </Pressable>
        )}
      />



      {/* Show connect button when a device is selected */}
      {selectedDeviceId && (
        <View style={{ padding: 8 }}>
          <Button
            title="Connect"
            onPress={async () => {
              const selected = devices.find(d => d.id === selectedDeviceId);
              if (!selected) return Alert.alert('Device not found');

              try {
                await connectToDevice(selected as Device);
                // enable notifications immediately after successful connect
                await enableNotifications(selected as Device, notificationSpecs);
                setSelectedDeviceId(null);
                Alert.alert('Connected', `${selected.name || 'Device'} connected and notifications enabled.`);
              } catch (err: any) {
                console.error('Connect+notify error:', err);
                Alert.alert('Connection failed', err?.message || String(err));
              }
            }}
          />
        </View>
      )}

      {/* Live values */}
      
      <View style={styles.container}>
        {Object.entries(characteristicValues).map(([label, value]) => (
          <Text key={label} style={styles.latestValue}>
            {label}: {value.toFixed(2)}
          </Text>
        ))}
      </View>

      {/* Previously there was a manual 'Activate Sensors' button; notifications are now enabled automatically on Connect */}
    </SafeAreaView>
  );
};

export default BLELoggerApp;
