import Geolocation from 'react-native-geolocation-service';

// Flexible metadata for events
export type EventMetadata = Record<string, string | number | boolean | Date>;

// Olfactory data with flexible structure
export type OlfactoryData = {
  readings: Record<string, number>; // e.g., { 'CH4': 150, 'CO2': 400 }
  units?: Record<string, string>;   // e.g., { 'CH4': 'ppm', 'CO2': 'ppm' }
  calibration?: Record<string, any>;
  [key: string]: any; // Allow additional properties
};

// Type definition for sensor data
export type SensorEvent = Event & {
  timestamp?: Date;
  coordinate?: Geolocation.GeoCoordinates;
  olfactoryData?: OlfactoryData;
  metadata?: EventMetadata;
};

