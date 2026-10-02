import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RecordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record</Text>
      <Text style={styles.text}>GPS telemetry and route recording coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 28, marginBottom: 10 },
  text: { fontFamily: 'Manrope', color: '#C2F044', fontSize: 16 }
});