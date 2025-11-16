import 'react-native-gesture-handler';
import React from 'react';
import { BLEProvider } from './BLEUniversal';
import HomeScreen from './screens/HomeScreen';
import BLEScreen from './screens/BLEScreen';
import DataDisplay from './screens/DataDisplay';
import MiniMapOverlay from './components/MiniMapOverlay';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LiveData from './components/LiveData';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MappedFingerprints from './components/MappedFingerprints';

const Tab = createBottomTabNavigator();

export default function App() {
  return (

    <BLEProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
                    <Tab.Screen name="Data" component={DataDisplay} />
          <Tab.Screen name="Device" component={BLEScreen} />
                    <Tab.Screen name="map" component={MappedFingerprints} />
        </Tab.Navigator>
           

      </NavigationContainer>

      {/* <MiniMapOverlay /> */}
      </GestureHandlerRootView>
    </BLEProvider>
  );
}
