import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RecordScreenProps = {
  navigation: { navigate: (screen: string) => void };
};

export default function RecordScreen({ navigation }: RecordScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 18 }]}>
      <View style={styles.topline}>
        <Text style={styles.eyebrow}>HOTLAP / DRIVE MODE</Text>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>READY</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.orbitOuter}>
          <View style={styles.orbitInner}>
            <Ionicons name="navigate" size={39} color="#101311" />
          </View>
        </View>
        <Text style={styles.title}>Your road.{'\n'}Your story.</Text>
        <Text style={styles.subtitle}>
          Record a precise GPS track, watch your stats come alive and save every drive to your private log.
        </Text>
      </View>

      <View style={styles.featureCard}>
        <FeatureRow icon="locate-outline" title="Navigation-grade GPS" subtitle="Filters weak fixes for a cleaner route" />
        <View style={styles.separator} />
        <FeatureRow icon="analytics-outline" title="Live drive stats" subtitle="Distance, elapsed time and average speed" />
        <View style={styles.separator} />
        <FeatureRow icon="shield-checkmark-outline" title="Private by default" subtitle="Only you can access your recorded route" />
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        <Text style={styles.safetyText}>Set up before you move. Never interact with your phone while driving.</Text>
        <Pressable
          style={styles.startButton}
          onPress={() => navigation.navigate('Map')}
          accessibilityRole="button"
        >
          <Ionicons name="radio-button-on" size={20} color="#101311" />
          <Text style={styles.startButtonText}>OPEN LIVE DRIVE MAP</Text>
          <Ionicons name="arrow-forward" size={17} color="#101311" />
        </Pressable>
        <Text style={styles.helperText}>Location is requested only when you center the map or start a drive.</Text>
      </View>
    </View>
  );
}

function FeatureRow({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={19} color="#C2F044" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="checkmark" size={17} color="#C2F044" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311', paddingHorizontal: 22, paddingBottom: 104 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: 'Manrope-Bold', color: '#879181', fontSize: 9, letterSpacing: 1.7 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#252C25', borderWidth: 1, borderColor: '#303A30' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C2F044' },
  statusText: { fontFamily: 'Manrope-Bold', color: '#C2F044', fontSize: 8, letterSpacing: 1 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  orbitOuter: { width: 114, height: 114, borderRadius: 57, borderWidth: 1, borderColor: '#384435', justifyContent: 'center', alignItems: 'center', marginBottom: 27 },
  orbitInner: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#C2F044', justifyContent: 'center', alignItems: 'center', shadowColor: '#C2F044', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  title: { fontFamily: 'Michroma', fontSize: 25, lineHeight: 38, color: '#F4F6EF', textAlign: 'center' },
  subtitle: { maxWidth: 310, fontFamily: 'Manrope', fontSize: 12, lineHeight: 19, color: '#A9B5A0', textAlign: 'center', marginTop: 12 },
  featureCard: { backgroundColor: '#1A201A', borderWidth: 1, borderColor: '#303A30', borderRadius: 17, paddingHorizontal: 14 },
  featureRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 11 },
  featureIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  featureCopy: { flex: 1 },
  featureTitle: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#F4F6EF' },
  featureSubtitle: { fontFamily: 'Manrope', fontSize: 9, color: '#879181', marginTop: 3 },
  separator: { height: 1, backgroundColor: '#303A30', marginLeft: 47 },
  footer: { paddingTop: 19 },
  safetyText: { fontFamily: 'Manrope', fontSize: 9, color: '#879181', lineHeight: 14, textAlign: 'center', marginBottom: 12 },
  startButton: { height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: '#C2F044' },
  startButtonText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#101311', letterSpacing: 1 },
  helperText: { fontFamily: 'Manrope', fontSize: 9, color: '#687263', textAlign: 'center', marginTop: 9 },
});
