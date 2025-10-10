import 'react-native-reanimated';
import React, {useState, useEffect} from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { useBLE } from '../BLEUniversal';
import {RadarChart} from '@salmonco/react-native-radar-chart';

const DataDisplay = () => {
  const { characteristicValues } = useBLE();

  // Parse all your sensor values
  const methane = parseFloat(characteristicValues['Methane'] || '0');
  const ammonia = parseFloat(characteristicValues['Ammonia'] || '0');
  const formaldehyde = parseFloat(characteristicValues['Formaldehyde'] || '0');
  const voc = parseFloat(characteristicValues['Voletile Organic Compounds'] || '0');
  const odour = parseFloat(characteristicValues['Odor']|| '0');
    const hydrogenSulfide = parseFloat(characteristicValues['Hydrogen Sulfide']|| '0');
    const ethanol = parseFloat(characteristicValues['Ethanol'] || '0');
      const nitrogenDioxide = parseFloat(characteristicValues['Nitrogen Dioxide'] || '0');

  // Transform BLE data for radar chart
const radarData = [
  { label: 'Ch4', value: methane }, // Use raw small values
  { label: 'NH3', value: ammonia },
  { label: 'HCHO', value: formaldehyde },
  { label: 'VOC', value: voc },
    { label: 'Odour', value: odour },
        { label: 'H2S', value: hydrogenSulfide },
                { label: 'Etoh', value: ethanol },
                {label: 'No2', value: nitrogenDioxide}


].filter(item => !isNaN(item.value));
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Data Dashboard</Text>
      
      <RadarChart
        data={radarData}
        maxValue={1} // Radar charts need a fixed max
        gradientColor={{
          startColor: '#eae8e6ff',
          endColor: '#e9ded3ff',
          count: 5,
        }}
        stroke={['#FFE8D3', '#FFE8D3', '#FFE8D3', '#FFE8D3', '#ff9532']}
        strokeWidth={[1]}
        labelColor="#21a1b1ff"
        dataFillColor="#3dadd0ff"
        dataFillOpacity={0.8}
        dataStroke="salmon"
        dataStrokeWidth={2}
        isCircle
      />

      {/* Show raw values for reference */}
      <View style={styles.values}>
        <Text>Methane: {methane.toFixed(2)}</Text>
        <Text>Ammonia: {ammonia.toFixed(2)}</Text>
        <Text>Formaldehyde: {formaldehyde.toFixed(2)}</Text>
        <Text>VOC: {voc.toFixed(2)}</Text>
                <Text>Odour: {odour.toFixed(2)}</Text>
                       <Text>Hydrogen Sulfide: {hydrogenSulfide.toFixed(2)}</Text>
                       <Text>Ethanol: {ethanol.toFixed(2)}</Text>
                       <Text>Nitrogen Dioxide: {ethanol.toFixed(2)}</Text>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  values: {
    marginTop: 20,
  }
});

export default DataDisplay;

// import 'react-native-reanimated';
// import React, {useState, useEffect} from 'react';
// import { View, Text, Button, ScrollView } from 'react-native';
// import { useBLE } from '../BLEUniversal';
// //this is a library for data visualization, you can find more info here and how to download: https://nearform.com/open-source/victory-native/ 
// import { CartesianChart, Line } from "victory-native";

// const DataDisplay = () => {
//   const { characteristicValues } = useBLE();

//   // Pick only the two sensors you care about for now
//   const methane = parseFloat(characteristicValues['Methane'] || '0');
//   const ammonia = parseFloat(characteristicValues['Ammonia'] || '0');
//     const formaldehyde = parseFloat(characteristicValues['Formaldehyde'] || '0');


// const [methaneHistory, setMethaneHistory] = useState<{x: number, y: number}[]>([]);
// const [ammoniaHistory, setAmmoniaHistory] = useState<{x: number, y: number}[]>([]);
// const [formaldehydeHistory, setFormaldehydeHistory] = useState<{x: number, y: number}[]>([]);


// const SENSOR_RANGES = {
//   Methane: { min: 0, max: 1000 }, // ppm
//   Formaldehyde: { min: 0, max: 1000 },  // ppm
// };

// useEffect(() => {
// methane && setMethaneHistory(prev => [...prev.slice(-50), { x: Date.now(), y: methane }]);
//   ammonia && setAmmoniaHistory(prev => [...prev.slice(-50), { x: Date.now(), y: ammonia }]);
//     formaldehyde && setFormaldehydeHistory(prev => [...prev.slice(-50), { x: Date.now(), y: formaldehyde }]);

// }, [methane, ammonia, formaldehyde]); // Both dependencies


//   // Build simple data arrays for charting
//   const chartData = [
//     { index: 0, label: 'Methane', value: methane },
//     { index: 1, label: 'Ammonia', value: ammonia },
//         { index: 2, label: 'Formaldehyde', value: formaldehyde },
//   ];

//   return (
//     <ScrollView
//       contentContainerStyle={{
//         flexGrow: 1,
//         alignItems: 'center',
//         justifyContent: 'center',
//         padding: 20,
//       }}>
//       <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 20 }}>
//         Live Sensor Readings
//       </Text>

//       {/* Live numeric values */}
// <View style={{ height: 200, width: '100%' }}> {/* Add container with size */}
//   <CartesianChart data={methaneHistory} xKey="x" yKeys={['y']}>
//     {({ points }) => <Line points={points.y} color="#1e1e1eff" strokeWidth={3} />}
//   </CartesianChart>

//      <Text style={{ fontSize: 18, marginVertical: 6 }}>
//           Methane: {methane.toFixed(3)}
//         </Text>
// </View>
// {/* Ammonia Chart - ADD THIS STATE MANAGEMENT */}
// <View style={{ height: 200, width: '100%' }}>
//   <CartesianChart data={ammoniaHistory} xKey="x" yKeys={['y']}>
//     {({ points }) => <Line points={points.y} color="#6A0DAD" strokeWidth={3} />}
//   </CartesianChart>
//   <Text style={{ fontSize: 18, marginVertical: 6 }}>
//     Ammonia: {ammonia.toFixed(3)}
//   </Text>
// </View>
// <View style={{ height: 200, width: '100%' }}>
//   <CartesianChart data={formaldehydeHistory} xKey="x" yKeys={['y']}>
//     {({ points }) => <Line points={points.y} color="#1f89c3ff" strokeWidth={3} />}
//   </CartesianChart>
//   <Text style={{ fontSize: 18, marginVertical: 6 }}>
//     Formaldehyde: {formaldehyde.toFixed(3)}
//   </Text>
// </View>
//     </ScrollView>
//   );
// };

// export default DataDisplay;

