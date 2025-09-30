import React, {useState, useEffect} from 'react';
//this is a dependency for navigation between screens, you can find more info here: https://reactnavigation.org/docs/getting-started
//npm install @react-navigation/native
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
// Importing the different screens
import HomeScreen from './screens/HomeScreen';
import BLEScreen from './screens/BLEScreen';
import DataDisplay from './screens/DataDisplay';

const Stack = createNativeStackNavigator();

//App.tsx is the root component that sets up navigation between screens
//It acts as a "brain" coordinating the different parts of the app
//here you can add and import new screens as needed
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Device" component={BLEScreen} />
        <Stack.Screen name="Data Display" component={DataDisplay} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

