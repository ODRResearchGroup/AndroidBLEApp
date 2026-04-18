import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ImageBackground } from 'react-native';
import { NavigationProp } from '@react-navigation/native';

interface DataDisplayProps {
  navigation: NavigationProp<any>;
}

export default function DataDisplay({ navigation }: DataDisplayProps) {
  return (
    <View style={styles.container}>
        
      <Text style={styles.header}>What's for today?</Text>
      {/* Live Fingerprinting Card */}
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('LiveData')}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Live Fingerprinting</Text>
          <Text style={styles.cardDescription}>
            Capture fingerprints{'\n'}and view the live data
          </Text>
        </View>
        <View style={styles.iconContainer}>
    <Image
    source={require('../pics/fingerprint_single_frame.jpg')}
style={styles.iconContainer}
    resizeMode="contain"
  />
        </View>
      </Pressable>

      {/* Past Fingerprints Card */}
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('History')}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Past fingerprints</Text>
          <Text style={styles.cardDescription}>
            here you can find your{'\n'}previous fingerprints{'\n'}and analyse
          </Text>
        </View>
        <View style={styles.iconContainer}>
     <Image
    source={require('../pics/fingerprint_frame.jpg')}
style={styles.iconContainer}
    resizeMode="contain"
  />
        </View>
      </Pressable>

      {/* Mapped Fingerprints Card */}
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('Map')}
      >
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Mapped Fingerprints</Text>
          <Text style={styles.cardDescription}>
            here you will find the{'\n'}map feature
          </Text>
        </View>
        <View style={styles.iconContainer}>
      <Image
    source={require('../pics/map_frame.jpg')}
style={styles.iconContainer}
    resizeMode="contain"
  />
        </View>
      </Pressable>
    </View>
  );
}

const MARGIN = 20;
const GUTTER = 20;

const styles = StyleSheet.create({
  container: {
    flex: 1,
resizeMode: 'cover',
    paddingHorizontal: MARGIN,
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000',
    marginBottom: 40,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginBottom: GUTTER,

    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#000',
 
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 10,

        borderWidth: 0.5,
    borderColor: '#6b4f3eff',
  },
});