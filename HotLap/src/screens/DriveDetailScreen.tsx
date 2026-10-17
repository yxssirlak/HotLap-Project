import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, Ellipse, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { formatSpeed, formatTravelDistance, getDistanceUnit } from '../utils/units';

type Props = NativeStackScreenProps<RootStackParamList, 'DriveDetail'>;
type TrackPoint = { latitude: number; longitude: number };
type DriveRow = {
  id: string;
  name: string | null;
  started_at: string;
  duration_seconds: number;
  distance_meters: number | string;
  average_speed_kmh: number | string;
  track: TrackPoint[] | null;
};

const LIME = '#C2F044';
const FADE = '#08090A';

// Deterministic low-poly rock texture: jittered grid split into lit/shaded facets.
function buildRockFacets(width: number, height: number) {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const size = 70;
  const cols = Math.ceil(width / size) + 2;
  const rows = Math.ceil(height / size) + 2;
  const grid: Array<Array<[number, number]>> = [];
  for (let r = 0; r < rows; r += 1) {
    grid.push([]);
    for (let c = 0; c < cols; c += 1) {
      grid[r].push([
        (c - 1) * size + (random() - 0.5) * size * 0.8,
        (r - 1) * size + (random() - 0.5) * size * 0.8,
      ]);
    }
  }
  const facets: Array<{ points: string; fill: string }> = [];
  const shade = () => {
    const v = Math.round(24 + random() * 30);
    return `rgb(${v},${v + 2},${v})`;
  };
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const d = grid[r + 1][c];
      const e = grid[r + 1][c + 1];
      facets.push({ points: `${a} ${b} ${d}`, fill: shade() });
      facets.push({ points: `${b} ${e} ${d}`, fill: shade() });
    }
  }
  return facets;
}

// Dark overlay above the car that melts its top, bottom and right edges into the background.
function CarBlend({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="carV" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.25" stopColor={FADE} stopOpacity="0.85" />
          <Stop offset="0.42" stopColor={FADE} stopOpacity="0.2" />
          <Stop offset="0.62" stopColor={FADE} stopOpacity="0.25" />
          <Stop offset="0.8" stopColor={FADE} stopOpacity="0.95" />
        </LinearGradient>
        <LinearGradient id="carH" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0.45" stopColor={FADE} stopOpacity="0" />
          <Stop offset="0.85" stopColor={FADE} stopOpacity="0.55" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#carV)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#carH)" />
    </Svg>
  );
}

