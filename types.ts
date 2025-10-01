import Geolocation from 'react-native-geolocation-service';
import { Emitter } from 'mitt';

// Flexible metadata for events
export type EventMetadata = Record<string, string | number | boolean | Date>;

// Base event type for our custom event system
export interface BaseEvent {
  id?: string; // Optional unique identifier for the event
  type: string; // Event type (e.g., 'sensor_reading', 'ble_data_updated')
  timestamp: Date; // Required timestamp for all events
  source?: string; // Optional source identifier (e.g., device ID, sensor ID)
  metadata?: EventMetadata;
}

// Olfactory data with flexible structure
export type OlfactoryData = {
  readings: Record<string, number>; // e.g., { 'CH4': 150, 'CO2': 400 }
  units?: Record<string, string>;   // e.g., { 'CH4': 'ppm', 'CO2': 'ppm' }
  calibration?: Record<string, any>;
  [key: string]: any; // Allow additional properties
};

// Sensor event type
export interface SensorEvent extends BaseEvent {
  type: 'sensor_reading';
  coordinate?: Geolocation.GeoCoordinates;
  olfactoryData?: OlfactoryData;
}

// Custom event type for BLE data updates
export interface BLEDataUpdated extends BaseEvent {
  type: 'ble_data_updated';
  deviceId: string; // ID of the BLE device
  serviceUUID: string; // Service UUID
  characteristicUUID: string; // Characteristic UUID
  rawValue: string; // Raw base64 value from BLE
  decodedValue?: string | number; // Decoded value
  sensorData?: SensorEvent; // Optional associated sensor data
}

// Event map for mitt - maps event types to their payload types
export type Events = {
  sensor_reading: SensorEvent;
  ble_data_updated: BLEDataUpdated;
};

// Type alias for our event emitter
export type AppEventEmitter = Emitter<Events>;

// Union type for all possible events
export type AppEvent = SensorEvent | BLEDataUpdated;

