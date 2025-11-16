import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentDirectoryPath, writeFile } from 'react-native-fs';
import Share from 'react-native-share';
import { VictoryChart, VictoryTheme, VictoryArea, VictoryPolarAxis } from 'victory-native';
import { SensorEvent } from '../types';

type SavedFingerprintData = {
	fingerprint: SensorEvent;
	location: { latitude: number; longitude: number } | null;
	humanDescription: { description: string };
	fingerprintTitle: { title: string };
	timestamp: string;
};

type StoredItem = { key: string; data: SavedFingerprintData };

const MAX_SELECTION = 5;

export default function Analysis() {
	const [items, setItems] = useState<StoredItem[]>([]);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

	useEffect(() => {
		const load = async () => {
			try {
				const keys = await AsyncStorage.getAllKeys();
				const fingerprintKeys = keys.filter(k => k.startsWith('sensor_fingerprint_'));
				const pairs = await AsyncStorage.multiGet(fingerprintKeys);

				const parsed: StoredItem[] = pairs
					.map(([k, v]) => ({ key: k, data: v ? JSON.parse(v) : null }))
					.filter(p => p.data !== null) as StoredItem[];

				parsed.sort((a, b) => new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime());
				setItems(parsed);
			} catch (err) {
				console.error('Failed to load fingerprints for analysis', err);
			}
		};

		load();
	}, []);

	const toggleSelect = (key: string) => {
		setSelectedKeys(prev => {
			if (prev.includes(key)) return prev.filter(k => k !== key);
			if (prev.length >= MAX_SELECTION) return prev; // ignore beyond max
			return [...prev, key];
		});
	};

	const exportSelected = async () => {
		try {
			const selected = items.filter(i => selectedKeys.includes(i.key)).map(i => i.data);
			if (selected.length === 0) return Alert.alert('No selection', 'Please select fingerprints to export.');

			const filename = `fingerprints_selected_${Date.now()}.json`;
			const path = `${DocumentDirectoryPath}/${filename}`;
			await writeFile(path, JSON.stringify(selected, null, 2), 'utf8');

			await Share.open({ title: 'Share selected fingerprints', urls: [path], saveToFiles: true, failOnCancel: false });
		} catch (err: any) {
			console.error('Export selected failed', err);
			Alert.alert('Export failed', err?.message || String(err));
		}
	};

	const clearSelection = () => setSelectedKeys([]);

	const selectedItems = items.filter(i => selectedKeys.includes(i.key));

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Analysis</Text>
			<Text style={styles.note}>Select up to {MAX_SELECTION} fingerprints to compare.</Text>

			<View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
				<Button title="Clear" onPress={clearSelection} />
				<Button title="Export Selected" onPress={exportSelected} />
			</View>

			{selectedKeys.length >= 2 && (
				<View style={{ marginVertical: 12 }}>
			    <VictoryChart polar theme={VictoryTheme.clean} domain={{ y: [0.01, 4] }}>
                      <VictoryPolarAxis dependentAxis labelPlacement="vertical" tickFormat={() => ''} />
                      <VictoryPolarAxis labelPlacement="parallel" />
                         <VictoryPolarAxis labelPlacement="parallel" />
						{selectedItems.map((it, i) => {
							const readings = it.data.fingerprint?.olfactoryData?.readings || {};
							const data = Object.entries(readings).map(([x, y]) => ({ x, y: Number(y) }));
							const color = i === 0 ? 'rgba(0,123,255,0.4)' : 'rgba(231,114,254,0.4)';
							return (
								<VictoryArea
									key={it.key}
									 interpolation="linear" 
									style={{ data: { fill: color, stroke: color.replace('0.4', '1'), strokeWidth: 2 } }}
									data={data}
								/>
							);
						})}
					</VictoryChart>
				</View>
			)}

			<ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 120 }}>
				{items.map((it, idx) => (
					<Pressable key={it.key} onPress={() => toggleSelect(it.key)} style={[styles.item, selectedKeys.includes(it.key) && styles.selectedItem]}>
						<Text style={styles.cardTitle}>{it.data.fingerprintTitle?.title || `Fingerprint ${idx + 1}`}</Text>
						<Text style={styles.cardText}>{it.data.humanDescription?.description || ''}</Text>
						<Text style={styles.cardSmall}>{new Date(it.data.timestamp).toLocaleString()}</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20 },
	title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
	note: { color: '#555' },
	item: { padding: 12, borderRadius: 8, backgroundColor: 'white', marginBottom: 10 },
	selectedItem: { borderWidth: 2, borderColor: '#007aff' },
	cardTitle: { fontSize: 16, fontWeight: '600' },
	cardText: { fontSize: 14, color: '#333' },
	cardSmall: { fontSize: 12, color: '#666' },
});