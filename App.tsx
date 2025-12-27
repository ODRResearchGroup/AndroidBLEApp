import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import BLEScreen from './screens/BLEScreen';
import DataDisplay from './screens/DataDisplay';
import {BLEProvider} from './BLEUniversal';
import MiniMapOverlay from './components/MiniMapOverlay';

const Stack = createNativeStackNavigator();

//wrapping app in bleprovider for ble across alls screens
export default function App() {
  return (
    <BLEProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Device" component={BLEScreen} />
          <Stack.Screen name="Data Display" component={DataDisplay} />
        </Stack.Navigator>
      </NavigationContainer>
      <MiniMapOverlay />
    </BLEProvider>
  );
}
