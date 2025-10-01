
import React, { createContext, useContext, useEffect, useState } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

//This is your BLE manager + context provider 


type BLEContextType = {
  manager: BleManager;
  devices: Device[];
  connectedDevice: Device | null;
  characteristicValues: { [key: string]: string };
  scanForDevices: () => void;
  connectToDevice: (device: Device) => Promise<void>;
  enableNotifications: (
    device: Device,
    characteristics: { serviceUUID: string; characteristicUUID: string; label: string }[]
  ) => Promise<void>;
};


const BLEContext = createContext<BLEContextType | undefined>(undefined);

export const BLEProvider = ({ children }: { children: React.ReactNode }) => {
  const [manager] = useState(() => new BleManager());
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [characteristicValues, setCharacteristicValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    requestPermissions();

    return () => {
      manager.destroy();
    };
  }, [manager]);

  // Request Android permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ];

      if (Platform.Version >= 31) {
        permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      if (Object.values(granted).some(result => result !== PermissionsAndroid.RESULTS.GRANTED)) {
        console.warn('Required BLE permissions not granted');
      }
    }
  };

  // Scan for devices
  const scanForDevices = () => {
    setDevices([]); // reset before scanning

    manager.startDeviceScan(
      null,
      { allowDuplicates: false, scanMode: 2 },
      (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (device && device.name) {
          setDevices(prevDevices => {
            if (!prevDevices.find(d => d.id === device.id)) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      }
    );

    setTimeout(() => {
      manager.stopDeviceScan();
    }, 5000);
  };

  // Connect to a device
  const connectToDevice = async (device: Device) => {
    try {
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
      await device.requestMTU(256);

      setConnectedDevice(device);
      console.log('Connected to', device.name || 'Unnamed Device');

      const services = await device.services();
      for (const service of services) {
        console.log(`Service UUID: ${service.uuid}`);
        const characteristics = await service.characteristics();
        for (const characteristic of characteristics) {
          console.log(`  Characteristic UUID: ${characteristic.uuid}`);
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // Enable notifications
  const enableNotifications = async (
    device: Device,
    characteristics: { serviceUUID: string; characteristicUUID: string; label: string }[]
  ) => {
    for (const { serviceUUID, characteristicUUID, label } of characteristics) {
      console.log('Enabling notification for', label, serviceUUID, characteristicUUID);

      try {
        device.monitorCharacteristicForService(serviceUUID, characteristicUUID, (error, characteristic) => {
          if (error) {
            console.error('Notification error:', error);
            return;
          }

          const rawValue = characteristic?.value ?? '';

          // Decode base64 -> float32
          const base64ToFloat32 = (base64String: string): number => {
            const binary = atob(base64String);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const view = new DataView(bytes.buffer);
            return view.getFloat32(0, true);
          };

          const floatValue = base64ToFloat32(rawValue);

          setCharacteristicValues(prev => ({
            ...prev,
            [label]: floatValue.toFixed(3),
          }));

          console.log(`${label}: ${floatValue}`);
        });
      } catch (error) {
        console.error('Enable notification error:', error);
      }
    }
  };

  return (
    <BLEContext.Provider
      value={{
        manager,
        devices,
        connectedDevice,
        characteristicValues,
        scanForDevices,
        connectToDevice,
        enableNotifications,
      }}
    >
      {children}
    </BLEContext.Provider>
  );
};

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used inside a BLEProvider');
  }
  return context;
};
