import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export default function LiveTelemetryGForce() {
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    // Op web heeft de browser geen fysieke accelerometer; sla de listener over
    if (Platform.OS === 'web') {
      return;
    }

    let subscription: any = null;

    const setupSensor = async () => {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) return;

      Accelerometer.setUpdateInterval(50);
      subscription = Accelerometer.addListener((accelerometerData) => {
        setData(accelerometerData);
      });
    };

    setupSensor();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const latG = data.x ? data.x.toFixed(2) : '0.00';
  const longG = data.y ? data.y.toFixed(2) : '0.00';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>LIVE G-FORCE</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {Platform.OS === 'web' ? 'DEMO' : 'LIVE'}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>LATERAL</Text>
          <Text style={styles.metricValue}>{latG} G</Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>ACCEL / BRAKE</Text>
          <Text style={styles.metricValue}>{longG} G</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#252C25',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#303A30',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Michroma',
    fontSize: 14,
    color: '#F4F6EF',
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(194, 240, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C2F044',
    marginRight: 6,
  },
  liveText: {
    fontFamily: 'Manrope',
    fontSize: 10,
    fontWeight: '800',
    color: '#C2F044',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBox: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: 'Manrope',
    fontSize: 11,
    color: '#A9B5A0',
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: 'Michroma',
    fontSize: 20,
    color: '#F4F6EF',
  },
});