function RockBackground({ width, height }: { width: number; height: number }) {
  const facets = useMemo(() => buildRockFacets(width, height), [width, height]);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="edgeFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={FADE} stopOpacity="1" />
          <Stop offset="0.3" stopColor={FADE} stopOpacity="0.55" />
          <Stop offset="0.5" stopColor={FADE} stopOpacity="0.15" />
          <Stop offset="0.72" stopColor={FADE} stopOpacity="0.6" />
          <Stop offset="1" stopColor={FADE} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {facets.map((facet, index) => (
        <Polygon key={index} points={facet.points} fill={facet.fill} stroke={facet.fill} strokeWidth={0.6} />
      ))}
      <Rect x="0" y="0" width={width} height={height} fill="url(#edgeFade)" />
    </Svg>
  );
}
const DISTANCE_UNIT = getDistanceUnit();
// Placeholder until the garage car image is stored per user.
const CAR = { brand: 'Audi', model: 'A3 Mild Hybrid', category: 'Sedan', image: require('../../assets/audi-a3.png') };

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function DriveDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { driveId } = route.params;
  const [drive, setDrive] = useState<DriveRow | null>(null);
  const [loading, setLoading] = useState(true);

  const carOpacity = useRef(new Animated.Value(0)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;
  const cards = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data, error } = await supabase
          .from('drive_sessions')
          .select('id, name, started_at, duration_seconds, distance_meters, average_speed_kmh, track')
          .eq('id', driveId)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setDrive(data as DriveRow | null);
      } catch (error) {
        Alert.alert('Drive unavailable', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [driveId]);

  // Car 0-0.6s, info 0.6-1.1s, cards 1.1-1.6s one by one, then the final state.
  useEffect(() => {
    if (!drive) return;
    const fade = (value: Animated.Value) => Animated.timing(value, {
      toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    Animated.sequence([
      fade(carOpacity),
      fade(infoOpacity),
      Animated.stagger(170, cards.map(fade)),
      fade(buttonOpacity),
    ]).start();
  }, [drive, carOpacity, infoOpacity, cards, buttonOpacity]);

  function publish() {
    if (!drive) return;
    const track = Array.isArray(drive.track)
      ? drive.track.map(({ latitude, longitude }) => ({ latitude, longitude }))
      : [];
    navigation.navigate('ShareActivity', {
      activity: {
        type: 'drive',
        vehicle: `${CAR.brand} ${CAR.model}`,
        durationSeconds: drive.duration_seconds,
        distanceMeters: Number(drive.distance_meters),
        averageSpeedKmh: Number(drive.average_speed_kmh),
        track,
        ...(track[0] ? { startLatitude: track[0].latitude, startLongitude: track[0].longitude } : {}),
      },
    });
  }

  const stats = drive ? [
    { icon: 'timer-outline' as const, label: 'Time', value: formatDuration(drive.duration_seconds) },
    { icon: 'git-compare-outline' as const, label: 'Distance', value: formatTravelDistance(Number(drive.distance_meters), DISTANCE_UNIT, 1) },
    { icon: 'speedometer-outline' as const, label: 'Avg. Speed', value: formatSpeed(Number(drive.average_speed_kmh), DISTANCE_UNIT) },
  ] : [];

  return (
    <View style={styles.container}>
      <RockBackground width={width} height={height} />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.roundButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color="#F4F6EF" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={LIME} style={styles.loader} />
      ) : !drive ? (
        <Text style={styles.empty}>This drive could not be found.</Text>
      ) : (
        <>
          <Animated.View pointerEvents="none" style={[styles.car, { width: width * 1.05, height: width * 0.95, opacity: carOpacity }]}>
            <Svg width={width * 1.05} height={width * 0.95}>
              <Defs>
                <RadialGradient id="carShadow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor="#000" stopOpacity="0.95" />
                  <Stop offset="0.6" stopColor="#000" stopOpacity="0.45" />
                  <Stop offset="1" stopColor="#000" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx={width * 0.36} cy={width * 0.86} rx={width * 0.5} ry={width * 0.09} fill="url(#carShadow)" />
            </Svg>
          </Animated.View>
          <Animated.Image
            source={CAR.image}
            resizeMode="contain"
            style={[styles.car, { width: width * 1.05, height: width * 0.95, opacity: carOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }) }]}
          />
          <CarBlend width={width} height={height} />
          <Animated.View style={[styles.info, { top: insets.top + 72, opacity: infoOpacity }]}>
            <Text style={styles.brand}>{CAR.brand}</Text>
            <Text style={styles.model}>{CAR.model}</Text>
            <Text style={styles.category}>{drive.name || CAR.category}</Text>
          </Animated.View>

          <View style={[styles.cards, { top: insets.top + 160 }]}>
            {stats.map((stat, index) => (
              <Animated.View
                key={stat.label}
                style={[styles.card, {
                  opacity: cards[index],
                  transform: [{ translateX: cards[index].interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
                }]}
              >
                <BlurView intensity={90} tint="dark" experimentalBlurMethod="dimezisBlurView" style={styles.cardInner}>
                  <View pointerEvents="none" style={styles.cardHighlight} />
                  <Ionicons name={stat.icon} size={20} color={LIME} />
                  <Text style={styles.cardLabel}>{stat.label}</Text>
                  <Text style={styles.cardValue}>{stat.value}</Text>
                </BlurView>
              </Animated.View>
            ))}
          </View>

          <Animated.View style={[styles.bottom, { opacity: buttonOpacity, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <Pressable style={styles.publishButton} onPress={publish}>
              <Ionicons name="people-outline" size={18} color="#101311" />
              <Text style={styles.publishText}>PUBLISH DRIVE</Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E100F' },
  topBar: { paddingHorizontal: 20, flexDirection: 'row' },
  roundButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A201A', alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 80 },
  empty: { color: '#A9B5A0', textAlign: 'center', marginTop: 80 },
  car: { position: 'absolute', left: -40, top: '34%' },
  info: { position: 'absolute', left: 20 },
  brand: { color: LIME, fontSize: 14, fontWeight: '800' },
  model: { color: '#F4F6EF', fontSize: 30, fontWeight: '800', marginTop: 2 },
  category: { color: '#A9B5A0', fontSize: 13, marginTop: 4 },
  cards: { position: 'absolute', right: 12, width: 130, gap: 10 },
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(28,30,30,0.45)' },
  cardInner: { padding: 14, backgroundColor: 'rgba(20,22,22,0.35)' },
  cardHighlight: { position: 'absolute', top: 0, left: 14, right: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  cardLabel: { color: 'rgba(244,246,239,0.6)', fontSize: 13, marginTop: 6 },
  cardValue: { color: '#F4F6EF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  bottom: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  publishButton: { minHeight: 56, borderRadius: 18, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  publishText: { color: '#101311', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
