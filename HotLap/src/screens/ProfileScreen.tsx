import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Pressable, 
  Image, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing,
  FadeInDown,
  withRepeat,
  withSequence
} from 'react-native-reanimated';
import EditProfileScreen from '../screens/EditProfileScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SkeletonItem = ({ width, height, borderRadius = 4, style }: any) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#252C25' },
        animatedStyle,
        style,
      ]}
    />
  );
};

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  
  // Stats
  const [crewCount, setCrewCount] = useState(0);
  const [convoyCount, setConvoyCount] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);

  // Tabs State: 'garage' or 'activity'
  const [activeTab, setActiveTab] = useState<'garage' | 'activity'>('garage');
  const tabIndicatorPosition = useSharedValue(0);

  useEffect(() => {
    fetchProfileData();
  }, []);

  async function fetchProfileData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 1. Get Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      // 2. Get Primary Vehicle (for the big Garage block)
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .single();

      // 3. Get Stats (Segments, Crew, Convoy)
      const { count: segments } = await supabase
        .from('routes')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', user.id);

      const { count: crew } = await supabase
        .from('crew_connections')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: convoy } = await supabase
        .from('crew_connections')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setProfile(profileData);
      setVehicle(vehicleData);
      setSegmentCount(segments || 0);
      setCrewCount(crew || 0);
      setConvoyCount(convoy || 0);
    }
    setLoading(false);
  }

  // --- ANIMATIONS ---
  const handleTabPress = (tab: 'garage' | 'activity') => {
    setActiveTab(tab);
    tabIndicatorPosition.value = withTiming(tab === 'garage' ? 0 : 1, {
      duration: 300,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (SCREEN_WIDTH - 60) / 2; // 60 is total horizontal padding
    return {
      transform: [{ translateX: tabIndicatorPosition.value * tabWidth }],
    };
  });

    if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <SkeletonItem width={120} height={20} borderRadius={10} />
          <SkeletonItem width={24} height={24} borderRadius={12} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.profileSection}>
            <SkeletonItem width={100} height={100} borderRadius={50} style={{ marginBottom: 16 }} />
            <SkeletonItem width={200} height={28} borderRadius={14} style={{ marginBottom: 12 }} />
            <SkeletonItem width={280} height={16} borderRadius={8} style={{ marginBottom: 8 }} />
            <SkeletonItem width={240} height={16} borderRadius={8} style={{ marginBottom: 20 }} />
            <SkeletonItem width={140} height={40} borderRadius={25} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <SkeletonItem width={40} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
              <SkeletonItem width={50} height={12} borderRadius={6} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <SkeletonItem width={40} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
              <SkeletonItem width={60} height={12} borderRadius={6} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <SkeletonItem width={40} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
              <SkeletonItem width={70} height={12} borderRadius={6} />
            </View>
          </View>

          <View style={[styles.tabsContainer, { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15 }]}>
            <SkeletonItem width={80} height={16} borderRadius={8} />
            <SkeletonItem width={80} height={16} borderRadius={8} />
          </View>

          <View style={styles.tabContent}>
            <View style={styles.garageHeader}>
              <SkeletonItem width={120} height={16} borderRadius={8} />
              <SkeletonItem width={24} height={24} borderRadius={12} />
            </View>
            <SkeletonItem width={'100%'} height={220} borderRadius={20} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* HEADER: Settings & Share */}
      <View style={styles.topBar}>
        <Text style={styles.username}>@{profile?.username}</Text>
        <Pressable style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#F4F6EF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* PROFILE INFO */}
        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0) || 'D'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.fullName}>{profile?.full_name || 'Driver'}</Text>
          <Text style={styles.bio}>
            {profile?.bio || "Building the ultimate machine. Searching for the perfect apex."}
          </Text>

          <Pressable 
            style={styles.editProfileButton} 
            onPress={() => navigation.navigate('EditProfileScreen', { profile })}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </Pressable>
        </Animated.View>

        {/* STATS ROW */}
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{crewCount}</Text>
            <Text style={styles.statLabel}>Crew</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{convoyCount}</Text>
            <Text style={styles.statLabel}>Convoy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{segmentCount}</Text>
            <Text style={styles.statLabel}>Segments</Text>
          </View>
        </Animated.View>

        {/* CUSTOM ANIMATED TABS */}
        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.tabsContainer}>
          <View style={styles.tabHeaders}>
            <Pressable style={styles.tabButton} onPress={() => handleTabPress('garage')}>
              <Text style={[styles.tabText, activeTab === 'garage' && styles.tabTextActive]}>GARAGE</Text>
            </Pressable>
            <Pressable style={styles.tabButton} onPress={() => handleTabPress('activity')}>
              <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>ACTIVITY</Text>
            </Pressable>
          </View>
          
          {/* The Acid Lime sliding underline */}
          <View style={styles.indicatorTrack}>
            <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />
          </View>
        </Animated.View>

        {/* TAB CONTENT */}
        <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.tabContent}>
          
          {activeTab === 'garage' ? (
            <View style={styles.garageContainer}>
              <View style={styles.garageHeader}>
                <Text style={styles.garageTitle}>PRIMARY SETUP</Text>
                <Ionicons name="add-circle" size={24} color="#C2F044" />
              </View>

              {/* HUGE GARAGE BLOCK */}
              <View style={styles.carBlock}>
                {/* Background graphic/gradient placeholder */}
                <View style={styles.carBlockImagePlaceholder}>
                  <Ionicons name="car-sport" size={80} color="#101311" style={{ opacity: 0.5 }} />
                </View>
                
                <View style={styles.carBlockOverlay}>
                  <View style={styles.carBadge}>
                    <Text style={styles.carBadgeText}>{vehicle?.year || profile?.car_year || '2016'}</Text>
                  </View>
                  <Text style={styles.carBrand}>{vehicle?.make || profile?.car_brand || 'AUDI'}</Text>
                  <Text style={styles.carModel}>{vehicle?.model || profile?.car_model || 'A3 E-TRON'}</Text>
                  
                  <View style={styles.carStatsRow}>
                    <View style={styles.carStatItem}>
                      <Ionicons name="speedometer-outline" size={16} color="#A9B5A0" />
                      <Text style={styles.carStatText}>Stock</Text>
                    </View>
                    <View style={styles.carStatItem}>
                      <Ionicons name="map-outline" size={16} color="#A9B5A0" />
                      <Text style={styles.carStatText}>12 Segments</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.activityContainer}>
              {/* Placeholder for future Activity feed */}
              <View style={styles.emptyActivityBox}>
                <Ionicons name="flag-outline" size={40} color="#303A30" />
                <Text style={styles.emptyActivityText}>No segments recorded yet.</Text>
                <Text style={styles.emptyActivitySub}>Time to hit the road and build your legacy.</Text>
              </View>
            </View>
          )}

        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' }, // Obsidian
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 10 },
  username: { fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#F4F6EF' }, // Soft Ivory
  settingsButton: { padding: 5 },

  profileSection: { alignItems: 'center', paddingHorizontal: 30, marginTop: 10 },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#C2F044', // Acid Lime ring
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, backgroundColor: '#252C25'
  },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 50, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontFamily: 'Michroma', fontSize: 32, color: '#F4F6EF' },
  
  fullName: { fontFamily: 'Michroma', fontSize: 22, color: '#F4F6EF', marginBottom: 8 },
  bio: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', textAlign: 'center', marginBottom: 20, lineHeight: 22 }, // Sage Grey
  
  editProfileButton: { backgroundColor: '#252C25', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, borderWidth: 1, borderColor: '#303A30' },
  editProfileText: { fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#C2F044' }, // Acid Lime text

  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: '#252C25' },
  statBlock: { alignItems: 'center', width: 90 },
  statNumber: { fontFamily: 'Michroma', fontSize: 20, color: '#F4F6EF', marginBottom: 4 },
  statLabel: { fontFamily: 'Manrope', fontSize: 12, color: '#A9B5A0', textTransform: 'uppercase', letterSpacing: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: '#252C25' },

  tabsContainer: { marginTop: 20, paddingHorizontal: 30 },
  tabHeaders: { flexDirection: 'row', justifyContent: 'space-between' },
  tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  tabText: { fontFamily: 'Michroma', fontSize: 12, color: '#A9B5A0' },
  tabTextActive: { color: '#C2F044' }, // Acid Lime active state
  
  indicatorTrack: { height: 2, backgroundColor: '#252C25', width: '100%', borderRadius: 1 },
  indicator: { height: 2, backgroundColor: '#C2F044', width: '50%', borderRadius: 1 },

  tabContent: { flex: 1, paddingHorizontal: 30, paddingTop: 24 },
  
  // GARAGE TAB STYLES
  garageContainer: { flex: 1 },
  garageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  garageTitle: { fontFamily: 'Manrope', fontSize: 12, fontWeight: '800', color: '#A9B5A0', letterSpacing: 1.5 },
  
  carBlock: {
    width: '100%', height: 220,
    backgroundColor: '#252C25', // Charcoal green
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#303A30',
  },
  carBlockImagePlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#C2F044', // Gives an Acid Lime glow to the background
    justifyContent: 'center', alignItems: 'center',
    opacity: 0.1, // Subtle glow
  },
  carBlockOverlay: { flex: 1, padding: 24, justifyContent: 'flex-end' },
  carBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(194, 240, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(194, 240, 68, 0.3)' },
  carBadgeText: { fontFamily: 'Michroma', fontSize: 10, color: '#C2F044' },
  carBrand: { fontFamily: 'Michroma', fontSize: 16, color: '#A9B5A0', marginBottom: 2, textTransform: 'uppercase' },
  carModel: { fontFamily: 'Michroma', fontSize: 26, color: '#F4F6EF', marginBottom: 16, textTransform: 'uppercase' },
  
  carStatsRow: { flexDirection: 'row', alignItems: 'center' },
  carStatItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  carStatText: { fontFamily: 'Manrope', fontSize: 12, color: '#A9B5A0', marginLeft: 6 },

  // ACTIVITY TAB STYLES
  activityContainer: { flex: 1, paddingTop: 20 },
  emptyActivityBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#252C25', borderRadius: 20, padding: 40, borderWidth: 1, borderColor: '#303A30', borderStyle: 'dashed' },
  emptyActivityText: { fontFamily: 'Michroma', fontSize: 14, color: '#F4F6EF', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptyActivitySub: { fontFamily: 'Manrope', fontSize: 12, color: '#A9B5A0', textAlign: 'center', lineHeight: 18 },
});