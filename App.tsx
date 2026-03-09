import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import AddNoteScreen from './screens/AddNoteScreen';
import AudioNoteScreen from './screens/AudioNoteScreen';
import ShootPicScreen from './screens/ShootPicScreen';
import PhotoNoteScreen from './screens/PhotoNoteScreen';
import EditPhotoCardScreen from './screens/EditPhotoCardScreen';

export type RootStackParamList = {
  Home: undefined;
  AddNote: undefined;
  AudioNote: { annotationIndex: number };
  ShootPic: { annotationIndex: number };
  PhotoNote: {
    annotationIndex: number;
    photoUri: string;
    timestamp: string;
    capturedAtMs: number;
    latitude: string;       // formatted display string e.g. "55.6050° N"
    longitude: string;      // formatted display string e.g. "12.9923° E"
    latitudeRaw: number | null;   // raw float for GPS bundle
    longitudeRaw: number | null;
    accuracyM: number | null;
  };
  EditPhotoCard: { annotationId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddNote" component={AddNoteScreen} />
        <Stack.Screen name="AudioNote" component={AudioNoteScreen} />
        <Stack.Screen name="ShootPic" component={ShootPicScreen} />
        <Stack.Screen name="PhotoNote" component={PhotoNoteScreen} />
        <Stack.Screen name="EditPhotoCard" component={EditPhotoCardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
