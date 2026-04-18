import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, Pressable, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLiveLocation from '../util/useLiveLocation';
import {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
} from '@maplibre/maplibre-react-native';
import { FeatureCollection, Feature, Point } from 'geojson';

const { width } = Dimensions.get('window');

type SavedFingerprintData = {
  fingerprint: any;
  location: { latitude: number; longitude: number } | null;
  humanDescription?: { description: string };
  fingerprintTitle?: { title: string };
  timestamp: string;
  photoPath: string;
};

export default function MappedFingerprints() {
  const [features, setFeatures] = useState<FeatureCollection<Point> | null>(null);
  const cameraRef = useRef<React.ElementRef<typeof Camera> | null>(null);
  const { location } = useLiveLocation();
  const [selectedFeature, setSelectedFeature] = useState<Feature<Point> | null>(null);

  useEffect(() => {
    const load = async () => {
      const keys = await AsyncStorage.getAllKeys();
      const fingerprintKeys = keys.filter(k => k.startsWith('sensor_fingerprint_'));
      const pairs = await AsyncStorage.multiGet(fingerprintKeys);

      const parsed = pairs
        .map(([_, v]) => {
          if (!v) return null;
          try {
            return JSON.parse(v) as SavedFingerprintData;
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean) as SavedFingerprintData[];

      const pts: Feature<Point>[] = parsed
        .map(p => {
          const loc = p.location;
          if (!loc) return null;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
            properties: {
              title: p.fingerprintTitle?.title ?? null,
              description: p.humanDescription?.description ?? null,
              timestamp: p.timestamp,
              photoPath: p.photoPath ?? undefined,
            },
          } as Feature<Point>;
        })
        .filter(Boolean) as Feature<Point>[];

      const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features: pts };
      setFeatures(fc);

      // center camera on first point if available (initial load)
      if (pts.length && cameraRef.current && !location) {
        const [lon, lat] = pts[0].geometry.coordinates;
        cameraRef.current.setCamera({ centerCoordinate: [lon, lat], zoomLevel: 10 });
      }
    };

    load().catch(err => console.warn('Failed to load fingerprints for map', err));
  }, []);

  if (!features) {
    return (
      <View style={[styles.fullscreen, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.fullscreen}>
      <MapView style={styles.map} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">
        <Camera ref={cameraRef} />
        {/* user live location (if available) */}
        {location && (
          <ShapeSource
            id="user-location"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
                  properties: {},
                },
              ],
            }}
          >
            <CircleLayer
              id="user-point"
              style={{
                circleColor: '#007aff',
                circleRadius: 8,
                circleStrokeWidth: 2,
                circleStrokeColor: '#fff',
              }}
            />
          </ShapeSource>
        )}

        <ShapeSource
          id="fingerprints"
          shape={features}
          onPress={(ev: any) => {
            const f = ev?.features?.[0] as Feature<Point> | undefined;
            if (f) {
              setSelectedFeature(f);
              const [lon, lat] = f.geometry.coordinates;
              if (cameraRef.current) cameraRef.current.setCamera({ centerCoordinate: [lon, lat] });
            }
          }}
        >
          <CircleLayer
            id="fingerprint-points"
            style={{
              circleColor: '#ff7043',
              circleRadius: 6,
              circleStrokeWidth: 2,
              circleStrokeColor: '#fff',
            }}
          />
        </ShapeSource>
      </MapView>
      {selectedFeature && (
        <View style={styles.cardContainer} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedFeature.properties?.title ?? 'Fingerprint'}</Text>
            {selectedFeature.properties?.description ? (
              <Text style={styles.cardText}>{selectedFeature.properties.description}</Text>
            ) : null}
            <Text style={styles.cardSmall}>{new Date(selectedFeature.properties?.timestamp || Date.now()).toLocaleString()}</Text>

{selectedFeature?.properties?.photoPath ? (
  <Image
    source={{ uri: 'file://' + selectedFeature.properties.photoPath }}
    style={{ width: 160, height: 160, marginTop: 10, borderRadius: 10 }}
    resizeMode="cover"
  />
) : null}

            <Pressable onPress={() => setSelectedFeature(null)} style={styles.cardClose}>
              <Text style={{ color: '#007aff' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  map: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  cardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 8,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardText: { fontSize: 14, marginBottom: 6 },
  cardSmall: { fontSize: 12, color: '#666' },
  cardClose: { marginTop: 8, alignSelf: 'flex-end' },
});