import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { formatElevation, formatSpeed, getDistanceUnit, sprintDistanceLabel, sprintDistanceValue } from '../utils/units';

type Props = NativeStackScreenProps<RootStackParamList, 'Sprint'>;
type Phase = 'selection' | 'countdown' | 'running' | 'demo-running' | 'results' | 'leaderboard';
type BoardFilter = 'global' | 'model';
type SprintPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
};
type SprintResult = {
  elapsedSeconds: number;
  topSpeedKmh: number;
  averageSpeedKmh: number;
  peakG: number;
  peakBrakingG: number;
  peakLateralG: number;
  elevationGain: number;
  startElevation: number | null;
  finishElevation: number | null;
};
type LeaderboardRun = {
  id: string;
  username: string;
  vehicle: string;
  elapsed_seconds: number;
  top_speed_kmh: number;
  created_at: string;
  car_model?: string;
};
type RunAccumulator = SprintResult & {
  distanceMeters: number;
  previousPoint: SprintPoint;
  previousSpeedMps: number;
};

const HOTLAP_LIME = '#C2F044';
const BACKGROUND = '#101311';
const PANEL = '#1A201A';
const MUTED = '#879181';
const GPS_START_ACCURACY_METERS = 20;
const GPS_RUN_ACCURACY_METERS = 30;
const METERS_PER_SECOND_PER_G = 9.80665;
const DEMO_TIME_MULTIPLIER = 4;
const DEMO_RESULTS_TITLE = 'Demo results';
const SPRINT_RESULTS_TITLE = 'Sprint results';
const DEMO_LEADERBOARD_EYEBROW = 'DEMO DATA / SAMPLE TIMES';
const SPRINT_LEADERBOARD_EYEBROW = 'HOTLAP / SPRINT RESULTS';
const DISTANCE_UNIT = getDistanceUnit();
const DISTANCES = [
  { label: '1/4', description: 'QUARTER MILE', meters: 402.34, miles: '0.250' },
  { label: '1/2', description: 'HALF MILE', meters: 804.67, miles: '0.500' },
  { label: '1', description: 'ONE MILE', meters: 1609.34, miles: '1.000' },
] as const;
const DEMO_SPRINT_RESULT: SprintResult = {
  elapsedSeconds: 9.84,
  topSpeedKmh: 142,
  averageSpeedKmh: 91,
  peakG: 1.12,
  peakBrakingG: 0.31,
  peakLateralG: 0.18,
  elevationGain: 3,
  startElevation: 38,
  finishElevation: 41,
};
const DEMO_LEADERBOARD: LeaderboardRun[] = [
  { id: 'demo-1', username: 'apex_marie', vehicle: 'GT-R', car_model: 'gtr', elapsed_seconds: 9.62, top_speed_kmh: 151, created_at: '2026-10-12T10:00:00.000Z' },
  { id: 'demo-2', username: 'k_tanaka', vehicle: 'M3 Competition', car_model: 'm3 competition', elapsed_seconds: 9.71, top_speed_kmh: 148, created_at: '2026-10-12T10:01:00.000Z' },
  { id: 'demo-3', username: 'loubeen', vehicle: '911 Turbo S', car_model: '911 turbo s', elapsed_seconds: 9.80, top_speed_kmh: 146, created_at: '2026-10-12T10:02:00.000Z' },
  { id: 'demo-4', username: 'driftking', vehicle: 'RS3', car_model: 'rs3', elapsed_seconds: 9.84, top_speed_kmh: 142, created_at: '2026-10-12T10:03:00.000Z' },
  { id: 'demo-5', username: 'v8_sunday', vehicle: 'Mustang', car_model: 'mustang', elapsed_seconds: 9.97, top_speed_kmh: 139, created_at: '2026-10-12T10:04:00.000Z' },
  { id: 'demo-6', username: 'nico_g', vehicle: 'Civic R', car_model: 'civic r', elapsed_seconds: 10.12, top_speed_kmh: 136, created_at: '2026-10-12T10:05:00.000Z' },
];

function toPoint(location: Location.LocationObject): SprintPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
    altitude: location.coords.altitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
  };
}

function distanceBetween(a: SprintPoint, b: SprintPoint) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatTime(seconds: number, decimals = 2) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = (safeSeconds % 60).toFixed(decimals).padStart(decimals ? 5 : 2, '0');
  return minutes ? `${minutes}:${remainder}` : remainder;
}

function formatNumber(value: number, decimals = 1) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '0.0';
}

