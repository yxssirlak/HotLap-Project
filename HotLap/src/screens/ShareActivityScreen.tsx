import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { Region } from 'react-native-maps';
import { MapView, Polyline } from '../components/NativeMaps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { formatSpeed, formatTravelDistance, getDistanceUnit } from '../utils/units';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareActivity'>;
type Audience = 'followers' | 'local' | 'crew';
type Crew = { id: string; name: string; invite_code: string };

const LIME = '#C2F044';
const DISTANCE_UNIT = getDistanceUnit();
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#080A09' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202522' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1013' }] },
];

function regionForTrack(track: Array<{ latitude: number; longitude: number }>): Region {
  const bounds = track.reduce((current, point) => ({
    minLatitude: Math.min(current.minLatitude, point.latitude),
    maxLatitude: Math.max(current.maxLatitude, point.latitude),
    minLongitude: Math.min(current.minLongitude, point.longitude),
    maxLongitude: Math.max(current.maxLongitude, point.longitude),
  }), {
    minLatitude: track[0].latitude,
    maxLatitude: track[0].latitude,
    minLongitude: track[0].longitude,
    maxLongitude: track[0].longitude,
  });
  return {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    latitudeDelta: Math.max(0.005, (bounds.maxLatitude - bounds.minLatitude) * 1.4),
    longitudeDelta: Math.max(0.005, (bounds.maxLongitude - bounds.minLongitude) * 1.4),
  };
}

