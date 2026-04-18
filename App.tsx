import 'react-native-gesture-handler';
import React, { useState } from 'react';
import { StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BLEProvider } from './BLEUniversal';
import { BaselineProvider } from './components/BaselineContext';
import HomeScreen from './screens/HomeScreen';
import BLEScreen from './screens/BLEScreen';
import DataDisplay from './screens/DataDisplay';
import LiveData from './components/LiveData';
import FingerprintsHistory from './components/FingerprintsHistory';
import Analysis from './components/analysis';
import MappedFingerprints from './components/MappedFingerprints';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FloatingActionButton from './components/FloatingActionButton';
import FingerprintModal from './components/FingerprintModal';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Data Stack Navigator
function DataStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DataHome" component={DataDisplay} />
      <Stack.Screen name="LiveData" component={LiveData} />
      <Stack.Screen name="History" component={FingerprintsHistory} />
      <Stack.Screen name="Analysis" component={Analysis} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);


  return (
    <BLEProvider>
      <BaselineProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
          <ImageBackground
            source={require('./pics/background.jpg')}
            style={styles.background}
            imageStyle={{ resizeMode: 'cover' }}
          >
            <SafeAreaView style={styles.safeArea}>
              <NavigationContainer>
                <Tab.Navigator
                  initialRouteName="Home"
                  screenOptions={{ headerShown: false }}
                >
                  <Tab.Screen name="Home" component={DataStack} />
                  <Tab.Screen name="Device" component={BLEScreen} />
                  <Tab.Screen name="Map" component={MappedFingerprints} />
                </Tab.Navigator>
              </NavigationContainer>
            </SafeAreaView>
          </ImageBackground>
        </SafeAreaProvider>
      </GestureHandlerRootView>
      </BaselineProvider>
    </BLEProvider>
  );
}


const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});