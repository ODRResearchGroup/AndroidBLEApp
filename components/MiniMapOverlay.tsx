import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LiveLocationMap from './LiveLocationMap';
import { useInfluxDB } from '../services/InfluxDBService';

const { width } = Dimensions.get('window');

export default function MiniMapOverlay() {
  const { location, trail } = useInfluxDB();

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <LiveLocationMap coordinates={location} trail={trail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 999, // make sure it stays on top
  },
  mapWrapper: {
    width: width * 0.3, // about 30% of screen width
    aspectRatio: 1, // keep it square
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
});
