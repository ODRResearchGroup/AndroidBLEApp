import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { InfluxDBClient } from '../../influxdb';
import { CONFIG } from '../../config';
import { eventEmitter } from '../../BLEUniversal';
import { BLEDataUpdated, SensorEvent } from '../../types/events';

export type LiveLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: number;
};

type InfluxDBContextType = {
  client: InfluxDBClient | null;
  isConnected: boolean;
  testConnection: () => Promise<void>;
  location: LiveLocation | null;
  trail: LiveLocation[];
  isSmellWalkActive: boolean;
  walkId: string | null;
  startSmellWalk: () => void;
  stopSmellWalk: () => Promise<void>;
};

const InfluxDBContext = createContext<InfluxDBContextType | undefined>(
  undefined,
);

export const InfluxDBProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [client, setClient] = useState<InfluxDBClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [trail, setTrail] = useState<LiveLocation[]>([]);
  const [isSmellWalkActive, setIsSmellWalkActive] = useState(false);
  const [walkId, setWalkId] = useState<string | null>(null);
  const latestLocationRef = useRef<LiveLocation | null>(null);
  const isSmellWalkActiveRef = useRef(false);
  const walkIdRef = useRef<string | null>(null);
  const walkReadingsRef = useRef<Record<string, number>>({});
  const walkSourceRef = useRef('unknown');
  const walkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize InfluxDB client
  useEffect(() => {
    const token = CONFIG.INFLUX_TOKEN || '';
    const url = CONFIG.INFLUX_URL || '';
    const org = CONFIG.INFLUX_ORG || '';
    const bucket = CONFIG.INFLUX_BUCKET || '';

    if (token && url && org && bucket) {
      const influxClient = new InfluxDBClient(url, token, org, bucket);
      setClient(influxClient);
      setIsConnected(true);
      console.log('InfluxDB client initialized successfully');
    } else {
      console.warn('InfluxDB configuration incomplete');
    }
  }, []);

  useEffect(() => {
    let watchId: number | null = null;
    let active = true;

    const startLocationWatch = async () => {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Location permission denied; sensor data will omit GPS');
          return;
        }
      } else {
        const authorization = await Geolocation.requestAuthorization(
          'whenInUse',
        );
        if (authorization !== 'granted') {
          console.warn('Location permission denied; sensor data will omit GPS');
          return;
        }
      }

      if (!active) {
        return;
      }

      watchId = Geolocation.watchPosition(
        (position: GeoPosition) => {
          const nextLocation: LiveLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: position.coords.accuracy ?? null,
            recordedAt: position.timestamp,
          };
          latestLocationRef.current = nextLocation;
          setLocation(nextLocation);
          if (isSmellWalkActiveRef.current) {
            setTrail(previous => [...previous, nextLocation]);
          }
        },
        error => console.warn('Live location error:', error.message),
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 2000,
          fastestInterval: 1000,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    };

    startLocationWatch().catch(error => {
      console.warn('Unable to start live location:', error);
    });

    return () => {
      active = false;
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        Geolocation.stopObserving();
      }
    };
  }, []);

  const flushWalkData = useCallback(async () => {
    const currentWalkId = walkIdRef.current;
    const readings = walkReadingsRef.current;
    if (!currentWalkId || Object.keys(readings).length === 0) {
      return;
    }

    if (!client) {
      console.warn(
        'InfluxDB client not available; smell walk data was not sent',
      );
      return;
    }

    const fields: Record<string, number> = {};
    for (const [sensorType, value] of Object.entries(readings)) {
      const safeSensorType = sensorType.replace(/[^A-Za-z0-9_]/g, '_');
      fields[`sensor_${safeSensorType}`] = value;
    }

    const currentLocation = latestLocationRef.current;
    if (currentLocation) {
      fields.latitude = currentLocation.latitude;
      fields.longitude = currentLocation.longitude;
      if (currentLocation.accuracyM !== null) {
        fields.accuracy_m = currentLocation.accuracyM;
      }
    }

    try {
      await client.writeData(
        'smell_walk_readings',
        {
          walk_id: currentWalkId,
          device_id: walkSourceRef.current,
        },
        fields,
        new Date(),
      );
      walkReadingsRef.current = {};
      console.log(`Sent smell walk sample ${currentWalkId}`);
    } catch (error) {
      console.error('Error sending smell walk data to InfluxDB:', error);
    }
  }, [client]);

  const startSmellWalk = useCallback(() => {
    if (isSmellWalkActiveRef.current) {
      return;
    }

    const nextWalkId = `walk-${Date.now()}`;
    walkIdRef.current = nextWalkId;
    walkReadingsRef.current = {};
    isSmellWalkActiveRef.current = true;
    setWalkId(nextWalkId);
    setTrail(latestLocationRef.current ? [latestLocationRef.current] : []);
    setIsSmellWalkActive(true);
    walkTimerRef.current = setInterval(() => {
      flushWalkData().catch(error => {
        console.error('Error flushing smell walk data:', error);
      });
    }, 5000);
  }, [flushWalkData]);

  const stopSmellWalk = useCallback(async () => {
    if (!isSmellWalkActiveRef.current) {
      return;
    }

    isSmellWalkActiveRef.current = false;
    setIsSmellWalkActive(false);
    if (walkTimerRef.current !== null) {
      clearInterval(walkTimerRef.current);
      walkTimerRef.current = null;
    }
    await flushWalkData();
    walkIdRef.current = null;
    setWalkId(null);
  }, [flushWalkData]);

  useEffect(
    () => () => {
      if (walkTimerRef.current !== null) {
        clearInterval(walkTimerRef.current);
      }
    },
    [],
  );

  // Set up event listeners for pub/sub system
  useEffect(() => {
    if (!client) {
      return;
    }

    const handleBLEUpdate = (event: BLEDataUpdated) => {
      console.log('InfluxDB Service: BLE data updated:', event);

      // Create a SensorEvent for each BLE update
      const sensorEvent: SensorEvent = {
        type: 'sensor_reading',
        timestamp: event.timestamp,
        source: event.source,
        olfactoryData: {
          readings: {
            [event.characteristicUUID]:
              typeof event.decodedValue === 'number' ? event.decodedValue : 0,
          },
          units: {
            [event.characteristicUUID]: 'ppm', // Adjust based on your sensor
          },
        },
      };

      // Emit sensor event
      eventEmitter.emit('sensor_reading', sensorEvent);
    };

    const handleSensorReading = async (event: SensorEvent) => {
      console.log('InfluxDB Service: Sensor reading:', event);

      if (!isSmellWalkActiveRef.current || !event.olfactoryData?.readings) {
        return;
      }

      walkSourceRef.current = event.source || 'unknown';
      Object.assign(walkReadingsRef.current, event.olfactoryData.readings);
    };

    // Subscribe to events
    eventEmitter.on('ble_data_updated', handleBLEUpdate);
    eventEmitter.on('sensor_reading', handleSensorReading);

    // Cleanup subscriptions
    return () => {
      eventEmitter.off('ble_data_updated', handleBLEUpdate);
      eventEmitter.off('sensor_reading', handleSensorReading);
    };
  }, [client]);

  const testConnection = async () => {
    if (!client) {
      console.error('InfluxDB client not initialized');
      return;
    }

    try {
      console.log('Testing InfluxDB connection...');
      await client.writeData(
        'test_measurement',
        { source: 'debug_test' },
        { test_value: 123.45 }, // Direct number
        new Date(),
      );
      console.log('InfluxDB test successful!');
    } catch (error) {
      console.error('InfluxDB test failed:', error);
    }
  };

  return (
    <InfluxDBContext.Provider
      value={{
        client,
        isConnected,
        testConnection,
        location,
        trail,
        isSmellWalkActive,
        walkId,
        startSmellWalk,
        stopSmellWalk,
      }}>
      {children}
    </InfluxDBContext.Provider>
  );
};

export const useInfluxDB = () => {
  const context = useContext(InfluxDBContext);
  if (!context) {
    throw new Error('useInfluxDB must be used inside an InfluxDBProvider');
  }
  return context;
};
