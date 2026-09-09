import React from 'react';
import { Button, Text, View, StyleSheet } from 'react-native';

type Props = { navigation: any };

//this is the home screen with navigation buttons to other screens
//this function is exported into app.tsx
export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text>Lets Get Started!</Text>
      <Button
        title="Live Data"
        onPress={() => navigation.navigate('LiveData')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
