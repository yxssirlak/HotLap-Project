import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { MapType, Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

type TrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

const HOTLAP_LIME = '#C2F044';
const DEFAULT_REGION: Region = {
  latitude: 52.0907,
  longitude: 5.1214,
  latitudeDelta: 0.055,
  longitudeDelta: 0.055,
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#151a16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b0bcad' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#151a16' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#344037' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#c1cbb8' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#191f1a' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#19241c' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#202820' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9aaa94' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1d3023' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#90b18e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#333b34' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111612' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a6b1a4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#505b43' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#272e25' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e0e8d6' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#414b40' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#2b342e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#879486' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102127' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#83a0a2' }] },
];

function distanceBetweenMeters(a: TrackPoint, b: TrackPoint) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.min(1, Math.max(0,
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2));
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(remainingSeconds)}`
    : `${twoDigits(minutes)}:${twoDigits(remainingSeconds)}`;
}

function formatDistance(meters: number) {
  return meters >= 1000 ? (meters / 1000).toFixed(2) : Math.round(meters).toString();
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<TrackPoint | null>(null);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driveSaved, setDriveSaved] = useState<boolean | null>(null);
  const [savingDrive, setSavingDrive] = useState(false);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [showTraffic, setShowTraffic] = useState(false);

  useEffect(() => {
    if (!active || paused || !startedAt) return undefined;
    const updateClock = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [active, paused, startedAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') pauseDrive();
    });
    return () => subscription.remove();
  }, [active, paused]);

  useEffect(() => {
    if (!isFocused) pauseDrive();
  }, [isFocused]);

  useEffect(() => () => {
    subscriptionRef.current?.remove();
  }, []);

  useEffect(() => {
    void loadLatestDrive();
  }, []);

  useEffect(() => {
    if (mapReady && currentLocation && !active) centerOn(currentLocation, false);
  }, [mapReady, currentLocation, active]);

  async function loadLatestDrive() {
    if (Platform.OS === 'web') return;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      const { data, error } = await supabase
        .from('drive_sessions')
        .select('started_at, duration_seconds, distance_meters, track')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data || !Array.isArray(data.track)) return;

      const savedPoints = (data.track as TrackPoint[]).filter((point) =>
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        Number.isFinite(point.timestamp),
      );
      if (savedPoints.length === 0) return;

      pointsRef.current = savedPoints;
      setPoints(savedPoints);
      setCurrentLocation(savedPoints[savedPoints.length - 1]);
      setGpsAccuracy(savedPoints[savedPoints.length - 1].accuracy);
      setDistanceMeters(Number(data.distance_meters));
      setElapsedSeconds(data.duration_seconds);
      setDriveSaved(true);
    } catch (error) {
      Alert.alert(
        'Drive history unavailable',
        `Run supabase/drive-sessions.sql in the Supabase SQL Editor if this is a new setup.\n\n${error instanceof Error ? error.message : 'Unknown database error.'}`,
      );
    }
  }

  function centerOn(point: TrackPoint, animated = true) {
    mapRef.current?.animateToRegion({
      latitude: point.latitude,
      longitude: point.longitude,
      latitudeDelta: 0.007,
      longitudeDelta: 0.007,
    }, animated ? 500 : 0);
  }

  async function requestLocationPermission() {
    const current = await Location.getForegroundPermissionsAsync();
    const permission = current.granted ? current : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return false;
    }
    setPermissionDenied(false);
    return true;
  }

  function pauseDrive() {
    if (!active || paused) return;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    pausedAtRef.current = Date.now();
    setPaused(true);
  }

  async function centerOnMe() {
    setBusy(true);
    try {
      if (!(await requestLocationPermission())) return;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });
      const point: TrackPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      setCurrentLocation(point);
      setGpsAccuracy(point.accuracy);
      centerOn(point);
    } catch (error) {
      Alert.alert(
        'Location unavailable',
        error instanceof Error ? error.message : 'Check that location services are enabled and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function acceptLocation(location: Location.LocationObject) {
    const accuracy = location.coords.accuracy;
    setGpsAccuracy(accuracy);
    if (accuracy == null || accuracy > 25) return;

    const next: TrackPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy,
      timestamp: location.timestamp,
    };

    const previous = pointsRef.current[pointsRef.current.length - 1];
    if (previous) {
      const segmentMeters = distanceBetweenMeters(previous, next);
      const elapsedMs = next.timestamp - previous.timestamp;
      const minimumMovement = Math.max(3, Math.min(10, ((previous.accuracy || 0) + accuracy) * 0.35));
      if (segmentMeters < minimumMovement) return;
      if (elapsedMs <= 0) return;
      const speedMetersPerSecond = segmentMeters / (elapsedMs / 1000);
      if (speedMetersPerSecond < 0.5 || speedMetersPerSecond > 120) return;
      setDistanceMeters((distance) => distance + segmentMeters);
    }

    pointsRef.current = [...pointsRef.current, next];
    setPoints(pointsRef.current);
    setCurrentLocation(next);
    centerOn(next);
  }

  async function startWatcher() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 2,
        timeInterval: 1000,
        mayShowUserSettingsDialog: true,
      },
      acceptLocation,
      (error) => {
        Alert.alert('GPS tracking stopped', error);
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
        setActive(false);
        setPaused(false);
      },
    );
  }

  async function startDrive() {
    setBusy(true);
    try {
      if (!(await requestLocationPermission())) return;

      if (!active || pointsRef.current.length === 0) {
        const firstFix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          mayShowUserSettingsDialog: true,
        });
        if (firstFix.coords.accuracy == null || firstFix.coords.accuracy > 25) {
          setGpsAccuracy(firstFix.coords.accuracy);
          Alert.alert(
            'Waiting for a precise GPS fix',
            'HotLap needs a location accuracy of 25 m or better to start a drive. Move to an open area and try again.',
          );
          return;
        }

        pointsRef.current = [];
        pausedAtRef.current = null;
        setPoints([]);
        setDistanceMeters(0);
        setElapsedSeconds(0);
        const startTime = Date.now();
        startedAtRef.current = startTime;
        setStartedAt(startTime);
        setActive(true);
        setPaused(false);
        setDriveSaved(null);
        acceptLocation(firstFix);
        centerOn({
          latitude: firstFix.coords.latitude,
          longitude: firstFix.coords.longitude,
          accuracy: firstFix.coords.accuracy,
          timestamp: firstFix.timestamp,
        });
      } else {
        setPaused(false);
      }

      await startWatcher();
    } catch (error) {
      setActive(false);
      setPaused(false);
      setStartedAt(null);
      Alert.alert(
        'Could not start drive',
        error instanceof Error ? error.message : 'Check your GPS settings and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (paused) {
      setBusy(true);
      try {
        await startWatcher();
        if (pausedAtRef.current != null) {
          const pausedDuration = Date.now() - pausedAtRef.current;
          setStartedAt((start) => start == null ? null : start + pausedDuration);
          pausedAtRef.current = null;
        }
        setPaused(false);
      } catch (error) {
        Alert.alert('Could not resume GPS', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    pauseDrive();
  }

  async function saveDrive(): Promise<string | null> {
    const startTime = startedAtRef.current;
    if (startTime == null) return 'The drive start time was unavailable.';
    const track = [...pointsRef.current];
    const distance = distanceMeters;
    const duration = elapsedSeconds;
    setSavingDrive(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Your session has expired. Sign in again to save this drive.');

      const { error } = await supabase.from('drive_sessions').insert({
        user_id: user.id,
        started_at: new Date(startTime).toISOString(),
        duration_seconds: duration,
        distance_meters: Number(distance.toFixed(2)),
        average_speed_kmh: duration > 0 ? Number(((distance / duration) * 3.6).toFixed(2)) : 0,
        track,
      });
      if (error) throw error;
      setDriveSaved(true);
      return null;
    } catch (error) {
      setDriveSaved(false);
      return error instanceof Error ? error.message : 'Unknown error while saving the drive.';
    } finally {
      setSavingDrive(false);
    }
  }

  async function finishDrive() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setActive(false);
    setPaused(false);
    setStartedAt(null);
    const saveError = await saveDrive();
    Alert.alert(
      'Drive complete',
      `${formatDistance(distanceMeters)} ${distanceMeters >= 1000 ? 'km' : 'm'} · ${formatDuration(elapsedSeconds)} · ${pointsRef.current.length} GPS fixes${saveError ? `\n\nCould not save to your drive log: ${saveError}` : '\n\nSaved to your private HotLap drive log.'}`,
      [
        { text: 'Close', style: 'cancel' },
        ...(saveError ? [{ text: 'Retry save', onPress: () => void retrySaveDrive() }] : []),
        { text: 'Share drive', onPress: () => void shareDrive() },
      ],
    );
  }

  async function retrySaveDrive() {
    const saveError = await saveDrive();
    if (saveError) Alert.alert('Could not save drive', saveError);
  }

  async function shareDrive() {
    try {
      await Share.share({
        message: `HotLap drive: ${formatDistance(distanceMeters)} ${distanceMeters >= 1000 ? 'km' : 'm'} in ${formatDuration(elapsedSeconds)}. Tracked with ${pointsRef.current.length} accurate GPS fixes.`,
      });
    } catch (error) {
      Alert.alert('Could not share drive', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  const lineCoordinates = points.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const averageSpeed = elapsedSeconds > 0 ? (distanceMeters / elapsedSeconds) * 3.6 : 0;
  const accuracyLabel = gpsAccuracy == null
    ? 'GPS SEARCHING'
    : gpsAccuracy > 25
      ? `GPS WEAK ±${Math.round(gpsAccuracy)} M`
      : `GPS ±${Math.round(gpsAccuracy)} M`;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallback, { paddingTop: insets.top }]}>
        <View style={styles.webMapArtwork}>
          <Ionicons name="map-outline" size={64} color={HOTLAP_LIME} />
          <Text style={styles.webTitle}>HotLap live map</Text>
          <Text style={styles.webText}>
            Live maps and high-accuracy GPS recording are available in the HotLap iOS and Android app.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale
        showsTraffic={showTraffic}
        showsBuildings
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        loadingEnabled
        loadingBackgroundColor="#101311"
        loadingIndicatorColor={HOTLAP_LIME}
      >
        {lineCoordinates.length > 1 && (
          <>
            <Polyline coordinates={lineCoordinates} strokeColor="#101311" strokeWidth={11} zIndex={1} />
            <Polyline coordinates={lineCoordinates} strokeColor={HOTLAP_LIME} strokeWidth={6} zIndex={2} />
          </>
        )}
        {lineCoordinates.length > 0 && (
          <Marker coordinate={lineCoordinates[0]} title="Drive start" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.startMarker}><View style={styles.startMarkerDot} /></View>
          </Marker>
        )}
        {currentLocation && (
          <Marker coordinate={currentLocation} title={active ? 'Current position' : 'Last drive'} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.currentMarkerHalo}>
              <View style={styles.currentMarkerDot} />
            </View>
          </Marker>
        )}
      </MapView>

      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}><Ionicons name="navigate" size={17} color="#101311" /></View>
            <View>
              <Text style={styles.brandTitle}>HOTLAP</Text>
              <Text style={styles.brandSubtitle}>THE ROAD IS YOURS</Text>
            </View>
          </View>
          <View style={[styles.gpsBadge, active && !paused && styles.gpsBadgeActive]}>
            <View style={[styles.gpsDot, active && !paused && styles.gpsDotActive]} />
            <Text style={[styles.gpsBadgeText, active && !paused && styles.gpsBadgeTextActive]}>
              {active ? (paused ? 'PAUSED' : 'LIVE DRIVE') : 'MAP'}
            </Text>
          </View>
        </View>

        <View style={styles.mapToolsRow}>
          <View style={styles.layerSwitch}>
            <Pressable
              style={[styles.layerButton, mapType === 'standard' && styles.layerButtonActive]}
              onPress={() => setMapType('standard')}
              accessibilityRole="button"
              accessibilityLabel="Standard dark map"
            >
              <Ionicons name="map-outline" size={14} color={mapType === 'standard' ? HOTLAP_LIME : '#A9B5A0'} />
              <Text style={[styles.layerText, mapType === 'standard' && styles.layerTextActive]}>DARK</Text>
            </Pressable>
            <Pressable
              style={[styles.layerButton, mapType === 'satellite' && styles.layerButtonActive]}
              onPress={() => setMapType('satellite')}
              accessibilityRole="button"
              accessibilityLabel="Satellite map"
            >
              <Ionicons name="globe-outline" size={14} color={mapType === 'satellite' ? HOTLAP_LIME : '#A9B5A0'} />
              <Text style={[styles.layerText, mapType === 'satellite' && styles.layerTextActive]}>SATELLITE</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.trafficButton, showTraffic && styles.trafficButtonActive]}
            onPress={() => setShowTraffic((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={showTraffic ? 'Hide traffic' : 'Show traffic'}
          >
            <Ionicons name="car-outline" size={14} color={showTraffic ? HOTLAP_LIME : '#A9B5A0'} />
            <Text style={[styles.layerText, showTraffic && styles.layerTextActive]}>TRAFFIC</Text>
          </Pressable>
        </View>

        <View style={styles.mapButtons}>
          <View style={styles.accuracyPill}>
            <Ionicons name={gpsAccuracy != null && gpsAccuracy <= 25 ? 'locate' : 'locate-outline'} size={14} color={gpsAccuracy != null && gpsAccuracy <= 25 ? HOTLAP_LIME : '#A9B5A0'} />
            <Text style={styles.accuracyText}>{accuracyLabel}</Text>
          </View>
          <Pressable style={styles.locateButton} onPress={() => void centerOnMe()} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={HOTLAP_LIME} /> : <Ionicons name="locate" size={21} color={HOTLAP_LIME} />}
          </Pressable>
        </View>

        {permissionDenied && (
          <View style={styles.permissionCard}>
            <Ionicons name="location-outline" size={19} color={HOTLAP_LIME} />
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>Location access is off</Text>
              <Text style={styles.permissionText}>Allow location while using HotLap to center the map or track a drive.</Text>
            </View>
            <Pressable onPress={() => void Linking.openSettings()} accessibilityLabel="Open app settings">
              <Ionicons name="open-outline" size={19} color={HOTLAP_LIME} />
            </Pressable>
          </View>
        )}

        <View style={styles.bottomPanel}>
          {active ? (
            <>
              <View style={styles.recordingHeader}>
                <View style={styles.recordingTitleRow}>
                  <View style={[styles.recordingDot, paused && styles.pausedDot]} />
                  <Text style={styles.recordingTitle}>{paused ? 'DRIVE PAUSED' : 'RECORDING DRIVE'}</Text>
                </View>
                <Text style={styles.recordingAccuracy}>{gpsAccuracy == null ? 'GPS…' : `±${Math.round(gpsAccuracy)} m`}</Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.primaryMetric}>
                  <Text style={styles.distanceValue}>{formatDistance(distanceMeters)}</Text>
                  <Text style={styles.distanceUnit}>{distanceMeters >= 1000 ? 'KILOMETERS' : 'METERS'}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.secondaryMetric}>
                  <Text style={styles.metricValue}>{formatDuration(elapsedSeconds)}</Text>
                  <Text style={styles.metricLabel}>DURATION</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.secondaryMetric}>
                  <Text style={styles.metricValue}>{Math.round(averageSpeed)}</Text>
                  <Text style={styles.metricLabel}>AVG KM/H</Text>
                </View>
              </View>

              <View style={styles.trackInfo}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#849080" />
                <Text style={styles.trackInfoText}>Auto-pauses off this map or in background · don’t interact while driving</Text>
              </View>

              <View style={styles.recordButtons}>
                <Pressable
                  style={styles.pauseButton}
                  onPress={() => void togglePause()}
                  disabled={busy}
                  accessibilityLabel={paused ? 'Resume drive' : 'Pause drive'}
                >
                  {busy
                    ? <ActivityIndicator color={HOTLAP_LIME} />
                    : <Ionicons name={paused ? 'play' : 'pause'} size={21} color={HOTLAP_LIME} />}
                </Pressable>
                <Pressable style={styles.stopButton} onPress={() => void finishDrive()}>
                  <Ionicons name="stop" size={17} color="#101311" />
                  <Text style={styles.stopButtonText}>FINISH DRIVE</Text>
                </Pressable>
              </View>
            </>
          ) : points.length > 0 ? (
            <>
              <View style={styles.recordingHeader}>
              <View>
                <Text style={styles.recordingTitle}>LAST DRIVE</Text>
                <Text style={styles.savedStatus}>
                  {savingDrive ? 'SAVING YOUR DRIVE…' : driveSaved === true ? 'SAVED TO YOUR PRIVATE DRIVE LOG' : driveSaved === false ? 'SAVE FAILED — STILL ON THIS SCREEN' : 'LAST DRIVE'}
                </Text>
              </View>
                <Pressable onPress={() => void shareDrive()} style={styles.shareButton}>
                  <Ionicons name="share-social-outline" size={17} color={HOTLAP_LIME} />
                  <Text style={styles.shareText}>SHARE</Text>
                </Pressable>
              </View>
              <View style={styles.completedSummary}>
                <Text style={styles.completedDistance}>{formatDistance(distanceMeters)} <Text style={styles.completedUnit}>{distanceMeters >= 1000 ? 'km' : 'm'}</Text></Text>
                <Text style={styles.completedDetails}>{formatDuration(elapsedSeconds)} · {points.length} precise GPS fixes</Text>
              </View>
              <Pressable
                style={[styles.startButton, (savingDrive || driveSaved === false) && styles.startButtonDimmed]}
                onPress={() => driveSaved === false ? void retrySaveDrive() : void startDrive()}
                disabled={busy || savingDrive}
              >
                {busy || savingDrive
                  ? <ActivityIndicator color="#101311" />
                  : <Ionicons name={driveSaved === false ? 'cloud-upload-outline' : 'add'} size={20} color="#101311" />}
                <Text style={styles.startButtonText}>
                  {savingDrive ? 'SAVING DRIVE…' : driveSaved === false ? 'RETRY SAVING DRIVE' : 'START NEW DRIVE'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.panelIntro}>
                <View>
                  <Text style={styles.panelEyebrow}>YOUR NEXT DRIVE</Text>
                  <Text style={styles.panelTitle}>Find your line.</Text>
                </View>
                <View style={styles.routeIcon}><Ionicons name="git-branch-outline" size={19} color={HOTLAP_LIME} /></View>
              </View>
              <Text style={styles.panelDescription}>
                Start a drive to draw your route live. HotLap ignores weak GPS fixes for a cleaner track.
              </Text>
              <Pressable style={[styles.startButton, (!mapReady || busy) && styles.startButtonDimmed]} onPress={() => void startDrive()} disabled={busy}>
                {busy
                  ? <ActivityIndicator color="#101311" />
                  : <Ionicons name="radio-button-on" size={18} color="#101311" />}
                <Text style={styles.startButtonText}>{busy ? 'ACQUIRING GPS…' : 'START DRIVE'}</Text>
                {!busy && <Ionicons name="arrow-forward" size={17} color="#101311" />}
              </Pressable>
              <View style={styles.panelFooter}>
                <Ionicons name="location-outline" size={13} color="#879181" />
                <Text style={styles.panelFooterText}>Precise GPS · Live route · Private by default</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 104 },
  header: { minHeight: 57, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 13, borderRadius: 17, backgroundColor: 'rgba(16,19,17,0.92)', borderWidth: 1, borderColor: 'rgba(169,181,160,0.14)' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: HOTLAP_LIME, justifyContent: 'center', alignItems: 'center' },
  brandTitle: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 12, letterSpacing: 1.4 },
  brandSubtitle: { fontFamily: 'Manrope-Bold', color: '#879181', fontSize: 8, letterSpacing: 1.1, marginTop: 2 },
  gpsBadge: { height: 29, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 15, paddingHorizontal: 10, backgroundColor: '#252C25', borderWidth: 1, borderColor: '#394137' },
  gpsBadgeActive: { backgroundColor: 'rgba(194,240,68,0.13)', borderColor: 'rgba(194,240,68,0.35)' },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#879181' },
  gpsDotActive: { backgroundColor: HOTLAP_LIME },
  gpsBadgeText: { fontFamily: 'Manrope-Bold', color: '#A9B5A0', fontSize: 9, letterSpacing: 1 },
  gpsBadgeTextActive: { color: HOTLAP_LIME },
  mapButtons: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 9 },
  mapToolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  layerSwitch: { flexDirection: 'row', backgroundColor: 'rgba(16,19,17,0.92)', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: 'rgba(169,181,160,0.16)' },
  layerButton: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9 },
  layerButtonActive: { backgroundColor: '#303A30' },
  layerText: { fontFamily: 'Manrope-Bold', color: '#A9B5A0', fontSize: 8, letterSpacing: 0.8 },
  layerTextActive: { color: HOTLAP_LIME },
  trafficButton: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 12, backgroundColor: 'rgba(16,19,17,0.92)', borderWidth: 1, borderColor: 'rgba(169,181,160,0.16)' },
  trafficButtonActive: { backgroundColor: 'rgba(194,240,68,0.13)', borderColor: 'rgba(194,240,68,0.35)' },
  accuracyPill: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(16,19,17,0.9)', borderWidth: 1, borderColor: 'rgba(169,181,160,0.15)' },
  accuracyText: { fontFamily: 'Manrope-Bold', fontSize: 9, color: '#C8D0C1', letterSpacing: 0.4 },
  locateButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(16,19,17,0.94)', borderWidth: 1, borderColor: 'rgba(194,240,68,0.28)', justifyContent: 'center', alignItems: 'center' },
  permissionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, backgroundColor: 'rgba(16,19,17,0.96)', borderWidth: 1, borderColor: 'rgba(194,240,68,0.25)' },
  permissionCopy: { flex: 1 },
  permissionTitle: { fontFamily: 'Manrope-Bold', color: '#F4F6EF', fontSize: 11 },
  permissionText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 9, lineHeight: 14, marginTop: 3 },
  bottomPanel: { borderRadius: 22, padding: 18, backgroundColor: 'rgba(16,19,17,0.96)', borderWidth: 1, borderColor: 'rgba(169,181,160,0.15)' },
  panelIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelEyebrow: { fontFamily: 'Manrope-Bold', fontSize: 9, color: HOTLAP_LIME, letterSpacing: 1.8 },
  panelTitle: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 19, marginTop: 5 },
  routeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  panelDescription: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 11, lineHeight: 17, marginTop: 7 },
  startButton: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: HOTLAP_LIME },
  startButtonDimmed: { opacity: 0.8 },
  startButtonText: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#101311', letterSpacing: 1.1 },
  panelFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 11 },
  panelFooterText: { fontFamily: 'Manrope', color: '#879181', fontSize: 9 },
  recordingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF665C' },
  pausedDot: { backgroundColor: '#F3B64A' },
  recordingTitle: { fontFamily: 'Manrope-Bold', fontSize: 10, color: '#F4F6EF', letterSpacing: 1.3 },
  savedStatus: { fontFamily: 'Manrope-Bold', fontSize: 8, color: '#879181', marginTop: 5, letterSpacing: 0.7 },
  recordingAccuracy: { fontFamily: 'Manrope-Bold', fontSize: 10, color: HOTLAP_LIME },
  metricsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 13 },
  primaryMetric: { flex: 1.25 },
  distanceValue: { fontFamily: 'Michroma', fontSize: 30, color: '#F4F6EF' },
  distanceUnit: { fontFamily: 'Manrope-Bold', fontSize: 8, color: '#879181', letterSpacing: 1.2, marginTop: 1 },
  metricDivider: { width: 1, height: 35, backgroundColor: '#303A30' },
  secondaryMetric: { flex: 1, alignItems: 'center' },
  metricValue: { fontFamily: 'ChakraPetch', fontSize: 19, color: '#F4F6EF' },
  metricLabel: { fontFamily: 'Manrope-Bold', fontSize: 8, color: '#879181', letterSpacing: 0.8, marginTop: 2 },
  trackInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#252C25' },
  trackInfoText: { fontFamily: 'Manrope', color: '#879181', fontSize: 9 },
  recordButtons: { flexDirection: 'row', gap: 9, marginTop: 7 },
  pauseButton: { width: 52, height: 48, borderRadius: 13, borderWidth: 1, borderColor: '#424c3d', backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  stopButton: { flex: 1, height: 48, borderRadius: 13, backgroundColor: HOTLAP_LIME, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  stopButtonText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#101311', letterSpacing: 1 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shareText: { fontFamily: 'Manrope-Bold', color: HOTLAP_LIME, fontSize: 9, letterSpacing: 1 },
  completedSummary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 15 },
  completedDistance: { fontFamily: 'Michroma', fontSize: 27, color: '#F4F6EF' },
  completedUnit: { fontFamily: 'Manrope-Bold', fontSize: 13, color: HOTLAP_LIME },
  completedDetails: { fontFamily: 'Manrope', fontSize: 10, color: '#A9B5A0' },
  startMarker: { width: 18, height: 18, borderRadius: 9, backgroundColor: HOTLAP_LIME, borderWidth: 3, borderColor: '#101311', justifyContent: 'center', alignItems: 'center' },
  startMarkerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#101311' },
  currentMarkerHalo: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(194,240,68,0.2)', borderWidth: 1, borderColor: HOTLAP_LIME, justifyContent: 'center', alignItems: 'center' },
  currentMarkerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: HOTLAP_LIME, borderWidth: 2, borderColor: '#101311' },
  webFallback: { flex: 1, backgroundColor: '#101311', justifyContent: 'center', padding: 28 },
  webMapArtwork: { alignItems: 'center', borderRadius: 24, padding: 35, backgroundColor: '#1A201A', borderWidth: 1, borderColor: '#303A30' },
  webTitle: { fontFamily: 'Michroma', color: '#F4F6EF', fontSize: 18, marginTop: 18 },
  webText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
});
