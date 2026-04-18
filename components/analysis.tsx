import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentDirectoryPath, writeFile } from 'react-native-fs';
import Share from 'react-native-share';
import { SensorEvent } from '../types';
import CustomRadarChart from '../components/CustomRadarChart'; // ← Import the new component

type SavedFingerprintData = {
	fingerprint: SensorEvent;
	location: { latitude: number; longitude: number } | null;
	humanDescription: { description: string };
	fingerprintTitle: { title: string };
	timestamp: string;
};

type StoredItem = { key: string; data: SavedFingerprintData };

// Consistent sensor order and labels matching LiveData
const SENSOR_MAP = [
	{ key: 'CH4', label: '3. Ch4' },
	{ key: 'NH3', label: '2. NH3' },
	{ key: 'HCHO', label: '1. HCHO' },
	{ key: 'VOC', label: '8. VOC' },
	{ key: 'Odour', label: '7. Odour' },
	{ key: 'H2S', label: '6. H2S' },
	{ key: 'Etoh', label: '5. Etoh' },
	{ key: 'NO2', label: '4. No2' },
];

// Color generator
const generateColor = (index: number) => {
  const hue = (index * 137.508) % 360;
  return {
    fill: `hsla(${hue}, 80%, 65%, 0.35)`,
    stroke: `hsla(${hue}, 85%, 45%, 1)`,
  };
};

