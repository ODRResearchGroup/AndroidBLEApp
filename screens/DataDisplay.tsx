
import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, Pressable, Text, Button } from 'react-native';
import LiveData from '../components/LiveData';
import FingerprintsHistory from '../components/FingerprintsHistory';
import Analysis from '../components/analysis';

const DataDisplay: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<null | 'live' | 'history' | 'analysis'>(null);

  return (
    <SafeAreaView style={styles.container}>
      {selectedTab === null ? (
        <View style={styles.cards}>
          <Pressable style={styles.card} onPress={() => setSelectedTab('live')}>
            <Text style={styles.cardTitle}>Live Data</Text>
            <Text style={styles.cardDesc}>Live visualization and fingerprint capture.</Text>
          </Pressable>

          <Pressable style={styles.card} onPress={() => setSelectedTab('history')}>
            <Text style={styles.cardTitle}>History</Text>
            <Text style={styles.cardDesc}>Browse saved fingerprints.</Text>
          </Pressable>

          <Pressable style={styles.card} onPress={() => setSelectedTab('analysis')}>
            <Text style={styles.cardTitle}>Analysis</Text>
            <Text style={styles.cardDesc}>Analyse fingerprints </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.expanded}> 
          <View style={styles.toolbar}>
            <Button title="Back" onPress={() => setSelectedTab(null)} />
          </View>
          <View style={styles.content}>
            {selectedTab === 'live' && <LiveData />}
            {selectedTab === 'history' && <FingerprintsHistory />}
            {selectedTab === 'analysis' && <Analysis />}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 8 },
  content: { flex: 1 },
  cards: { padding: 20 },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#444' },
  expanded: { flex: 1 },
  toolbar: { padding: 8 },
});

export default DataDisplay;