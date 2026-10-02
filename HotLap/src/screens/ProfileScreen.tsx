import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Garage</Text>
      <Text style={styles.text}>Your vehicles and stats coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontFamily: 'Exo2', color: '#F4F6EF', fontSize: 28, marginBottom: 10 },
  text: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 16 }
});