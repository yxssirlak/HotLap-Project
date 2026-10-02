import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CommunityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Community Page Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090F', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#FFF', fontSize: 20, fontWeight: 'bold' }
});