export default function Analysis() {
	const [items, setItems] = useState<StoredItem[]>([]);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
	const [showComparison, setShowComparison] = useState(false);

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
			if (prev.includes(key)) {
				return prev.filter(k => k !== key);
			}
			return [...prev, key];
		});
	};

	const moveSelection = (key: string, direction: 'up' | 'down') => {
		setSelectedKeys(prev => {
			const idx = prev.indexOf(key);
			if (idx === -1) return prev;
			if (direction === 'up' && idx === 0) return prev;
			if (direction === 'down' && idx === prev.length - 1) return prev;

			const newKeys = [...prev];
			const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
			[newKeys[idx], newKeys[swapIdx]] = [newKeys[swapIdx], newKeys[idx]];
			return newKeys;
		});
	};

	const exportSelected = async () => {
		try {
			const selected = items.filter(i => selectedKeys.includes(i.key)).map(i => i.data);
			if (selected.length === 0) return Alert.alert('No selection', 'Please select fingerprints to export.');

			const filename = `fingerprints_selected_${Date.now()}.json`;
			const path = `${DocumentDirectoryPath}/${filename}`;
			await writeFile(path, JSON.stringify(selected, null, 2), 'utf8');

			await Share.open({ 
				title: 'Share selected fingerprints', 
				url: `file://${path}`, 
				saveToFiles: true, 
				failOnCancel: false 
			});
		} catch (err: any) {
			console.error('Export selected failed', err);
			Alert.alert('Export failed', err?.message || String(err));
		}
	};

	const clearSelection = () => {
		setSelectedKeys([]);
		setShowComparison(false);
	};

	const selectedItems = items.filter(i => selectedKeys.includes(i.key));

	// Convert readings to radar data with consistent labeling
	const getRadarData = (item: StoredItem) => {
		const readings = item.data.fingerprint?.olfactoryData?.readings || {};
		return SENSOR_MAP.map(({ key, label }) => ({
			x: label,
			y: readings[key] !== undefined ? Number(readings[key]) : 0.01,
		}));
	};

	// Prepare data for custom radar chart
	const radarChartData = selectedItems.map((item, idx) => ({
		key: item.key,
		title: item.data.fingerprintTitle?.title || `Fingerprint ${idx + 1}`,
		values: getRadarData(item),
		color: generateColor(idx),
	}));

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Analysis</Text>
			<Text style={styles.note}>Select fingerprints to compare.</Text>
			<Text style={styles.badge}>Selected: {selectedKeys.length}</Text>

			<View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
				<Button title="Clear" onPress={clearSelection} disabled={selectedKeys.length === 0} />
				<Button title="Export Selected" onPress={exportSelected} disabled={selectedKeys.length === 0} />
				<Button 
					title="Compare" 
					onPress={() => setShowComparison(true)} 
					disabled={selectedKeys.length < 2}
				/>
			</View>

			{showComparison && selectedKeys.length >= 2 && (
  <View style={{ marginVertical: 12, alignItems: 'center' }}>


	      <CustomRadarChart
	        data={radarChartData}
	        size={320}
	        maxValue={1}
	        gridLevels={4}
	      />
					{/* Legend */}
					<View style={styles.legend}>
						{radarChartData.map((dataset, idx) => (
							<View key={dataset.key} style={styles.legendItem}>
								<View 
									style={[
										styles.legendColor, 
										{ backgroundColor: dataset.color.stroke }
									]} 
								/>
								<Text style={styles.legendText}>{dataset.title}</Text>
							</View>
						))}
					</View>

					{/* Sensor dimension preview */}
					<View style={styles.sensorPreview}>
						<Text style={styles.sensorPreviewTitle}>Comparing sensors:</Text>
						<Text style={styles.sensorPreviewText}>
							{SENSOR_MAP.map(s => s.key).join(', ')}
						</Text>
					</View>
				</View>
			)}

			<ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 120 }}>
				{items.map((item, idx) => {
					const isSelected = selectedKeys.includes(item.key);
					const selectionIndex = selectedKeys.indexOf(item.key);
					
					return (
						<View key={item.key}>
							<Pressable 
								onPress={() => toggleSelect(item.key)} 
								style={[
									styles.item, 
									isSelected && styles.selectedItem,
								]}
							>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
									<View style={{ flex: 1 }}>
										{isSelected && (
											<View 
												style={[
													styles.colorIndicator,
													{ backgroundColor: generateColor(selectionIndex).stroke }
												]} 
											/>
										)}
										<Text style={styles.cardTitle}>
											{item.data.fingerprintTitle?.title || `Fingerprint ${idx + 1}`}
										</Text>
										<Text style={styles.cardText}>
											{item.data.humanDescription?.description || ''}
										</Text>
										<Text style={styles.cardSmall}>
											{new Date(item.data.timestamp).toLocaleString()}
										</Text>
									</View>

									{isSelected && (
										<View style={styles.reorderButtons}>
											<Pressable 
												onPress={() => moveSelection(item.key, 'up')}
												style={[
													styles.reorderBtn, 
													selectionIndex === 0 && styles.reorderBtnDisabled
												]}
												disabled={selectionIndex === 0}
											>
												<Text style={styles.reorderBtnText}>↑</Text>
											</Pressable>
											<Pressable 
												onPress={() => moveSelection(item.key, 'down')}
												style={[
													styles.reorderBtn, 
													selectionIndex === selectedKeys.length - 1 && styles.reorderBtnDisabled
												]}
												disabled={selectionIndex === selectedKeys.length - 1}
											>
												<Text style={styles.reorderBtnText}>↓</Text>
											</Pressable>
										</View>
									)}
								</View>
							</Pressable>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20 },
	title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
	note: { color: '#555', fontSize: 14 },
	badge: { 
		fontSize: 16, 
		fontWeight: '600', 
		color: '#007aff', 
		marginTop: 8 
	},
	item: { 
		padding: 12, 
		borderRadius: 8, 
		backgroundColor: 'white', 
		marginBottom: 10,
		position: 'relative'
	},
	selectedItem: { 
		borderWidth: 2, 
		borderColor: '#007aff',
		backgroundColor: '#f0f8ff'
	},
	cardTitle: { fontSize: 16, fontWeight: '600' },
	cardText: { fontSize: 14, color: '#333', marginTop: 4 },
	cardSmall: { fontSize: 12, color: '#666', marginTop: 4 },
	colorIndicator: {
		position: 'absolute',
		left: -8,
		top: 0,
		width: 4,
		height: '100%',
		borderRadius: 2
	},
	reorderButtons: {
		flexDirection: 'column',
		gap: 4,
		marginLeft: 8
	},
	reorderBtn: {
		width: 32,
		height: 32,
		backgroundColor: '#007aff',
		borderRadius: 6,
		justifyContent: 'center',
		alignItems: 'center'
	},
	reorderBtnDisabled: {
		backgroundColor: '#ccc'
	},
	reorderBtnText: {
		color: 'white',
		fontSize: 16,
		fontWeight: '600'
	},
	sliderLabel: {
		fontSize: 12,
		color: '#666',
		marginTop: 4
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		marginTop: 16,
		gap: 12
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6
	},
	legendColor: {
		width: 16,
		height: 16,
		borderRadius: 3
	},
	legendText: {
		fontSize: 11,
		color: '#333'
	},
	sensorPreview: {
		backgroundColor: '#f8f9fa',
		padding: 12,
		borderRadius: 8,
		marginTop: 12,
		width: '90%'
	},
	sensorPreviewTitle: {
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 4,
		color: '#333'
	},
	sensorPreviewText: {
		fontSize: 12,
		color: '#666'
	}
});