import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions,
  LayoutAnimation,
  Platform,
  UIManager, } from 'react-native';
// Slider and delta features removed; keep radar-only view
import CustomRadarChart from './CustomRadarChart';
import { MapView, Camera, ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';

const { width } = Dimensions.get('window');

import { SavedFingerprintData, SensorReadings } from './sharedTypes';

interface ExpandedFingerprintViewProps {
  data: SavedFingerprintData;
  onBack: () => void;
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// Sensor order matching your other screens
const SENSOR_ORDER = ['CH4', 'NH3', 'HCHO', 'VOC', 'Odour', 'H2S', 'Etoh', 'NO2'];
const SENSOR_LABELS = ['Ch4', 'NH3', 'HCHO', 'VOC', 'Odour', 'H2S', 'Etoh', 'No2'];

export default function ExpandedFingerprintView({ data, onBack }: ExpandedFingerprintViewProps) {
  const readings = data.fingerprint?.olfactoryData?.readings || {};

  // removed numbers expansion controls; only radar/chart shown


  // Prepare radar chart data (switch between raw and delta)
  const currentReadingsForBaseline: SensorReadings = {
    CH4: Number(readings.CH4) || 0,
    NH3: Number(readings.NH3) || 0,
    HCHO: Number(readings.HCHO) || 0,
    VOC: Number(readings.VOC) || 0,
    Odour: Number(readings.Odour) || 0,
    H2S: Number(readings.H2S) || 0,
    Etoh: Number(readings.Etoh) || 0,
    NO2: Number(readings.NO2) || 0,
  };

  const radarData = SENSOR_ORDER.map((key, idx) => ({
    x: SENSOR_LABELS[idx],
    y: (currentReadingsForBaseline as any)[key] ?? 0,
  }));

  const chartData = [{
    key: 'fingerprint-detail',
    title: data.fingerprintTitle?.title || 'Fingerprint',
    values: radarData,
    color: {
      fill: 'hsla(210, 100%, 50%, 0.35)',
      stroke: 'hsla(210, 100%, 40%, 1)',
    }
  }];
  // Prepare sensor cells (4x2 grid) displaying captured values
  const sensorCells = SENSOR_ORDER.map((key, idx) => ({
    label: SENSOR_LABELS[idx],
    value: (currentReadingsForBaseline as any)[key] ?? 0,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back Button */}
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      {/* Title Section */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>{data.fingerprintTitle?.title || 'Untitled Fingerprint'}</Text>
        <View style={styles.timestampBadge}>
          <Text style={styles.timestampText}>
            {new Date(data.timestamp).toLocaleDateString()} {new Date(data.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>

      {/* Radar Chart Section */}
      <View style={styles.chartSection}>
        <CustomRadarChart
          data={chartData}
          size={Math.min(width - 80, 320)}
          maxValue={1}
          gridLevels={5}
        />

        {/* Radar chart only (raw values) */}
      </View>

      {/* Numbers Section - 4x2 Grid */}
      <View style={styles.numbersSection}>
        <Text style={styles.sectionTitle}>Numbers</Text>
        <View style={styles.sensorGrid}>
          {sensorCells.map((sensor, idx) => (
            <View key={idx} style={styles.sensorCell}>
              <Text style={styles.sensorLabel}>{sensor.label}</Text>
              <Text style={styles.sensorValue}>{sensor.value.toFixed(4)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Image & Description Section */}
      <View style={styles.imageDescriptionSection}>
        {data.photoPath ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: `file://${data.photoPath}` }}
              style={styles.attachedImage}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={[styles.imageContainer, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Description</Text>
          <Text style={styles.descriptionText}>
            {data.humanDescription?.description || 'No description provided'}
          </Text>
        </View>
      </View>

      {/* Map Section */}
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>map</Text>
        {data.location ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            >
              <Camera
                centerCoordinate={[data.location.longitude, data.location.latitude]}
                zoomLevel={14}
              />
              <ShapeSource
                id="fingerprint-location"
                shape={{
                  type: 'FeatureCollection',
                  features: [{
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [data.location.longitude, data.location.latitude]
                    },
                    properties: {}
                  }]
                }}
              >
                <CircleLayer
                  id="location-point"
                  style={{
                    circleColor: '#ff7043',
                    circleRadius: 8,
                    circleStrokeWidth: 2,
                    circleStrokeColor: '#fff',
                  }}
                />
              </ShapeSource>
            </MapView>
          </View>
        ) : (
          <View style={[styles.mapContainer, styles.noLocationContainer]}>
            <Text style={styles.noLocationText}>No location data available</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  backText: {
    color: '#007aff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  timestampBadge: {
    backgroundColor: '#e8e8e8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  timestampText: {
    fontSize: 13,
    color: '#333',
  },
  chartSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  toggleButtonActive: {
    backgroundColor: '#141414',
  },
  toggleText: {
    color: '#333',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  sliderRow: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
  },
  slider: {
    width: '80%',
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  numbersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sensorCell: {
    width: (width - 60) / 2,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 12,
    color: '#666',
  },
  imageDescriptionSection: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 16,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e8e8e8',
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  descriptionContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  mapSection: {
    marginBottom: 20,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e8e8e8',
  },
  map: {
    flex: 1,
  },
  noLocationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noLocationText: {
    color: '#999',
    fontSize: 14,
  },
});