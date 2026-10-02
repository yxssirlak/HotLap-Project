import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';

const MAX_G = 1.5;
const VISUALIZER_SIZE = 120; 

export default function LiveTelemetryGForce() {
  const gForceX = useSharedValue(0);
  const gForceY = useSharedValue(0);
  
  // State for the text readout so it updates on the screen
  const [displayG, setDisplayG] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Set how fast we want the hardware sensor to update (in milliseconds)
    // 50ms = 20 times a second (fast enough for telemetry, slow enough to save battery)
    Accelerometer.setUpdateInterval(50);

    const subscription = Accelerometer.addListener(accelerometerData => {
      // expo-sensors returns data where 1.0 = 1G (earth's gravity)
      // x is horizontal tilt, y is vertical tilt
      let latG = accelerometerData.x;
      let lonG = accelerometerData.y;

      // Cap the visualizer at our MAX_G limit so the puck doesn't fly off the screen
      if (latG > MAX_G) latG = MAX_G;
      if (latG < -MAX_G) latG = -MAX_G;
      if (lonG > MAX_G) lonG = MAX_G;
      if (lonG < -MAX_G) lonG = -MAX_G;

      // Update the Reanimated values for the puck animation
      gForceX.value = latG;
      gForceY.value = lonG;

      // Update the React state for the digital text readout
      setDisplayG({ x: latG, y: lonG });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const animatedPuckStyle = useAnimatedStyle(() => {
    const visualPuckOffset = VISUALIZER_SIZE / 2;

    const translateX = interpolate(
      gForceX.value,
      [-MAX_G, MAX_G],
      [-visualPuckOffset, visualPuckOffset]
    );

    const translateY = interpolate(
      gForceY.value,
      [-MAX_G, MAX_G],
      [visualPuckOffset, -visualPuckOffset] 
    );

    return {
      transform: [
        { translateX: withSpring(translateX, { damping: 12, stiffness: 90 }) },
        { translateY: withSpring(translateY, { damping: 12, stiffness: 90 }) },
      ],
    };
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MaterialCommunityIcons name="axis-z-arrow" size={24} color="#A020F0" />
          <Text style={styles.cardTitle}>G-Force</Text>
        </View>
        <View style={styles.liveIndicator}>
          <Text style={styles.liveIndicatorText}>LIVE TELEMETRY</Text>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.visualizerContainer}>
          <View style={styles.gridLineHorizontal} />
          <View style={styles.gridLineVertical} />
          <View style={styles.gridCircleSmall} />
          <View style={styles.gridCircleLarge} />

          <Animated.View style={[styles.puck, animatedPuckStyle]} />
        </View>

        <View style={styles.digitalReadout}>
          <View style={styles.readoutRow}>
            <Text style={styles.readoutLabel}>LAT G</Text>
            {/* We invert the display value so it looks correct depending on phone orientation */}
            <Text style={styles.readoutValue}>{(-displayG.x).toFixed(2)}G</Text>
          </View>
          <View style={styles.readoutRow}>
            <Text style={styles.readoutLabel}>LON G</Text>
            <Text style={styles.readoutValue}>{(-displayG.y).toFixed(2)}G</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1E1E2C', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#2A2A3A' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  liveIndicator: { backgroundColor: 'rgba(160, 32, 240, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  liveIndicatorText: { color: '#A020F0', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  contentContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  visualizerContainer: { width: VISUALIZER_SIZE, height: VISUALIZER_SIZE, borderRadius: VISUALIZER_SIZE / 2, backgroundColor: '#09090F', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  puck: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#A020F0', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#A020F0', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10, elevation: 10 },
  gridLineHorizontal: { position: 'absolute', width: '100%', height: 1, backgroundColor: '#2A2A3A' },
  gridLineVertical: { position: 'absolute', width: 1, height: '100%', backgroundColor: '#2A2A3A' },
  gridCircleSmall: { position: 'absolute', width: VISUALIZER_SIZE * 0.5, height: VISUALIZER_SIZE * 0.5, borderRadius: VISUALIZER_SIZE * 0.25, borderWidth: 1, borderColor: '#2A2A3A' },
  gridCircleLarge: { position: 'absolute', width: VISUALIZER_SIZE * 0.85, height: VISUALIZER_SIZE * 0.85, borderRadius: VISUALIZER_SIZE * 0.425, borderWidth: 1, borderColor: '#2A2A3A' },
  digitalReadout: { paddingLeft: 20, width: 120 },
  readoutRow: { marginBottom: 10 },
  readoutLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  readoutValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
});