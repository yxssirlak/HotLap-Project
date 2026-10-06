import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';

type Profile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  car_brand?: string | null;
  car_model?: string | null;
  car_year?: string | number | null;
};

type Vehicle = {
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
};

type Drive = {
  id?: string | number;
  title?: string | null;
  name?: string | null;
  route_name?: string | null;
  created_at?: string | null;
  distance_km?: number | null;
  distance?: number | null;
};

type ProfileScreenProps = {
  navigation: { navigate: (screen: string, params?: object) => void };
};

const ACCENT = '#C2F044';

function formatDate(value?: string | null) {
  if (!value) return 'Recent drive';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recent drive'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [crewCount, setCrewCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [driveCount, setDriveCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'garage' | 'activity'>('garage');

  const fetchProfileData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Your session has expired. Please sign in again.');

      const [profileResult, vehicleResult, drivesResult, crewResult, followingResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('vehicles').select('*').eq('owner_id', user.id).limit(1).maybeSingle(),
        supabase.from('routes').select('*', { count: 'exact' }).eq('creator_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('crew_connections').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('crew_connections').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
      ]);

      const results = [
        ['Profile', profileResult.error],
        ['Garage', vehicleResult.error],
        ['Drive history', drivesResult.error],
        ['Crew followers', crewResult.error],
        ['Following', followingResult.error],
      ] as const;
      const failedResult = results.find(([, error]) => error);
      if (failedResult?.[1]) {
        throw new Error(`${failedResult[0]} could not be loaded: ${failedResult[1].message}`);
      }

      setProfile(profileResult.data as Profile | null);
      setVehicle(vehicleResult.data as Vehicle | null);
      setDrives((drivesResult.data || []) as Drive[]);
      setDriveCount(drivesResult.count || 0);
      setCrewCount(crewResult.count || 0);
      setFollowingCount(followingResult.count || 0);
    } catch (error) {
      Alert.alert('Profile unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchProfileData();
  }, [fetchProfileData]));

  const handleShare = async () => {
    const name = profile?.full_name || 'HotLap driver';
    const handle = profile?.username ? `@${profile.username}` : '';
    try {
      await Share.share({
        message: `Check out ${name}${handle ? ` (${handle})` : ''} on HotLap — the driving crew for car enthusiasts.`,
      });
    } catch (error) {
      Alert.alert('Could not share profile', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in to access your HotLap profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Could not sign out', error.message);
        },
      },
    ]);
  };

  const openSettings = () => {
    Alert.alert('Profile options', 'Manage your HotLap profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Refresh profile', onPress: () => void fetchProfileData() },
      { text: 'Share profile', onPress: () => void handleShare() },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  };

  const completionFields = [
    profile?.full_name,
    profile?.username,
    profile?.bio,
    profile?.avatar_url,
    profile?.car_brand || vehicle?.make,
    profile?.car_model || vehicle?.model,
  ];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const carBrand = vehicle?.make || profile?.car_brand;
  const carModel = vehicle?.model || profile?.car_model;
  const carYear = vehicle?.year || profile?.car_year;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading your driver profile…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>DRIVER PROFILE</Text>
          <Text style={styles.username}>{profile?.username ? `@${profile.username}` : '@new-driver'}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconButton} onPress={() => void handleShare()} accessibilityLabel="Share profile">
            <Ionicons name="share-social-outline" size={20} color="#F4F6EF" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={openSettings} accessibilityLabel="Profile options">
            <Ionicons name="ellipsis-horizontal" size={21} color="#F4F6EF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchProfileData(false);
            }}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(450).delay(60)} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatarRing}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || 'D'}</Text>
                </View>
              )}
            </View>
            <View style={styles.driverIdentity}>
              <Text style={styles.fullName}>{profile?.full_name || 'HotLap Driver'}</Text>
              <View style={styles.driverTag}>
                <Ionicons name="speedometer-outline" size={13} color={ACCENT} />
                <Text style={styles.driverTagText}>ROAD CREW MEMBER</Text>
              </View>
            </View>
          </View>
          <Text style={styles.bio}>
            {profile?.bio || 'Your road story starts here. Add a bio and let the crew know what you drive.'}
          </Text>
          <View style={styles.heroButtons}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.navigate('EditProfileScreen', { profile })}
            >
              <Ionicons name="create-outline" size={17} color="#101311" />
              <Text style={styles.primaryButtonText}>Edit profile</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void handleShare()}>
              <Ionicons name="share-outline" size={17} color={ACCENT} />
            </Pressable>
          </View>
          <View style={styles.completionBlock}>
            <View style={styles.completionLabels}>
              <Text style={styles.completionTitle}>PROFILE CHECK-IN</Text>
              <Text style={styles.completionValue}>{completion}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completion}%` }]} />
            </View>
            {completion < 100 && (
              <Text style={styles.completionHint}>Finish your profile so drivers know who they’re riding with.</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(120)} style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{driveCount}</Text>
            <Text style={styles.statLabel}>DRIVES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{crewCount}</Text>
            <Text style={styles.statLabel}>CREW</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>FOLLOWING</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(180)} style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Record')}>
            <View style={styles.quickIcon}><Ionicons name="radio-button-on-outline" size={19} color={ACCENT} /></View>
            <View style={styles.quickText}>
              <Text style={styles.quickTitle}>Record a drive</Text>
              <Text style={styles.quickSubtitle}>Log a new road session</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#687263" />
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Map')}>
            <View style={styles.quickIcon}><Ionicons name="map-outline" size={19} color={ACCENT} /></View>
            <View style={styles.quickText}>
              <Text style={styles.quickTitle}>Explore the map</Text>
              <Text style={styles.quickSubtitle}>Find roads and drivers nearby</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#687263" />
          </Pressable>
        </Animated.View>

        <View style={styles.tabsContainer}>
          <Pressable style={[styles.tabButton, activeTab === 'garage' && styles.activeTab]} onPress={() => setActiveTab('garage')}>
            <Ionicons name="car-sport-outline" size={17} color={activeTab === 'garage' ? ACCENT : '#879181'} />
            <Text style={[styles.tabText, activeTab === 'garage' && styles.activeTabText]}>MY GARAGE</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, activeTab === 'activity' && styles.activeTab]} onPress={() => setActiveTab('activity')}>
            <Ionicons name="time-outline" size={17} color={activeTab === 'activity' ? ACCENT : '#879181'} />
            <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>DRIVE LOG</Text>
          </Pressable>
        </View>

        {activeTab === 'garage' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>YOUR MACHINE</Text>
                <Text style={styles.sectionCaption}>The car behind your HotLap story</Text>
              </View>
              <Ionicons name="car-sport" size={26} color={ACCENT} />
            </View>
            <View style={styles.carCard}>
              <View style={styles.carGraphic}>
                <Ionicons name="car-sport" size={55} color={ACCENT} />
                <View style={styles.carGraphicLine} />
              </View>
              {carBrand || carModel ? (
                <>
                  <Text style={styles.carYear}>{carYear || 'YOUR BUILD'}</Text>
                  <Text style={styles.carBrand}>{carBrand || 'Car make'}</Text>
                  <Text style={styles.carModel}>{carModel || 'Add your model'}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.carBrand}>Garage is waiting</Text>
                  <Text style={styles.carEmptyText}>Add your car to make this profile yours.</Text>
                </>
              )}
              <Pressable
                style={styles.carEditButton}
                onPress={() => navigation.navigate('EditProfileScreen', { profile })}
              >
                <Text style={styles.carEditText}>{carBrand || carModel ? 'Edit car details' : 'Add your car'}</Text>
                <Ionicons name="arrow-forward" size={15} color={ACCENT} />
              </Pressable>
            </View>

            <View style={styles.achievementCard}>
              <View style={styles.achievementIcon}>
                <Ionicons name={driveCount > 0 ? 'trophy' : 'flag-outline'} size={21} color={ACCENT} />
              </View>
              <View style={styles.achievementCopy}>
                <Text style={styles.achievementTitle}>{driveCount > 0 ? 'First tracks laid' : 'Your first drive awaits'}</Text>
                <Text style={styles.achievementSubtitle}>
                  {driveCount > 0 ? `${driveCount} ${driveCount === 1 ? 'drive' : 'drives'} in your log` : 'Record your first session to start your drive log.'}
                </Text>
              </View>
              {driveCount === 0 && (
                <Pressable onPress={() => navigation.navigate('Record')}>
                  <Ionicons name="arrow-forward-circle" size={25} color={ACCENT} />
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>RECENT DRIVES</Text>
                <Text style={styles.sectionCaption}>Your latest sessions on the road</Text>
              </View>
              <Ionicons name="trail-sign-outline" size={25} color={ACCENT} />
            </View>
            {drives.length ? drives.map((drive, index) => {
              const driveName = drive.title || drive.name || drive.route_name || `Drive ${driveCount - index}`;
              const distance = drive.distance_km ?? drive.distance;
              return (
                <View key={drive.id ?? `${driveName}-${index}`} style={styles.driveCard}>
                  <View style={styles.driveIcon}><Ionicons name="navigate-outline" size={19} color={ACCENT} /></View>
                  <View style={styles.driveCopy}>
                    <Text style={styles.driveName} numberOfLines={1}>{driveName}</Text>
                    <Text style={styles.driveDate}>{formatDate(drive.created_at)}</Text>
                  </View>
                  {typeof distance === 'number' && (
                    <Text style={styles.driveDistance}>{distance.toFixed(1)} km</Text>
                  )}
                </View>
              );
            }) : (
              <View style={styles.emptyCard}>
                <Ionicons name="flag-outline" size={30} color="#687263" />
                <Text style={styles.emptyTitle}>No drives logged yet</Text>
                <Text style={styles.emptyText}>Start recording to build your personal road history.</Text>
                <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('Record')}>
                  <Text style={styles.emptyButtonText}>Record your first drive</Text>
                  <Ionicons name="arrow-forward" size={15} color="#101311" />
                </Pressable>
              </View>
            )}
          </View>
        )}

        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={15} color="#687263" />
          <Text style={styles.footerNoteText}>Your profile and drive stats belong to you.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  loadingContainer: { flex: 1, backgroundColor: '#101311', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 13, marginTop: 12 },
  topBar: { minHeight: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 8 },
  eyebrow: { fontFamily: 'Manrope-Bold', fontSize: 9, color: '#879181', letterSpacing: 1.8 },
  username: { fontFamily: 'Manrope-Bold', fontSize: 16, color: '#F4F6EF', marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 9 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#303A30' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 118 },
  heroCard: { backgroundColor: '#1A201A', borderRadius: 22, borderWidth: 1, borderColor: '#303A30', padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: ACCENT, backgroundColor: '#252C25', padding: 3 },
  avatar: { width: '100%', height: '100%', borderRadius: 32 },
  avatarPlaceholder: { flex: 1, borderRadius: 32, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontFamily: 'Michroma', fontSize: 27, color: '#F4F6EF' },
  driverIdentity: { flex: 1, marginLeft: 14 },
  fullName: { fontFamily: 'Michroma', fontSize: 16, color: '#F4F6EF' },
  driverTag: { flexDirection: 'row', alignItems: 'center', marginTop: 7, gap: 5 },
  driverTagText: { fontFamily: 'Manrope-Bold', fontSize: 9, color: ACCENT, letterSpacing: 1 },
  bio: { fontFamily: 'Manrope', fontSize: 13, lineHeight: 20, color: '#A9B5A0', marginTop: 16 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: { height: 42, flex: 1, borderRadius: 11, backgroundColor: ACCENT, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primaryButtonText: { fontFamily: 'Manrope-Bold', color: '#101311', fontSize: 13 },
  secondaryButton: { height: 42, width: 48, borderRadius: 11, borderWidth: 1, borderColor: '#3A4537', backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  completionBlock: { marginTop: 19 },
  completionLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  completionTitle: { fontFamily: 'Manrope-Bold', fontSize: 9, color: '#879181', letterSpacing: 1 },
  completionValue: { fontFamily: 'Manrope-Bold', fontSize: 10, color: ACCENT },
  progressTrack: { height: 5, backgroundColor: '#303A30', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 4 },
  completionHint: { fontFamily: 'Manrope', fontSize: 10, color: '#879181', marginTop: 7 },
  statsCard: { marginTop: 13, backgroundColor: '#1A201A', borderRadius: 16, borderWidth: 1, borderColor: '#303A30', flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  statBlock: { flex: 1, alignItems: 'center' },
  statNumber: { fontFamily: 'Michroma', fontSize: 19, color: '#F4F6EF' },
  statLabel: { fontFamily: 'Manrope-Bold', fontSize: 9, color: '#879181', letterSpacing: 1.2, marginTop: 3 },
  statDivider: { width: 1, height: 30, backgroundColor: '#303A30' },
  quickActions: { marginTop: 13, backgroundColor: '#1A201A', borderRadius: 16, borderWidth: 1, borderColor: '#303A30', paddingHorizontal: 14 },
  quickAction: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#303A30' },
  quickIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  quickText: { flex: 1, marginLeft: 11 },
  quickTitle: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#F4F6EF' },
  quickSubtitle: { fontFamily: 'Manrope', fontSize: 10, color: '#879181', marginTop: 2 },
  tabsContainer: { flexDirection: 'row', marginTop: 22, borderBottomWidth: 1, borderBottomColor: '#303A30' },
  tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: ACCENT },
  tabText: { fontFamily: 'Manrope-Bold', fontSize: 10, color: '#879181', letterSpacing: 1 },
  activeTabText: { color: ACCENT },
  section: { paddingTop: 20 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  sectionTitle: { fontFamily: 'Michroma', fontSize: 12, color: '#F4F6EF', letterSpacing: 0.7 },
  sectionCaption: { fontFamily: 'Manrope', fontSize: 10, color: '#879181', marginTop: 4 },
  carCard: { minHeight: 225, borderRadius: 18, overflow: 'hidden', backgroundColor: '#202820', borderWidth: 1, borderColor: '#303A30', padding: 19, justifyContent: 'flex-end' },
  carGraphic: { position: 'absolute', top: 20, right: 18, width: 112, height: 92, borderRadius: 56, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(194,240,68,0.07)' },
  carGraphicLine: { position: 'absolute', width: 142, height: 1, backgroundColor: 'rgba(194,240,68,0.18)', transform: [{ rotate: '-25deg' }] },
  carYear: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', backgroundColor: '#303A30', color: ACCENT, fontFamily: 'Manrope-Bold', fontSize: 10, marginBottom: 10 },
  carBrand: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#A9B5A0', letterSpacing: 1.5, textTransform: 'uppercase' },
  carModel: { fontFamily: 'Michroma', fontSize: 22, color: '#F4F6EF', marginTop: 4 },
  carEmptyText: { fontFamily: 'Manrope', fontSize: 12, color: '#A9B5A0', marginTop: 5 },
  carEditButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 16 },
  carEditText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: ACCENT },
  achievementCard: { marginTop: 12, padding: 14, backgroundColor: '#1A201A', borderRadius: 14, borderWidth: 1, borderColor: '#303A30', flexDirection: 'row', alignItems: 'center' },
  achievementIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  achievementCopy: { flex: 1, marginLeft: 11 },
  achievementTitle: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#F4F6EF' },
  achievementSubtitle: { fontFamily: 'Manrope', fontSize: 10, color: '#879181', marginTop: 3 },
  driveCard: { minHeight: 68, paddingHorizontal: 13, backgroundColor: '#1A201A', borderRadius: 13, borderWidth: 1, borderColor: '#303A30', flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driveIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  driveCopy: { flex: 1, marginLeft: 11 },
  driveName: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#F4F6EF' },
  driveDate: { fontFamily: 'Manrope', fontSize: 10, color: '#879181', marginTop: 4 },
  driveDistance: { fontFamily: 'Manrope-Bold', fontSize: 11, color: ACCENT, marginLeft: 8 },
  emptyCard: { alignItems: 'center', backgroundColor: '#1A201A', borderRadius: 16, borderWidth: 1, borderColor: '#303A30', borderStyle: 'dashed', padding: 24 },
  emptyTitle: { fontFamily: 'Michroma', fontSize: 12, color: '#F4F6EF', marginTop: 12 },
  emptyText: { fontFamily: 'Manrope', fontSize: 11, color: '#879181', lineHeight: 17, textAlign: 'center', marginTop: 6 },
  emptyButton: { marginTop: 16, backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  emptyButtonText: { fontFamily: 'Manrope-Bold', fontSize: 11, color: '#101311' },
  footerNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 },
  footerNoteText: { fontFamily: 'Manrope', fontSize: 10, color: '#687263' },
});