export default function SprintScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const phaseRef = useRef<Phase>('selection');
  const lastFixRef = useRef<SprintPoint | null>(null);
  const runStartRef = useRef<number | null>(null);
  const demoRunStartRef = useRef<number | null>(null);
  const accumulatorRef = useRef<RunAccumulator | null>(null);
  const currentSpeedRef = useRef(0);
  const targetDistanceRef = useRef<number>(DISTANCES[0].meters);
  const runTrackRef = useRef<SprintPoint[]>([]);
  const abortRef = useRef<(message: string) => void>(() => undefined);
  const [phase, setPhase] = useState<Phase>('selection');
  const [selectedDistance, setSelectedDistance] = useState<number>(DISTANCES[0].meters);
  const [countdown, setCountdown] = useState(5);
  const [gpsFix, setGpsFix] = useState<SprintPoint | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [vehicle, setVehicle] = useState('');
  const [carModel, setCarModel] = useState('');
  const [username, setUsername] = useState('Driver');
  const [result, setResult] = useState<SprintResult | null>(null);
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [liveElevation, setLiveElevation] = useState(0);
  const [liveLongitudinalG, setLiveLongitudinalG] = useState(0);
  const [liveLateralG, setLiveLateralG] = useState(0);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('global');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRun[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');

  function changePhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function resetRun() {
    runStartRef.current = null;
    demoRunStartRef.current = null;
    accumulatorRef.current = null;
    runTrackRef.current = [];
    setResult(null);
    setLiveDistance(0);
    setLiveElapsed(0);
    setLiveSpeed(0);
    setLiveElevation(0);
    setLiveLongitudinalG(0);
    setLiveLateralG(0);
    setPosted(false);
  }

  function abortSprint(message: string) {
    if (phaseRef.current !== 'countdown' && phaseRef.current !== 'running' && phaseRef.current !== 'demo-running') return;
    changePhase('selection');
    resetRun();
    demoModeRef.current = false;
    setDemoMode(false);
    Alert.alert('Sprint stopped', message);
  }
  abortRef.current = abortSprint;

  function handleRunPoint(point: SprintPoint) {
    const accumulator = accumulatorRef.current;
    const startedAt = runStartRef.current;
    if (!accumulator || startedAt == null) return;
    if (point.accuracy == null || point.accuracy > GPS_RUN_ACCURACY_METERS) {
      abortRef.current('GPS accuracy dropped. This run was not saved.');
      return;
    }

    const previous = accumulator.previousPoint;
    const elapsedBetweenPoints = (point.timestamp - previous.timestamp) / 1000;
    if (elapsedBetweenPoints <= 0 || elapsedBetweenPoints > 5) {
      abortRef.current('GPS timing was interrupted. This run was not saved.');
      return;
    }
    const segmentMeters = distanceBetween(previous, point);
    const minimumMovement = Math.max(
      1,
      Math.min(3, ((previous.accuracy || 0) + (point.accuracy || 0)) * 0.2),
    );
    if (segmentMeters < minimumMovement) {
      accumulator.previousPoint = point;
      accumulator.previousSpeedMps = 0;
      return;
    }
    const segmentSpeedMps = segmentMeters / elapsedBetweenPoints;
    if (segmentSpeedMps > 110) return;
    runTrackRef.current.push(point);

    const previousSpeed = accumulator.previousSpeedMps;
    const speedMps = point.speed != null && point.speed >= 0
      ? point.speed
      : segmentSpeedMps;
    const longitudinalG = (speedMps - previousSpeed) / elapsedBetweenPoints / METERS_PER_SECOND_PER_G;
    let lateralG = 0;
    if (point.heading != null && previous.heading != null && speedMps > 2) {
      let headingDelta = ((point.heading - previous.heading + 540) % 360) - 180;
      lateralG = speedMps * (headingDelta * Math.PI / 180) / elapsedBetweenPoints / METERS_PER_SECOND_PER_G;
    }
    const totalG = Math.hypot(longitudinalG, lateralG);
    const speedKmh = Math.max(speedMps, segmentSpeedMps) * 3.6;
    const elevationDelta = point.altitude != null && previous.altitude != null
      ? point.altitude - previous.altitude
      : 0;
    const nextDistance = accumulator.distanceMeters + segmentMeters;
    const finishFraction = segmentMeters > 0
      ? Math.max(0, Math.min(1, (targetDistanceRef.current - accumulator.distanceMeters) / segmentMeters))
      : 1;
    const finishElapsed = nextDistance >= targetDistanceRef.current
      ? Math.max(0, (previous.timestamp + elapsedBetweenPoints * 1000 * finishFraction - startedAt) / 1000)
      : 0;
    const nextResult: SprintResult = {
      elapsedSeconds: finishElapsed || (Date.now() - startedAt) / 1000,
      topSpeedKmh: Math.max(accumulator.topSpeedKmh, speedKmh),
      averageSpeedKmh: 0,
      peakG: Math.max(accumulator.peakG, totalG),
      peakBrakingG: Math.max(accumulator.peakBrakingG, -longitudinalG),
      peakLateralG: Math.max(accumulator.peakLateralG, Math.abs(lateralG)),
      elevationGain: accumulator.elevationGain + Math.max(0, elevationDelta),
      startElevation: accumulator.startElevation,
      finishElevation: point.altitude ?? accumulator.finishElevation,
    };

    accumulator.distanceMeters = nextDistance;
    accumulator.previousPoint = point;
    accumulator.previousSpeedMps = speedMps;
    accumulator.topSpeedKmh = nextResult.topSpeedKmh;
    accumulator.peakG = nextResult.peakG;
    accumulator.peakBrakingG = nextResult.peakBrakingG;
    accumulator.peakLateralG = nextResult.peakLateralG;
    accumulator.elevationGain = nextResult.elevationGain;
    accumulator.finishElevation = nextResult.finishElevation;
    setLiveDistance(Math.min(nextDistance, targetDistanceRef.current));
    setLiveSpeed(speedKmh);
    setLiveElevation(nextResult.elevationGain);
    setLiveLongitudinalG(longitudinalG);
    setLiveLateralG(lateralG);

    if (nextDistance >= targetDistanceRef.current) {
      nextResult.averageSpeedKmh = targetDistanceRef.current / finishElapsed * 3.6;
      accumulator.averageSpeedKmh = nextResult.averageSpeedKmh;
      changePhase('results');
      setResult(nextResult);
      Vibration.cancel();
      return;
    }
    setLiveElapsed((Date.now() - startedAt) / 1000);
  }

  function acceptLocation(location: Location.LocationObject) {
    const point = toPoint(location);
    const previous = lastFixRef.current;
    const deltaSeconds = previous ? (point.timestamp - previous.timestamp) / 1000 : 0;
    const derivedSpeed = previous && deltaSeconds > 0
      ? distanceBetween(previous, point) / deltaSeconds
      : 0;
    const speed = point.speed != null && point.speed >= 0 ? point.speed : derivedSpeed;
    currentSpeedRef.current = speed;
    setGpsSpeed(speed);
    setGpsFix(point);

    if (!demoModeRef.current && phaseRef.current === 'countdown' && speed >= 1) {
      abortRef.current('Stay stationary until the countdown finishes.');
    } else if (!demoModeRef.current && phaseRef.current === 'running') {
      handleRunPoint(point);
    }
    lastFixRef.current = point;
  }

  useEffect(() => {
    if (!isFocused) return undefined;
    let cancelled = false;

    async function prepareSprint() {
      setGpsLoading(true);
      try {
        if (Platform.OS === 'web') return;
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Your session has expired. Sign in again to record a sprint.');

        const { data: profile, error: profileError } = await supabase.from('profiles')
          .select('username, car_brand, car_model')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (cancelled) return;
        if (profile) {
          setUsername(profile.username || 'Driver');
          const savedCar = [profile.car_brand, profile.car_model].filter(Boolean).join(' ').trim();
          if (savedCar) {
            setVehicle((current) => current || savedCar);
            setCarModel(profile.car_model || '');
          }
        }
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Location access needed', 'Allow location access to check GPS accuracy before starting a track sprint.');
          return;
        }

        const firstFix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          mayShowUserSettingsDialog: true,
        });
        if (cancelled) return;
        acceptLocation(firstFix);
        subscriptionRef.current?.remove();
        subscriptionRef.current = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 1,
          timeInterval: 1000,
          mayShowUserSettingsDialog: true,
        }, acceptLocation, (error) => {
          if (phaseRef.current === 'countdown' || phaseRef.current === 'running') {
            abortRef.current('GPS tracking stopped. This run was not saved.');
          } else {
            Alert.alert('GPS tracking stopped', error);
          }
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not prepare the sprint.';
          Alert.alert('Sprint setup unavailable', message);
        }
      } finally {
        if (!cancelled) setGpsLoading(false);
      }
    }

    void prepareSprint();
    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [isFocused]);

  useEffect(() => {
    if (isFocused || (phaseRef.current !== 'countdown' && phaseRef.current !== 'running')) return;
    abortRef.current('The sprint was stopped when you left the recording screen.');
  }, [isFocused]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown === 0) {
      const timer = setTimeout(() => {
        if (demoMode) {
          demoRunStartRef.current = Date.now();
          changePhase('demo-running');
          return;
        }
        const point = lastFixRef.current;
        if (!point || point.accuracy == null || point.accuracy > GPS_START_ACCURACY_METERS ||
          currentSpeedRef.current >= 1 || Date.now() - point.timestamp > 5000) {
          abortRef.current('GPS accuracy or stationary requirements changed during the countdown.');
          return;
        }
        runStartRef.current = Date.now();
        runTrackRef.current = [point];
        accumulatorRef.current = {
          elapsedSeconds: 0,
          topSpeedKmh: 0,
          averageSpeedKmh: 0,
          peakG: 0,
          peakBrakingG: 0,
          peakLateralG: 0,
          elevationGain: 0,
          startElevation: point.altitude,
          finishElevation: point.altitude,
          distanceMeters: 0,
          previousPoint: point,
          previousSpeedMps: 0,
        };
        changePhase('running');
        Vibration.vibrate(180);
      }, 700);
      return () => clearTimeout(timer);
    }
    Vibration.vibrate(90);
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, demoMode]);

  useEffect(() => {
    if (phase === 'demo-running') {
      const nominalDuration = selectedDistance / (91 / 3.6);
      const timer = setInterval(() => {
        const startedAt = demoRunStartRef.current;
        if (startedAt == null) return;
        const elapsed = ((Date.now() - startedAt) / 1000) * DEMO_TIME_MULTIPLIER;
        const progress = Math.min(1, elapsed / nominalDuration);
        setLiveElapsed(elapsed);
        setLiveDistance(selectedDistance * progress);
        setLiveSpeed(Math.round(142 * Math.sin(progress * Math.PI / 2)));
        setLiveElevation(3 * progress);
        setLiveLongitudinalG(progress < 0.25 ? 0.7 * (1 - progress / 0.25) : 0);
        setLiveLateralG(Math.sin(progress * Math.PI * 4) * 0.18);
        if (progress >= 1) {
          setResult({
            ...DEMO_SPRINT_RESULT,
            elapsedSeconds: nominalDuration,
            averageSpeedKmh: selectedDistance / nominalDuration * 3.6,
          });
          changePhase('results');
        }
      }, 100);
      return () => clearInterval(timer);
    }
    if (phase !== 'running') return undefined;
    const timer = setInterval(() => {
      const startedAt = runStartRef.current;
      if (startedAt != null) setLiveElapsed((Date.now() - startedAt) / 1000);
    }, 50);
    return () => clearInterval(timer);
  }, [phase, selectedDistance]);

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running' && phase !== 'demo-running') return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') abortRef.current('The sprint was stopped because HotLap left the foreground.');
    });
    return () => subscription.remove();
  }, [phase]);

  const gpsAccuracy = gpsFix?.accuracy;
  const gpsReady = gpsAccuracy != null &&
    gpsAccuracy <= GPS_START_ACCURACY_METERS &&
    gpsSpeed < 1 &&
    gpsFix != null &&
    Date.now() - gpsFix.timestamp < 5000;
  const remainingDistance = Math.max(0, selectedDistance - liveDistance);
  const resultsTitle = demoMode ? DEMO_RESULTS_TITLE : SPRINT_RESULTS_TITLE;
  const leaderboardEyebrow = demoMode ? DEMO_LEADERBOARD_EYEBROW : SPRINT_LEADERBOARD_EYEBROW;

  function getGpsHint() {
    if (gpsLoading) return 'Waiting for a fresh location fix…';
    if (gpsFix == null || gpsAccuracy == null) {
      return 'Move outdoors with a clear view of the sky and check that Precise Location is enabled.';
    }
    if (gpsSpeed >= 1) return 'Come to a complete stop before starting.';
    if (gpsAccuracy > GPS_START_ACCURACY_METERS) {
      return `Current accuracy ±${Math.round(gpsAccuracy)} m. Keep the phone still and wait for a fix of ${GPS_START_ACCURACY_METERS} m or better.`;
    }
    if (Date.now() - gpsFix.timestamp >= 5000) return 'Waiting for an updated GPS fix…';
    return `GPS fix ready · ±${Math.round(gpsAccuracy)} m`;
  }

  function startCountdown() {
    demoModeRef.current = false;
    setDemoMode(false);
    const point = lastFixRef.current;
    if (point == null || point.accuracy == null || point.accuracy > GPS_START_ACCURACY_METERS ||
      currentSpeedRef.current >= 1 || Date.now() - point.timestamp > 5000) {
      Alert.alert(
        'GPS not ready',
        `${getGpsHint()}\n\nGPS accuracy depends on your phone and surroundings. For the best fix, go outdoors, enable Precise Location, and keep the phone still with a clear view of the sky.`,
      );
      return;
    }
    targetDistanceRef.current = selectedDistance;
    resetRun();
    setCountdown(5);
    changePhase('countdown');
  }

  async function postRun() {
    if (!result || demoMode || posting) return;
    setPosting(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Your session has expired. Sign in again to post this sprint.');
      const vehicleName = vehicle.trim();
      const modelName = (carModel.trim() || vehicleName).toLocaleLowerCase();
      const { error } = await supabase.from('sprint_runs').insert({
        user_id: user.id,
        username: username.trim() || 'Driver',
        vehicle: vehicleName || 'Unspecified vehicle',
        car_model: modelName || 'Unspecified',
        distance_meters: selectedDistance,
        elapsed_seconds: Number(result.elapsedSeconds.toFixed(3)),
        top_speed_kmh: Number(result.topSpeedKmh.toFixed(2)),
        average_speed_kmh: Number(result.averageSpeedKmh.toFixed(2)),
        peak_g: Number(result.peakG.toFixed(3)),
        peak_braking_g: Number(result.peakBrakingG.toFixed(3)),
        peak_lateral_g: Number(result.peakLateralG.toFixed(3)),
        weather_label: null,
        temperature_c: null,
        elevation_gain_m: Number(result.elevationGain.toFixed(1)),
        start_elevation_m: result.startElevation == null ? null : Number(result.startElevation.toFixed(1)),
        finish_elevation_m: result.finishElevation == null ? null : Number(result.finishElevation.toFixed(1)),
      });
      if (error) throw error;
      setPosted(true);
      setBoardFilter('global');
      changePhase('leaderboard');
    } catch (error) {
      Alert.alert(
        'Could not post sprint',
        `${error instanceof Error ? error.message : 'Please try again.'}\n\nIf this is a new setup, run supabase/sprint-recording.sql in the Supabase SQL Editor.`,
      );
    } finally {
      setPosting(false);
    }
  }

  function shareSprintToCommunity() {
    if (!result || demoMode) return;
    const track = runTrackRef.current.map(({ latitude, longitude }) => ({ latitude, longitude }));
    const firstPoint = track[0];
    navigation.navigate('ShareActivity', {
      activity: {
        type: 'sprint',
        vehicle: vehicle.trim(),
        durationSeconds: result.elapsedSeconds,
        distanceMeters: selectedDistance,
        averageSpeedKmh: result.averageSpeedKmh,
        topSpeedKmh: result.topSpeedKmh,
        details: {
          peakG: result.peakG,
          peakBrakingG: result.peakBrakingG,
          peakLateralG: result.peakLateralG,
          elevationGainMeters: result.elevationGain,
        },
        track,
        ...(firstPoint ? {
          startLatitude: firstPoint.latitude,
          startLongitude: firstPoint.longitude,
        } : {}),
      },
    });
  }

  async function loadLeaderboard(filter: BoardFilter) {
    setLeaderboardLoading(true);
    setLeaderboardError('');
    if (demoMode) {
      const distance = DISTANCES.find((item) => item.meters === selectedDistance);
      const sampleRuns = distance?.meters === DISTANCES[0].meters
        ? DEMO_LEADERBOARD
        : DEMO_LEADERBOARD.map((run, index) => ({
          ...run,
          elapsed_seconds: run.elapsed_seconds * (distance?.meters === DISTANCES[1].meters ? 1.85 : 3.55) + index * 0.07,
        }));
      const filteredRuns = filter === 'model'
        ? sampleRuns.filter((run) => run.car_model === (carModel.trim() || vehicle.trim()).toLocaleLowerCase())
        : sampleRuns;
      setLeaderboard(filteredRuns);
      setLeaderboardLoading(false);
      return;
    }
    try {
      let query = supabase.from('sprint_runs')
        .select('id, username, vehicle, elapsed_seconds, top_speed_kmh, created_at')
        .eq('distance_meters', selectedDistance)
        .eq('is_posted', true)
        .order('elapsed_seconds', { ascending: true })
        .order('top_speed_kmh', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100);
      if (filter === 'model') {
        const modelName = (carModel.trim() || vehicle.trim()).toLocaleLowerCase();
        if (!modelName) {
          setLeaderboard([]);
          setLeaderboardError('Add a car model to view its leaderboard.');
          return;
        }
        query = query.eq('car_model', modelName);
      }
      const { data, error } = await query;
      if (error) throw error;
      setLeaderboard((data || []) as LeaderboardRun[]);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : 'Could not load the leaderboard.');
    } finally {
      setLeaderboardLoading(false);
    }
  }

  useEffect(() => {
    if (phase === 'leaderboard') void loadLeaderboard(boardFilter);
  }, [phase, boardFilter, demoMode, selectedDistance, carModel, vehicle]);

  function returnToSelection() {
    resetRun();
    demoModeRef.current = false;
    setDemoMode(false);
    changePhase('selection');
  }

  function previewDemo() {
    resetRun();
    demoModeRef.current = true;
    setDemoMode(true);
    const elapsedSeconds = DEMO_SPRINT_RESULT.elapsedSeconds *
      (selectedDistance / DISTANCES[0].meters);
    setResult({
      ...DEMO_SPRINT_RESULT,
      elapsedSeconds,
      averageSpeedKmh: selectedDistance / elapsedSeconds * 3.6,
    });
    changePhase('results');
  }

  function startSimulatedTest() {
    resetRun();
    demoModeRef.current = true;
    setDemoMode(true);
    targetDistanceRef.current = selectedDistance;
    setCountdown(5);
    changePhase('countdown');
  }

  function handleBack() {
    if (phase === 'selection') {
      navigation.goBack();
    } else if (phase === 'leaderboard' && !posted) {
      changePhase('results');
    } else if (phase === 'results') {
      returnToSelection();
    } else {
      returnToSelection();
    }
  }

  function renderHeader(title: string, eyebrow = 'HOTLAP / SPRINT') {
    return (
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={19} color={BACKGROUND} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
    );
  }

  if (phase === 'countdown') {
    if (countdown === 0) {
      return (
        <View style={[styles.goCountdownScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Text style={styles.goCountdownText}>GO</Text>
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.eyebrow}>{demoMode ? 'SIMULATED TEST · GPS BYPASSED' : `TRACK TEST · ${sprintDistanceLabel(selectedDistance, DISTANCE_UNIT)}`}</Text>
        <Text style={styles.countdownNumber}>{countdown}</Text>
        <Text style={styles.bodyCenter}>{demoMode ? 'Simulation only. No GPS data or real run will be recorded.' : 'Stay focused on the track. HotLap will finish at the selected distance.'}</Text>
      </View>
    );
  }

  if (phase === 'running' || phase === 'demo-running') {
    const gDotX = Math.max(-1, Math.min(1, liveLateralG / 1.2)) * 57;
    const gDotY = -Math.max(-1, Math.min(1, liveLongitudinalG / 1.2)) * 57;
    return (
      <View style={[styles.container, styles.liveContainer, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.liveTopline}>
          <View style={styles.liveMode}>
            <View style={styles.liveDot} />
            <Text style={styles.liveModeText}>{demoMode ? 'SIMULATED TEST · NO GPS' : 'TRACK TEST · LIVE'}</Text>
          </View>
          <Text style={styles.liveWeather}>WEATHER --</Text>
        </View>
        <BlurView intensity={24} tint="dark" blurMethod="dimezisBlurView" style={styles.liveTimerBlock}>
          <Text style={styles.liveDistanceLabel}>{sprintDistanceLabel(selectedDistance, DISTANCE_UNIT)}</Text>
          <Text style={styles.liveTimer}>{formatTime(liveElapsed)}</Text>
          <Text style={styles.liveRemaining}>{sprintDistanceValue(remainingDistance, DISTANCE_UNIT)} remaining</Text>
        </BlurView>
        <BlurView intensity={32} tint="dark" blurMethod="dimezisBlurView" style={styles.gForceCard}>
          <Text style={styles.gLabelTop}>BRAKE</Text>
          <View style={styles.gDiagram}>
            <View style={[styles.gRing, styles.gRingOuter]} />
            <View style={[styles.gRing, styles.gRingMiddle]} />
            <View style={[styles.gRing, styles.gRingInner]} />
            <View style={styles.gCrossHorizontal} />
            <View style={styles.gCrossVertical} />
            <View style={[styles.gDot, { transform: [{ translateX: gDotX }, { translateY: gDotY }] }]} />
            <Text style={styles.gLeft}>L</Text>
            <Text style={styles.gRight}>R</Text>
          </View>
          <View style={styles.gAxisLabels}>
            <Text style={styles.gLabelBottom}>ACCEL {formatNumber(Math.max(0, liveLongitudinalG), 2)} g</Text>
            <Text style={styles.gLabelBottom}>LAT {formatNumber(liveLateralG, 2)} g</Text>
          </View>
        </BlurView>
        <View style={styles.liveMetrics}>
          <View>
            <Text style={styles.liveMetricValue}>{formatSpeed(liveSpeed, DISTANCE_UNIT).split(' ')[0]}</Text>
            <Text style={styles.liveMetricLabel}>{DISTANCE_UNIT === 'mi' ? 'MPH' : 'KM/H'}</Text>
          </View>
          <View style={styles.liveMetricDivider} />
          <View style={styles.liveMetricRight}>
            <Text style={styles.liveMetricValue}>{formatElevation(liveElevation, DISTANCE_UNIT)}</Text>
            <Text style={styles.liveMetricLabel}>ELEVATION GAIN</Text>
          </View>
        </View>
        <View style={styles.liveProgressTrack}>
          <View style={[styles.liveProgressFill, { width: `${Math.min(100, (liveDistance / selectedDistance) * 100)}%` }]} />
        </View>
        <Text style={styles.liveSafety}>{demoMode ? 'SIMULATED DATA · NO REAL RUN RECORDED' : 'TIMING AUTOMATIC · DO NOT INTERACT WHILE MOVING'}</Text>
      </View>
    );
  }

  if (phase === 'results' && result) {
    return (
      <View style={styles.container}>
        {renderHeader(resultsTitle)}
        <ScrollView contentContainerStyle={[styles.resultsContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHero}>
            <Text style={styles.eyebrow}>{demoMode ? `DEMO RESULT · ${sprintDistanceLabel(selectedDistance, DISTANCE_UNIT)}` : `RESULT · ${sprintDistanceLabel(selectedDistance, DISTANCE_UNIT)}`}</Text>
            <Text style={styles.resultTime}>{formatTime(result.elapsedSeconds)}</Text>
            <Text style={styles.resultSubtitle}>{demoMode ? 'Preview only · no real sprint recorded' : 'Track test'}</Text>
          </View>
          <View style={styles.resultCard}>
            <MetricRow label="Top speed" value={formatSpeed(result.topSpeedKmh, DISTANCE_UNIT)} />
            <MetricRow label="Average speed" value={formatSpeed(result.averageSpeedKmh, DISTANCE_UNIT)} />
            <MetricRow label="Peak G-force" value={`${formatNumber(result.peakG, 2)} g`} />
            <MetricRow label="Peak braking" value={`${formatNumber(result.peakBrakingG, 2)} g`} />
            <MetricRow label="Peak lateral" value={`${formatNumber(result.peakLateralG, 2)} g`} />
            <MetricRow label="Weather" value="Not available" />
            <MetricRow label="Elevation gain" value={formatElevation(result.elevationGain, DISTANCE_UNIT)} />
            <MetricRow label="Start elevation" value={result.startElevation == null ? '--' : formatElevation(result.startElevation, DISTANCE_UNIT)} />
            <MetricRow label="Finish elevation" value={result.finishElevation == null ? '--' : formatElevation(result.finishElevation, DISTANCE_UNIT)} />
            <MetricRow label="Vehicle" value={vehicle.trim() || 'Unspecified vehicle'} last />
          </View>
          <Text style={styles.resultsFootnote}>{demoMode ? 'These sample figures are for preview only. Demo runs cannot be saved or posted.' : 'GPS-derived figures can vary with device accuracy. Weather is not collected or shared.'}</Text>
          {demoMode ? (
            <View style={styles.demoNotice}>
              <Ionicons name="information-circle-outline" size={17} color={HOTLAP_LIME} />
              <Text style={styles.demoNoticeText}>DEMO PREVIEW · No GPS timing, recording, or posting</Text>
            </View>
          ) : (
            <>
              <Pressable style={[styles.primaryButton, (posting || posted) && styles.buttonDimmed]} onPress={() => void postRun()} disabled={posting || posted}>
                {posting ? <ActivityIndicator color={BACKGROUND} /> : <Ionicons name={posted ? 'checkmark' : 'cloud-upload-outline'} size={18} color={BACKGROUND} />}
                <Text style={styles.primaryButtonText}>{posting ? 'POSTING RUN…' : posted ? 'POSTED TO LEADERBOARD' : 'POST SPRINT'}</Text>
              </Pressable>
              <Pressable style={styles.communityShareButton} onPress={shareSprintToCommunity}>
                <Ionicons name="people-outline" size={17} color={HOTLAP_LIME} />
                <Text style={styles.communityShareText}>SHARE TO COMMUNITY</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={returnToSelection} disabled={posting}>
                <Ionicons name="trash-outline" size={17} color="#FF766C" />
                <Text style={styles.deleteButtonText}>DELETE RUN</Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.textButton} onPress={() => { setBoardFilter('global'); changePhase('leaderboard'); }}>
            <Text style={styles.textButtonText}>VIEW LEADERBOARD</Text>
            <Ionicons name="arrow-forward" size={15} color={HOTLAP_LIME} />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (phase === 'leaderboard') {
    return (
      <View style={styles.container}>
        {renderHeader('Leaderboard', leaderboardEyebrow)}
        <View style={styles.boardDistanceRow}>
          {DISTANCES.map((distance) => (
            <Pressable
              key={distance.meters}
              style={[styles.boardDistance, selectedDistance === distance.meters && styles.boardDistanceActive]}
              onPress={() => {
                targetDistanceRef.current = distance.meters;
                setSelectedDistance(distance.meters);
              }}
            >
              <Text style={[styles.boardDistanceText, selectedDistance === distance.meters && styles.boardDistanceTextActive]}>
                {sprintDistanceLabel(distance.meters, DISTANCE_UNIT)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.boardFilters}>
          <FilterButton label="GLOBAL" active={boardFilter === 'global'} onPress={() => setBoardFilter('global')} />
          <FilterButton label="MY CAR" active={boardFilter === 'model'} onPress={() => setBoardFilter('model')} />
          <View style={[styles.filterButton, styles.filterDisabled]}>
            <Text style={styles.filterDisabledText}>FRIENDS</Text>
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.rankColumn]}>#</Text>
          <Text style={[styles.tableHeaderText, styles.driverColumn]}>DRIVER / CAR</Text>
          <Text style={[styles.tableHeaderText, styles.timeColumn]}>TIME</Text>
          <Text style={[styles.tableHeaderText, styles.topColumn]}>{DISTANCE_UNIT === 'mi' ? 'TOP MPH' : 'TOP KM/H'}</Text>
        </View>
        {leaderboardLoading ? (
          <View style={styles.boardMessage}><ActivityIndicator color={HOTLAP_LIME} /><Text style={styles.boardMessageText}>LOADING RESULTS…</Text></View>
        ) : leaderboardError ? (
          <View style={styles.boardMessage}>
            <Ionicons name="information-circle-outline" size={22} color={HOTLAP_LIME} />
            <Text style={styles.boardMessageText}>{leaderboardError}</Text>
            <Pressable onPress={() => void loadLeaderboard(boardFilter)} style={styles.retryButton}><Text style={styles.retryText}>RETRY</Text></Pressable>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.boardMessage}>
            <Ionicons name="trophy-outline" size={28} color={HOTLAP_LIME} />
            <Text style={styles.boardMessageTitle}>{demoMode ? 'No sample times for this car' : 'No posted times yet'}</Text>
            <Text style={styles.boardMessageText}>{demoMode ? 'Choose Global to preview the sample leaderboard.' : 'Complete and post a sprint to set the first time.'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.boardList} showsVerticalScrollIndicator={false}>
            {leaderboard.map((run, index) => (
              <View key={run.id} style={[styles.boardRow, run.username === username && styles.boardRowYou]}>
                <Text style={[styles.rankColumn, styles.rankText]}>{index + 1}</Text>
                <View style={styles.driverColumn}>
                  <Text numberOfLines={1} style={styles.driverName}>{run.username}{run.username === username ? ' · YOU' : ''}</Text>
                  <Text numberOfLines={1} style={styles.driverCar}>{run.vehicle}</Text>
                </View>
                <Text style={[styles.timeColumn, styles.boardTime]}>{formatTime(Number(run.elapsed_seconds))} s</Text>
                <Text style={[styles.topColumn, styles.boardTop]}>{Math.round(Number(run.top_speed_kmh) * (DISTANCE_UNIT === 'mi' ? 0.621371 : 1))}</Text>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={[styles.boardFooter, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <Text style={styles.boardNote}>{demoMode ? 'SAMPLE TIMES · NOT REAL RECORDS' : 'FASTEST TIME WINS · TOP SPEED BREAKS TIES'}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => posted ? returnToSelection() : changePhase('results')}>
            <Text style={styles.secondaryButtonText}>{posted ? 'BACK TO SPRINTS' : 'BACK TO RESULTS'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader('Sprint')}
      <ScrollView contentContainerStyle={[styles.selectionContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="speedometer-outline" size={22} color={HOTLAP_LIME} /></View>
          <Text style={styles.title}>One run. All focus.</Text>
          <Text style={styles.body}>Choose your distance, get set, and let HotLap time the run automatically.</Text>
        </View>

        <Text style={styles.sectionLabel}>SELECT DISTANCE</Text>
        <View style={styles.distanceOptions}>
          {DISTANCES.map((distance) => (
            <Pressable
              key={distance.meters}
              style={[styles.distanceOption, selectedDistance === distance.meters && styles.distanceOptionActive]}
              onPress={() => {
                targetDistanceRef.current = distance.meters;
                setSelectedDistance(distance.meters);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedDistance === distance.meters }}
            >
              <View style={styles.distanceTextGroup}>
                <Text style={[styles.distanceOptionLabel, selectedDistance === distance.meters && styles.distanceOptionLabelActive]}>
                  {DISTANCE_UNIT === 'mi'
                    ? <>{distance.label} <Text style={styles.distanceMile}>MILE</Text></>
                    : sprintDistanceLabel(distance.meters, DISTANCE_UNIT)}
                </Text>
                <Text style={styles.distanceDescription}>{DISTANCE_UNIT === 'mi' ? distance.description : 'METRIC DISTANCE'}</Text>
              </View>
              <Text style={styles.distanceMiles}>{sprintDistanceValue(distance.meters, DISTANCE_UNIT)}</Text>
              {selectedDistance === distance.meters && <Ionicons name="checkmark-circle" size={18} color={HOTLAP_LIME} />}
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>YOUR VEHICLE</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}><Ionicons name="car-sport-outline" size={19} color={HOTLAP_LIME} /></View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleLabel}>GARAGE VEHICLE</Text>
            <TextInput
              style={styles.vehicleInput}
              value={vehicle}
              onChangeText={(value) => {
                setVehicle(value);
                setCarModel(value.trim());
              }}
              placeholder="Add your car"
              placeholderTextColor="#687263"
              maxLength={60}
              returnKeyType="done"
              accessibilityLabel="Sprint vehicle"
            />
          </View>
          <Ionicons name="create-outline" size={17} color={MUTED} />
        </View>

        <View style={styles.gpsStatusCard}>
          <View style={[styles.gpsStatusDot, gpsReady && styles.gpsStatusDotReady]} />
          <View style={styles.gpsStatusCopy}>
            <Text style={styles.gpsStatusTitle}>
              {gpsLoading
                ? 'CHECKING GPS'
                : gpsReady
                  ? 'GPS READY · STATIONARY'
                  : gpsSpeed >= 1
                    ? 'STOP TO START'
                    : gpsAccuracy == null || gpsAccuracy > GPS_START_ACCURACY_METERS
                      ? 'WAITING FOR PRECISE GPS'
                      : 'WAITING FOR FRESH GPS FIX'}
            </Text>
            <Text style={styles.gpsStatusHint}>
              {getGpsHint()}
            </Text>
          </View>
          {gpsAccuracy != null && <Text style={styles.gpsAccuracy}>{Math.round(gpsAccuracy)} m</Text>}
        </View>

        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark-outline" size={17} color={HOTLAP_LIME} />
          <Text style={styles.safetyCopy}>For track testing only. Start while stationary with a clear track ahead; never touch your phone during a run.</Text>
        </View>

        <Text style={styles.demoHint}>Test the full countdown and live sprint screens without GPS. This simulation cannot be posted as a real run.</Text>
        <Pressable style={styles.demoButton} onPress={startSimulatedTest} accessibilityRole="button">
          <Ionicons name="play-circle-outline" size={17} color={HOTLAP_LIME} />
          <Text style={styles.demoButtonText}>START SIMULATED TEST</Text>
        </Pressable>
        <Pressable style={styles.demoButton} onPress={previewDemo} accessibilityRole="button">
          <Ionicons name="eye-outline" size={17} color={HOTLAP_LIME} />
          <Text style={styles.demoButtonText}>PREVIEW SAMPLE RESULTS</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryButton, (!gpsReady || gpsLoading) && styles.buttonDimmed]}
          onPress={startCountdown}
          disabled={!gpsReady || gpsLoading}
          accessibilityRole="button"
        >
          <Ionicons name="radio-button-on" size={19} color={BACKGROUND} />
          <Text style={styles.primaryButtonText}>START SPRINT</Text>
          <Ionicons name="arrow-forward" size={17} color={BACKGROUND} />
        </Pressable>
        <Pressable style={styles.textButton} onPress={() => { setBoardFilter('global'); changePhase('leaderboard'); }}>
          <Ionicons name="trophy-outline" size={16} color={HOTLAP_LIME} />
          <Text style={styles.textButtonText}>VIEW LEADERBOARDS</Text>
          <Ionicons name="arrow-forward" size={15} color={HOTLAP_LIME} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MetricRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metricRow, last && styles.metricRowLast]}>
      <Text style={styles.metricName}>{label}</Text>
      <Text style={styles.metricResult}>{value}</Text>
    </View>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterButton, active && styles.filterButtonActive]} onPress={onPress}>
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  goCountdownScreen: { flex: 1, backgroundColor: HOTLAP_LIME, justifyContent: 'center', alignItems: 'center' },
  goCountdownText: { fontFamily: 'ChakraPetch', fontSize: 112, lineHeight: 128, color: BACKGROUND, fontWeight: '900', letterSpacing: 4 },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 13, gap: 13 },
  backButton: { width: 39, height: 39, borderRadius: 13, backgroundColor: HOTLAP_LIME, justifyContent: 'center', alignItems: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: 'Manrope-Bold', color: HOTLAP_LIME, fontSize: 8, letterSpacing: 1.6 },
  headerTitle: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 16, marginTop: 2 },
  headerSpacer: { width: 39 },
  selectionContent: { paddingHorizontal: 22, paddingTop: 8 },
  intro: { alignItems: 'center', paddingTop: 10, paddingBottom: 25 },
  introIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#252C25', borderWidth: 1, borderColor: '#384435', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 19, textAlign: 'center' },
  body: { maxWidth: 300, fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  sectionLabel: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 9, letterSpacing: 1.5, marginTop: 4, marginBottom: 9 },
  distanceOptions: { gap: 8, marginBottom: 18 },
  distanceOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, backgroundColor: PANEL, borderRadius: 14, borderWidth: 1, borderColor: '#303A30' },
  distanceOptionActive: { borderColor: HOTLAP_LIME, backgroundColor: '#20281C' },
  distanceTextGroup: { flex: 1 },
  distanceOptionLabel: { fontFamily: 'ChakraPetch', fontSize: 16, color: '#F4F6EF' },
  distanceOptionLabelActive: { color: HOTLAP_LIME },
  distanceMile: { fontFamily: 'Manrope-Bold', fontSize: 9 },
  distanceDescription: { fontFamily: 'Manrope-Bold', fontSize: 8, color: MUTED, letterSpacing: 0.8, marginTop: 2 },
  distanceMiles: { fontFamily: 'Manrope', fontSize: 10, color: '#A9B5A0' },
  vehicleCard: { minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, backgroundColor: PANEL, borderWidth: 1, borderColor: '#303A30', borderRadius: 14, marginBottom: 18 },
  vehicleIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  vehicleCopy: { flex: 1 },
  vehicleLabel: { fontFamily: 'Manrope-Bold', fontSize: 8, color: MUTED, letterSpacing: 1.2 },
  vehicleInput: { height: 27, color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 12, padding: 0 },
  gpsStatusCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: PANEL, borderWidth: 1, borderColor: '#303A30', borderRadius: 13, marginBottom: 12 },
  gpsStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#879181' },
  gpsStatusDotReady: { backgroundColor: HOTLAP_LIME },
  gpsStatusCopy: { flex: 1 },
  gpsStatusTitle: { fontFamily: 'Manrope-Bold', color: '#F4F6EF', fontSize: 8, letterSpacing: 0.8 },
  gpsStatusHint: { fontFamily: 'Manrope', color: MUTED, fontSize: 8, marginTop: 4 },
  gpsAccuracy: { fontFamily: 'Manrope-Bold', color: HOTLAP_LIME, fontSize: 9 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, backgroundColor: '#171D17', borderRadius: 12, marginBottom: 14 },
  safetyCopy: { flex: 1, fontFamily: 'Manrope', color: MUTED, fontSize: 9, lineHeight: 14 },
  primaryButton: { minHeight: 53, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, paddingHorizontal: 14, backgroundColor: HOTLAP_LIME, borderRadius: 14 },
  primaryButtonText: { fontFamily: 'Manrope-Bold', color: BACKGROUND, fontSize: 11, letterSpacing: 1.1 },
  communityShareButton: { minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 9, borderWidth: 1, borderColor: 'rgba(194,240,68,0.4)', borderRadius: 13, backgroundColor: '#20281C' },
  communityShareText: { fontFamily: 'Manrope-Bold', color: HOTLAP_LIME, fontSize: 9, letterSpacing: 1 },
  buttonDimmed: { opacity: 0.45 },
  textButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  textButtonText: { fontFamily: 'Manrope-Bold', fontSize: 9, color: HOTLAP_LIME, letterSpacing: 1 },
  secondaryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#3A4638', borderRadius: 12 },
  secondaryButtonText: { fontFamily: 'Manrope-Bold', color: '#D4DDCF', fontSize: 9, letterSpacing: 1 },
  bodyCenter: { maxWidth: 280, fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 14 },
  countdownNumber: { fontFamily: 'ChakraPetch', fontSize: 116, color: HOTLAP_LIME, marginTop: 18 },
  liveContainer: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  liveTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveMode: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: HOTLAP_LIME },
  liveModeText: { maxWidth: 190, fontFamily: 'Manrope-Bold', color: '#E2E9DC', fontSize: 8, letterSpacing: 0.9 },
  liveWeather: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 0.8 },
  liveTimerBlock: { alignItems: 'center', marginTop: 18, paddingVertical: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(24,30,24,0.48)', borderWidth: 1, borderColor: 'rgba(244,246,239,0.14)' },
  liveDistanceLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, color: MUTED, letterSpacing: 1.6 },
  liveTimer: { fontFamily: 'ChakraPetch', color: HOTLAP_LIME, fontSize: 56, lineHeight: 66, marginTop: 4 },
  liveRemaining: { fontFamily: 'Manrope-Bold', color: '#D6DED0', fontSize: 10, marginTop: 2 },
  gForceCard: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 220, borderRadius: 26, overflow: 'hidden', backgroundColor: 'rgba(24,30,24,0.4)', borderWidth: 1, borderColor: 'rgba(244,246,239,0.12)' },
  gDiagram: { width: 164, height: 164, justifyContent: 'center', alignItems: 'center', marginVertical: 7 },
  gRing: { position: 'absolute', borderWidth: 1, borderColor: '#394238', borderRadius: 100 },
  gRingOuter: { width: 148, height: 148 },
  gRingMiddle: { width: 100, height: 100 },
  gRingInner: { width: 50, height: 50 },
  gCrossHorizontal: { position: 'absolute', width: 148, height: 1, backgroundColor: '#303A30' },
  gCrossVertical: { position: 'absolute', height: 148, width: 1, backgroundColor: '#303A30' },
  gDot: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: HOTLAP_LIME, borderWidth: 2, borderColor: '#F4F6EF' },
  gLabelTop: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 1.5 },
  gLabelBottom: { fontFamily: 'Manrope-Bold', color: '#A9B5A0', fontSize: 8, letterSpacing: 0.5 },
  gLeft: { position: 'absolute', left: 2, fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8 },
  gRight: { position: 'absolute', right: 2, fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8 },
  gAxisLabels: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  liveMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  liveMetricValue: { fontFamily: 'ChakraPetch', color: '#F4F6EF', fontSize: 30 },
  liveMetricLabel: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  liveMetricDivider: { width: 1, height: 39, backgroundColor: '#303A30', marginHorizontal: 20 },
  liveMetricRight: { flex: 1, alignItems: 'flex-end' },
  liveProgressTrack: { height: 4, borderRadius: 4, overflow: 'hidden', backgroundColor: '#303A30', marginTop: 18 },
  liveProgressFill: { height: '100%', backgroundColor: HOTLAP_LIME },
  liveSafety: { textAlign: 'center', fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 0.7, marginTop: 10 },
  resultsContent: { paddingHorizontal: 22, paddingTop: 8 },
  resultHero: { minHeight: 145, alignItems: 'center', justifyContent: 'center', backgroundColor: PANEL, borderRadius: 18, borderWidth: 1, borderColor: '#303A30', marginBottom: 13 },
  resultTime: { fontFamily: 'ChakraPetch', color: HOTLAP_LIME, fontSize: 42, marginTop: 3 },
  resultSubtitle: { fontFamily: 'Manrope', color: MUTED, fontSize: 9, marginTop: 2 },
  resultCard: { paddingHorizontal: 14, backgroundColor: PANEL, borderRadius: 16, borderWidth: 1, borderColor: '#303A30' },
  metricRow: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2A322A' },
  metricRowLast: { borderBottomWidth: 0 },
  metricName: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 10 },
  metricResult: { maxWidth: '60%', fontFamily: 'Manrope-Bold', color: '#F4F6EF', fontSize: 10, textAlign: 'right' },
  resultsFootnote: { fontFamily: 'Manrope', color: MUTED, fontSize: 9, lineHeight: 14, marginTop: 11, marginBottom: 14 },
  deleteButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#78423D', borderRadius: 13, marginTop: 9 },
  deleteButtonText: { fontFamily: 'Manrope-Bold', color: '#FF766C', fontSize: 10, letterSpacing: 1 },
  demoHint: { fontFamily: 'Manrope', color: MUTED, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 8, marginBottom: 8 },
  demoButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PANEL, borderWidth: 1, borderColor: '#3A4638', borderRadius: 12, marginBottom: 9 },
  demoButtonText: { fontFamily: 'Manrope-Bold', color: '#D4DDCF', fontSize: 9, letterSpacing: 0.9 },
  demoNotice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PANEL, borderRadius: 12 },
  demoNoticeText: { fontFamily: 'Manrope-Bold', color: '#D4DDCF', fontSize: 9, letterSpacing: 0.5 },
  boardDistanceRow: { flexDirection: 'row', gap: 7, marginHorizontal: 20, marginTop: 2 },
  boardDistance: { flex: 1, minHeight: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: PANEL, borderWidth: 1, borderColor: '#303A30' },
  boardDistanceActive: { backgroundColor: HOTLAP_LIME, borderColor: HOTLAP_LIME },
  boardDistanceText: { fontFamily: 'Manrope-Bold', color: '#A9B5A0', fontSize: 8 },
  boardDistanceTextActive: { color: BACKGROUND },
  boardFilters: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 12, marginBottom: 17 },
  filterButton: { minWidth: 72, minHeight: 30, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#394238' },
  filterButtonActive: { borderColor: HOTLAP_LIME },
  filterButtonText: { fontFamily: 'Manrope-Bold', color: '#A9B5A0', fontSize: 8, letterSpacing: 0.8 },
  filterButtonTextActive: { color: HOTLAP_LIME },
  filterDisabled: { borderColor: '#2E362E', opacity: 0.5 },
  filterDisabledText: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 0.8 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#252C25' },
  tableHeaderText: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 0.8 },
  rankColumn: { width: 28 },
  driverColumn: { flex: 1 },
  timeColumn: { width: 65, textAlign: 'right' },
  topColumn: { width: 47, textAlign: 'right' },
  boardList: { paddingHorizontal: 20, paddingBottom: 12 },
  boardRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: '#252C25' },
  boardRowYou: { backgroundColor: '#20281C', borderRadius: 9 },
  rankText: { fontFamily: 'ChakraPetch', color: HOTLAP_LIME, fontSize: 12 },
  driverName: { fontFamily: 'Manrope-Bold', color: '#F4F6EF', fontSize: 9 },
  driverCar: { fontFamily: 'Manrope', color: MUTED, fontSize: 8, marginTop: 3 },
  boardTime: { fontFamily: 'ChakraPetch', color: '#F4F6EF', fontSize: 11 },
  boardTop: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 9 },
  boardMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34, gap: 10 },
  boardMessageTitle: { fontFamily: 'Manrope-Bold', color: '#F4F6EF', fontSize: 13 },
  boardMessageText: { fontFamily: 'Manrope', color: MUTED, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  retryButton: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 9, backgroundColor: '#252C25', marginTop: 4 },
  retryText: { fontFamily: 'Manrope-Bold', color: HOTLAP_LIME, fontSize: 9 },
  boardFooter: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#252C25', alignItems: 'center', gap: 9 },
  boardNote: { fontFamily: 'Manrope-Bold', color: MUTED, fontSize: 8, letterSpacing: 0.6 },
});
