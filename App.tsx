import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import Audio from './screens/Audio';
import Photo from './screens/Photo';

const Stack = createNativeStackNavigator();

//wrapping app in bleprovider for ble across alls screens
export default function App() {
  return (
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Audio" component={Audio} />
          <Stack.Screen name="Photo" component={Photo} />
        </Stack.Navigator>
      </NavigationContainer>
  );
}
