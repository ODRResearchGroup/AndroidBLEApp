import 'react-native-reanimated';
import React, {useState, useEffect} from 'react';
import { View, Text, Button } from 'react-native';

//this is a library for data visualization, you can find more info here and how to download: https://nearform.com/open-source/victory-native/ 
import { CartesianChart, Line } from "victory-native";


const DATA = Array.from({ length: 31 }, (_, i) => ({
  day: i,
  highTmp: 40 + 30 * Math.random(),
}));

//example code from Victory, ignore for now, later will be mapped to real data

function MyChart() {


  return (
    <View style={{ height: 100, width: 300 }}>
      <CartesianChart
        data={DATA}
        xKey="day"
        yKeys={["highTmp"]}
      >
        {({ points }) => (
          <Line points={points.highTmp} color="red" strokeWidth={3} />
        )}
      </CartesianChart>
    </View>
  );
}
const DataDisplay = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>Data Dashboard</Text>
      {/* <Button title="Show Data" onPress={() => {}} /> */}
      <MyChart />
    </View>
  );
};

export default DataDisplay;