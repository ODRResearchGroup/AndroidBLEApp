import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
} from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';
import KeepAwake from 'react-native-keep-awake';
var base64 = require('base-64');

// Define styles for the app
const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#eaeaea',
  },
  item: {
    padding: 12,
    fontSize: 16,
  },
});

const BLELoggerApp = () => {
  // Initialize BLE manager
  const [manager] = useState(new BleManager());
  // State to store discovered devices
  const [devices, setDevices] = useState<Device[]>([]);
  // State to store the currently connected device
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  // Request permissions when the component mounts
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
      await device.discoverAllServicesAndCharacteristics(); // Discover services and characteristics
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

  // // Read data from a specific characteristic of a connected device
  // const readData = async (
  //   device: Device,
  //   serviceUUID: string,
  //   characteristicUUID: string,
  // ) => {
  //   console.log('Reading data from:', device, serviceUUID, characteristicUUID); // Log data to the console
  //   try {
  //     const characteristic = await device.readCharacteristicForService(
  //       serviceUUID,
  //       characteristicUUID,
  //     );
  //     logData(characteristic.value); // Log the read data
  //   } catch (error) {
  //     console.error('Read error:', error); // Log read errors
  //   }
  // };

  // Subscribe to notifications for a specific characteristic of a connected device
  const enableNotifications = async (
    device: Device,
    serviceUUID: string,
    characteristicUUID: string,
  ) => {
    console.log('Enabling notifications for:', serviceUUID, characteristicUUID); // Log the action
    try {
      device.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error('Notification error:', error); // Log notification errors
            return;
          }
          // Log the updated characteristic value
          console.log(
            'Notification received > raw: ',
            characteristic?.value ?? '0',
            ', string: ',
            base64.decode(characteristic?.value ?? '0'),
            ', number: ',
            base64ToDecimal(characteristic?.value ?? '0'),
          );
        },
      );
    } catch (error) {
      console.error('Enable notification error:', error); // Log errors
    }
  };

  // Log data (placeholder for actual logging logic)
  // const logData = (data: string | null) => {
  //   console.log('Logged data:', data); // Log data to the console
  // };

  const base64ToDecimal = (encodedString: string) => {
    // Convert base 64 encoded string to text
    var text = atob(encodedString);
    var decimalArray = [];

    // Run a loop on all characters of the text and convert each character to decimal
    for (var i = text.length - 1; i >= 0; i--) {
      decimalArray.push(text.charAt(i).charCodeAt(0));
    }

    // Join all decimals to get the final decimal for the entire string
    return parseInt(decimalArray.join(''));
  };

  return (
    <View>
      <KeepAwake />
      {/* Button to start scanning for devices */}
      <Button title="Scan for Devices" onPress={scanForDevices} />
      {/* List of discovered devices */}
      <FlatList
        style={styles.container}
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <Text onPress={() => connectToDevice(item)} style={styles.item}>
            {item.name || 'Unnamed Device'}
          </Text>
        )}
      />
      {/* Button to read data from the connected device */}
      {connectedDevice && (
        <Button
          title="Read Data"
          onPress={() => {
            // Read data from multiple characteristics
            enableNotifications(
              connectedDevice,
              '0000181a-0000-1000-8000-00805f9b34fb', // Service UUID
              '00002b18-0000-1000-8000-00805f9b34fb', // Characteristic UUID
            );

            // readData(
            //   connectedDevice,
            //   '00001800-0000-1000-8000-00805f9b34fb',
            //   '00002a01-0000-1000-8000-00805f9b34fb',
            // );

            // readData(
            //   connectedDevice,
            //   '00001800-0000-1000-8000-00805f9b34fb',
            //   '00002aa6-0000-1000-8000-00805f9b34fb',
            // );
          }}
        />
      )}
    </View>
  );
};

export default BLELoggerApp;
