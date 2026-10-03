import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text style={styles.text}>Car meets and road trips coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontFamily: 'SpaceGrotesk', color: '#F4F6EF', fontSize: 28, marginBottom: 10 },
  text: { fontFamily: 'Inter', color: '#A9B5A0', fontSize: 16 }
});