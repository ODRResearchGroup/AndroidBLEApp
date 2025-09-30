import React, {useState, useEffect} from 'react';
import {  Text,
  Button,
  FlatList,
  SafeAreaView,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View } from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';
import KeepAwake from 'react-native-keep-awake';

//this is the BLE screen where you can scan for and connect to BLE devices
//you can also read data from connected devices (for now enabled for specific characteristics of the ESS service and a custom service in eNose)
//for now it is only connected while on this screen, later we will maintain connection across screens

type Props = { navigation: any };
var base64 = require('base-64');

//ignore the styling for now, later we will apply a seprate stylesheet
// Define styles for the app... Sofia: I added SafeAreaView (adapts interface to notches etc)
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
  latestValue: {
    padding: 16,
    fontSize: 18,
    color: '#000000', // black text
  },
});

const BLELoggerApp = () => {
  // Initialize BLE manager
  const [manager] = useState(new BleManager());
  // State to store discovered devices
  const [devices, setDevices] = useState<Device[]>([]);
  // State to store the currently connected device
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  //Sofia: latest reading to be pasted in GUI
  const [latestValue, setLatestValue] = useState<string>('Waiting for data...');

  useEffect(() => {
    requestPermissions();
    return () => {
      manager.destroy(); // Clean up BLE manager on unmount
    };
  }, [manager]);

  // Request necessary permissions for BLE functionality
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // Required for BLE scanning
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, // Required for BLE scanning
      ];

      // Add additional permissions for Android 12+
      if (Platform.Version >= 31) {
        permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT); // Required for connecting to devices
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      // Warn if any permissions are not granted
      if (
        Object.values(granted).some(
          result => result !== PermissionsAndroid.RESULTS.GRANTED,
        )
      ) {
        console.warn('Required permissions not granted');
      }
    }
  };
  // Start scanning for BLE devices
  const scanForDevices = () => {
    manager.startDeviceScan(
      null, // No UUID filtering
      {allowDuplicates: false, scanMode: 2}, // Scan options
      (error, device) => {
        if (error) {
          console.error('Scan error:', error); // Log scan errors
          return;
        }

        if (device) {
          // Add the device to the list if it's not already present and has a name
          setDevices(prevDevices => {
            if (!prevDevices.find(d => d.id === device.id) && device.name) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      },
    );

    // Stop scanning after 5 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
    }, 5000);
  };

  // Connect to a selected BLE device
  const connectToDevice = async (device: Device) => {
    try {
      await device.connect(); // Establish connection
      await device.discoverAllServicesAndCharacteristics();
      await device.requestMTU(256);
 // Discover services and characteristics
      setConnectedDevice(device); // Update the connected device state
      console.log('Connected to', device.name || 'Unnamed Device');

      // Fetch and log services and characteristics
      const services = await device.services();
      for (const service of services) {
        console.log(`Service UUID: ${service.uuid}`);
        const characteristics = await service.characteristics();
        for (const characteristic of characteristics) {
          console.log(`  Characteristic UUID: ${characteristic.uuid}`);
        }
      }
    } catch (error) {
      console.error('Connection error:', error); // Log connection errors
    }
  };

  const [characteristicValues, setCharacteristicValues] = useState<{[key: string]: string}>({});

  // Subscribe to notifications for a specific characteristic of a connected device
const enableNotifications = async (
  device: Device,
  characteristics: { serviceUUID: string; characteristicUUID: string; label: string }[]
) => {
  for (const { serviceUUID, characteristicUUID, label } of characteristics) {
    console.log('Enabling notification for', label, serviceUUID, characteristicUUID);

    try {
      device.monitorCharacteristicForService(
  serviceUUID,
  characteristicUUID,
  (error, characteristic) => {
    if (error) {
      console.error('Notification error:', error);
      return;
    }

// Function to convert base64 string to float32 used for decoding characteristic values
//You can see it happening in the console logs when data is received
const base64ToFloat32 = (base64String: string): number => {
  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);
  return view.getFloat32(0, true); 
};
//Here you can see the conversion happening
//Raw value is received and converted
    const rawValue = characteristic?.value ?? '';
    const floatValue = base64ToFloat32(rawValue);

    setCharacteristicValues(prev => ({
      ...prev,
      [label]: floatValue.toFixed(3), // keep 3 decimals
    }));

    console.log(`${label}: ${floatValue}`);
  }
);
    } catch (error) {
      console.error('Enable notification error:', error);
    }
  }
};
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
      renderItem={({ item }) => (
        <Text onPress={() => connectToDevice(item)} style={styles.item}>
          {item.name || 'Unnamed Device'}
        </Text>
      )}
    />

<View style={styles.container}>
  {Object.entries(characteristicValues).map(([label, value]) => (
    <Text key={label} style={styles.latestValue}>
      {label}: {value}
    </Text>
  ))}
</View>
 {connectedDevice && (
  <Button
    title="Read Data"
    onPress={() => {
      enableNotifications(connectedDevice, [

//Here we are enabling notifications for characteristics within the ESS service
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
      //Here we are enabling notifications for characteristics within the custom service
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
      ]);
    }}
  />
)}

  </SafeAreaView>
);
}

export default BLELoggerApp;