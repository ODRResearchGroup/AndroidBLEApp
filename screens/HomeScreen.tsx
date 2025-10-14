import React, {useState, useEffect} from 'react';
import { View, Text, Button } from 'react-native';

type Props = { navigation: any };

//this is the home screen with navigation buttons to other screens
//this function is exported into app.tsx
export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Home Screen</Text>
      <Button
        title="Connect Device"
        onPress={() => navigation.navigate('Device')}
      />
      <Button title="Data Display" 
      onPress={() => navigation.navigate('Data Display')}
   />
    </View>
  );
}