export default function ShareActivityScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { activity } = route.params;
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('followers');
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewId, setCrewId] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadCrews() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Sign in to share an activity.');
        const { data: memberships, error: membershipError } = await supabase
          .from('crew_members').select('crew_id').eq('user_id', user.id);
        if (membershipError) throw membershipError;
        const crewIds = (memberships || []).map(({ crew_id }) => crew_id);
        if (crewIds.length === 0) {
          if (mounted) setCrews([]);
          return;
        }
        const { data, error } = await supabase.from('crews')
          .select('id, name, invite_code').in('id', crewIds).order('name');
        if (error) throw error;
        if (mounted) setCrews((data || []) as Crew[]);
      } catch (error) {
        Alert.alert('Could not load crews', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadCrews();
    return () => { mounted = false; };
  }, []);

  async function publish() {
    if (publishing) return;
    if (audience === 'crew' && !crewId) {
      Alert.alert('Choose a crew', 'Select a crew you belong to before sharing.');
      return;
    }
    if (audience === 'local' &&
      (activity.startLatitude == null || activity.startLongitude == null)) {
      Alert.alert('Location unavailable', 'This activity has no starting location and cannot be shared to Local Discover.');
      return;
    }
    setPublishing(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sign in to share this activity.');
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('username, full_name, avatar_url, car_brand, car_model')
        .eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      const vehicle = activity.vehicle.trim() ||
        [profile?.car_brand, profile?.car_model].filter(Boolean).join(' ') ||
        'Unspecified vehicle';
      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        author_username: profile?.username || 'driver',
        author_name: profile?.full_name || profile?.username || 'Driver',
        author_avatar_url: profile?.avatar_url || null,
        activity_type: activity.type,
        caption: caption.trim(),
        vehicle,
        duration_seconds: Math.round(activity.durationSeconds),
        distance_meters: Number(activity.distanceMeters.toFixed(2)),
        average_speed_kmh: Number(activity.averageSpeedKmh.toFixed(2)),
        top_speed_kmh: activity.topSpeedKmh == null ? null : Number(activity.topSpeedKmh.toFixed(2)),
        details: activity.details || {},
        track: activity.track,
        start_latitude: activity.startLatitude ?? null,
        start_longitude: activity.startLongitude ?? null,
        audience,
        crew_id: audience === 'crew' ? crewId : null,
      });
      if (error) throw error;
      Alert.alert('Shared with your community', 'Your activity is now available in the selected feed.');
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not share activity',
        `${error instanceof Error ? error.message : 'Please try again.'}\n\nIf this is a new setup, run supabase/community.sql in the Supabase SQL Editor.`,
      );
    } finally {
      setPublishing(false);
    }
  }

  function chooseAudience(next: Audience) {
    setAudience(next);
    if (next === 'crew' && crews.length > 0) setCrewId(crews[0].id);
  }

  const audienceOptions: Array<{ id: Audience; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'followers', title: 'Followers', detail: 'Only people who follow you', icon: 'people-outline' },
    { id: 'local', title: 'Local Discover', detail: 'Drivers within 50 km / 30 mi', icon: 'location-outline' },
    { id: 'crew', title: 'A crew', detail: 'Share with one crew you belong to', icon: 'flag-outline' },
  ];
  const isCrewAudience = audience === 'crew';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={19} color="#101311" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>HOTLAP / COMMUNITY</Text>
          <Text style={styles.title}>Share your {activity.type}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Ionicons name={activity.type === 'drive' ? 'navigate-outline' : 'speedometer-outline'} size={20} color={LIME} />
          </View>
          <View style={styles.activitySummary}>
            <Text style={styles.activityTitle}>{activity.type === 'drive' ? 'Recorded drive' : 'Track sprint'}</Text>
            <Text style={styles.activitySubtitle}>{activity.vehicle || 'Your vehicle'}</Text>
          </View>
          <View style={styles.activityStats}>
            <Text style={styles.activityDistance}>{formatTravelDistance(activity.distanceMeters, DISTANCE_UNIT, 1)}</Text>
            {activity.type === 'sprint' && activity.topSpeedKmh != null && (
              <Text style={styles.activitySubtitle}>{formatSpeed(activity.topSpeedKmh, DISTANCE_UNIT)}</Text>
            )}
          </View>
          <View style={styles.trackPreview}>
            {activity.track.length > 1 ? (
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={regionForTrack(activity.track)}
                customMapStyle={MAP_STYLE}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                showsCompass={false}
                showsScale={false}
                pointerEvents="none"
              >
                <Polyline coordinates={activity.track} strokeColor="#000000" strokeWidth={9} />
                <Polyline coordinates={activity.track} strokeColor={LIME} strokeWidth={5} />
              </MapView>
            ) : <Text style={styles.noTrack}>Route preview unavailable</Text>}
          </View>
          <Text style={styles.trackCaption}>FULL RECORDED ROUTE · {activity.track.length} GPS FIXES</Text>
        </View>

        <Text style={styles.sectionTitle}>ADD A CAPTION</Text>
        <TextInput
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
          placeholder="How was the drive? Add a note for your followers…"
          placeholderTextColor="#879181"
          multiline
          maxLength={1000}
          textAlignVertical="top"
          accessibilityLabel="Activity caption"
        />
        <Text style={styles.characterCount}>{caption.length}/1000</Text>

        <Text style={styles.sectionTitle}>WHO CAN SEE THIS?</Text>
        {audienceOptions.map((option) => (
          <Pressable
            key={option.id}
            style={[styles.audienceOption, audience === option.id && styles.audienceOptionActive]}
            onPress={() => chooseAudience(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: audience === option.id }}
          >
            <Ionicons name={option.icon} size={19} color={audience === option.id ? LIME : '#A9B5A0'} />
            <View style={styles.audienceCopy}>
              <Text style={styles.audienceTitle}>{option.title}</Text>
              <Text style={styles.audienceDetail}>{option.detail}</Text>
            </View>
            <Ionicons name={audience === option.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={audience === option.id ? LIME : '#687263'} />
          </Pressable>
        ))}

        {isCrewAudience && (
          <View style={styles.crewList}>
            {crews.length === 0 && !loading ? (
              <Text style={styles.emptyCrews}>You are not in any crews yet.</Text>
            ) : crews.map((crew) => (
              <Pressable
                key={crew.id}
                style={[styles.crewOption, crewId === crew.id && styles.crewOptionActive]}
                onPress={() => setCrewId(crew.id)}
              >
                <Text style={styles.crewName}>{crew.name}</Text>
                <Text style={styles.crewCode}>INVITE {crew.invite_code}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={15} color={LIME} />
          <Text style={styles.privacyText}>Your drive stays private until you choose a destination and share it.</Text>
        </View>
        <Pressable
          style={[styles.publishButton, (publishing || loading) && styles.disabled]}
          onPress={() => void publish()}
          disabled={publishing || loading}
        >
          <Ionicons name={publishing ? 'hourglass-outline' : 'paper-plane-outline'} size={18} color="#101311" />
          <Text style={styles.publishText}>{publishing ? 'SHARING…' : 'SHARE ACTIVITY'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: LIME, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  eyebrow: { color: LIME, fontFamily: 'Manrope-Bold', fontSize: 8, letterSpacing: 1.5 },
  title: { color: '#F4F6EF', fontFamily: 'Michroma', fontSize: 13, marginTop: 4 },
  content: { paddingHorizontal: 20 },
  activityCard: { backgroundColor: '#1A201A', borderRadius: 17, borderWidth: 1, borderColor: '#303A30', padding: 14, marginBottom: 24 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 14, left: 14 },
  activitySummary: { minHeight: 40, justifyContent: 'center', marginLeft: 48 },
  activityTitle: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 12 },
  activitySubtitle: { color: '#A9B5A0', fontFamily: 'Manrope', fontSize: 9, marginTop: 3 },
  activityStats: { position: 'absolute', right: 14, top: 17, alignItems: 'flex-end' },
  activityDistance: { color: LIME, fontFamily: 'ChakraPetch', fontSize: 17 },
  trackPreview: { height: 160, marginTop: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: '#080A09', borderWidth: 1, borderColor: '#293229' },
  noTrack: { color: '#879181', textAlign: 'center', marginTop: 70, fontFamily: 'Manrope', fontSize: 10 },
  trackCaption: { color: '#879181', fontFamily: 'Manrope-Bold', fontSize: 8, letterSpacing: 1, marginTop: 9 },
  sectionTitle: { color: '#A9B5A0', fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1.3, marginBottom: 9 },
  captionInput: { minHeight: 92, padding: 13, color: '#F4F6EF', backgroundColor: '#1A201A', borderWidth: 1, borderColor: '#303A30', borderRadius: 13, fontFamily: 'Manrope', fontSize: 11, lineHeight: 17 },
  characterCount: { color: '#687263', fontFamily: 'Manrope', fontSize: 8, textAlign: 'right', marginTop: 5, marginBottom: 22 },
  audienceOption: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, marginBottom: 8, backgroundColor: '#1A201A', borderRadius: 13, borderWidth: 1, borderColor: '#303A30' },
  audienceOptionActive: { borderColor: 'rgba(194,240,68,0.65)', backgroundColor: '#20281C' },
  audienceCopy: { flex: 1 },
  audienceTitle: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 10 },
  audienceDetail: { color: '#879181', fontFamily: 'Manrope', fontSize: 8, marginTop: 3 },
  crewList: { gap: 7, marginVertical: 4 },
  crewOption: { padding: 11, borderWidth: 1, borderColor: '#303A30', borderRadius: 11 },
  crewOptionActive: { borderColor: LIME },
  crewName: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 10 },
  crewCode: { color: '#879181', fontFamily: 'Manrope', fontSize: 8, marginTop: 4, letterSpacing: 1 },
  emptyCrews: { color: '#879181', fontFamily: 'Manrope', fontSize: 10, paddingVertical: 10 },
  privacyNote: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 15, marginBottom: 14 },
  privacyText: { flex: 1, color: '#A9B5A0', fontFamily: 'Manrope', fontSize: 9, lineHeight: 14 },
  publishButton: { minHeight: 51, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: LIME },
  publishText: { color: '#101311', fontFamily: 'Manrope-Bold', fontSize: 10, letterSpacing: 1.2 },
  disabled: { opacity: 0.5 },
});
