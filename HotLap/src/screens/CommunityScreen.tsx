import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Region } from 'react-native-maps';
import { MapView, Polyline } from '../components/NativeMaps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { formatElevation, formatSpeed, formatTravelDistance, getDistanceUnit } from '../utils/units';

type FeedTab = 'following' | 'local' | 'crews';
type ScreenMode = 'feed' | 'notifications';
type TrackCoordinate = { latitude: number; longitude: number };
type CommunityPost = {
  id: string;
  user_id: string;
  author_username: string;
  author_name: string;
  author_avatar_url: string | null;
  activity_type: 'drive' | 'sprint';
  caption: string;
  vehicle: string;
  duration_seconds: number;
  distance_meters: number;
  average_speed_kmh: number;
  top_speed_kmh: number | null;
  details: Record<string, number | string | null>;
  track: TrackCoordinate[];
  audience: 'followers' | 'local' | 'crew';
  crew_id: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
};
type PostComment = {
  id: string;
  user_id: string;
  author_username: string;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
};
type CommunityNotification = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_avatar_url: string | null;
  post_id: string;
  comment_id: string | null;
  notification_type: 'like' | 'comment';
  created_at: string;
  read_at: string | null;
};
type Crew = { id: string; name: string; invite_code: string };
type GeoPoint = { latitude: number; longitude: number };
const FEED_TABS = [
  { id: 'following', label: 'Following', icon: 'people-outline' },
  { id: 'local', label: 'Local Discover', icon: 'location-outline' },
  { id: 'crews', label: 'Crews', icon: 'flag-outline' },
] as const;

const LIME = '#C2F044';
const DISTANCE_UNIT = getDistanceUnit();
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#080A09' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A9B5A0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202522' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1013' }] },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function regionForTrack(track: TrackCoordinate[]): Region {
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
  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds;
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.005, (maxLatitude - minLatitude) * 1.4),
    longitudeDelta: Math.max(0.005, (maxLongitude - minLongitude) * 1.4),
  };
}

export default function CommunityScreen() {
  const [tab, setTab] = useState<FeedTab>('following');
  const [mode, setMode] = useState<ScreenMode>('feed');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [managementMode, setManagementMode] = useState<'create' | 'join' | null>(null);
  const [managementDraft, setManagementDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const readLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Allow location access to find activities within 50 km / 30 mi.');
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
    setLocation(point);
    return point;
  }, []);

  const loadCrews = useCallback(async (userId: string) => {
    const { data: memberships, error: membershipError } = await supabase
      .from('crew_members').select('crew_id').eq('user_id', userId);
    if (membershipError) throw membershipError;
    const ids = (memberships || []).map((row) => row.crew_id);
    if (ids.length === 0) {
      setCrews([]);
      return [];
    }
    const { data, error } = await supabase.from('crews')
      .select('id, name, invite_code').in('id', ids).order('name');
    if (error) throw error;
    const myCrews = (data || []) as Crew[];
    setCrews(myCrews);
    return myCrews;
  }, []);

  const loadNotifications = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('community_notifications')
      .select('id, actor_id, actor_name, actor_avatar_url, post_id, comment_id, notification_type, created_at, read_at')
      .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    setNotifications((data || []) as CommunityNotification[]);
  }, []);

  const loadFeed = useCallback(async (nextTab = tab) => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sign in to see your community feed.');
      await loadNotifications(user.id);
      let query = supabase.from('community_posts')
        .select('id, user_id, author_username, author_name, author_avatar_url, activity_type, caption, vehicle, duration_seconds, distance_meters, average_speed_kmh, top_speed_kmh, details, track, audience, crew_id, like_count, comment_count, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      let result: CommunityPost[] = [];

      if (nextTab === 'following') {
        const { data: follows, error: followError } = await supabase
          .from('crew_connections').select('following_id').eq('follower_id', user.id);
        if (followError) throw followError;
        const followedIds = [...new Set([user.id, ...(follows || []).map((row) => row.following_id)])];
        if (followedIds.length > 0) {
          const { data, error } = await query.eq('audience', 'followers').in('user_id', followedIds);
          if (error) throw error;
          result = (data || []) as CommunityPost[];
        } else {
          result = [];
        }
      } else if (nextTab === 'local') {
        const point = location || await readLocation();
        const { data, error } = await supabase.rpc('get_local_community_posts', {
          viewer_latitude: point.latitude,
          viewer_longitude: point.longitude,
        });
        if (error) throw error;
        result = (data || []) as CommunityPost[];
      } else {
        const myCrews = await loadCrews(user.id);
        const crewIds = myCrews.map((crew) => crew.id);
        if (crewIds.length > 0) {
          const { data, error } = await query.eq('audience', 'crew').in('crew_id', crewIds);
          if (error) throw error;
          result = (data || []) as CommunityPost[];
        } else {
          result = [];
        }
      }

      setPosts(result);
      if (result.length > 0) {
        const { data: likes, error: likesError } = await supabase.from('community_post_likes')
          .select('post_id').eq('user_id', user.id).in('post_id', result.map((post) => post.id));
        if (likesError) throw likesError;
        setLikedPostIds(new Set((likes || []).map((like) => like.post_id)));
      } else {
        setLikedPostIds(new Set());
      }
    } catch (error) {
      Alert.alert('Community unavailable', `${error instanceof Error ? error.message : 'Please try again.'}\n\nIf needed, run supabase/community.sql in the Supabase SQL Editor.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCrews, loadNotifications, location, readLocation, tab]);

  const loadCurrentNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error('Sign in to view notifications.');
      await loadNotifications(user.id);
    } catch (error) {
      Alert.alert('Notifications unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    if (mode === 'notifications') void loadCurrentNotifications();
    else void loadFeed(tab);
  }, [mode, tab, loadCurrentNotifications, loadFeed]);

  async function toggleLike(post: CommunityPost) {
    const alreadyLiked = likedPostIds.has(post.id);
    setLikedPostIds((current) => {
      const next = new Set(current);
      if (alreadyLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, like_count: Math.max(0, item.like_count + (alreadyLiked ? -1 : 1)) }
      : item));
    try {
      const { data, error } = await supabase.rpc('toggle_community_post_like', {
        target_post_id: post.id,
        viewer_latitude: location?.latitude ?? null,
        viewer_longitude: location?.longitude ?? null,
      });
      if (error) throw error;
      const serverLiked = Boolean(data);
      if (serverLiked !== !alreadyLiked) {
        setLikedPostIds((current) => {
          const next = new Set(current);
          if (serverLiked) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
        setPosts((current) => current.map((item) => item.id === post.id
          ? { ...item, like_count: Math.max(0, item.like_count + (serverLiked ? 1 : -1)) }
          : item));
      }
    } catch (error) {
      setLikedPostIds((current) => {
        const next = new Set(current);
        if (alreadyLiked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, like_count: Math.max(0, item.like_count + (alreadyLiked ? 1 : -1)) }
        : item));
      Alert.alert('Could not update like', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function openComments(post: CommunityPost) {
    setSelectedPost(post);
    setComments([]);
    setCommentDraft('');
    try {
      const { data, error } = await supabase.rpc('get_community_post_comments', {
        target_post_id: post.id,
        viewer_latitude: location?.latitude ?? null,
        viewer_longitude: location?.longitude ?? null,
      });
      if (error) throw error;
      setComments((data || []) as PostComment[]);
    } catch (error) {
      setSelectedPost(null);
      Alert.alert('Could not load comments', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function addComment() {
    if (!selectedPost || !commentDraft.trim() || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('add_community_post_comment', {
        target_post_id: selectedPost.id,
        comment_body: commentDraft.trim(),
        viewer_latitude: location?.latitude ?? null,
        viewer_longitude: location?.longitude ?? null,
      });
      if (error) throw error;
      setComments((current) => [...current, data as PostComment]);
      setCommentDraft('');
      setPosts((current) => current.map((post) => post.id === selectedPost.id
        ? { ...post, comment_count: post.comment_count + 1 }
        : post));
      setSelectedPost((current) => current ? { ...current, comment_count: current.comment_count + 1 } : current);
    } catch (error) {
      Alert.alert('Could not add comment', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationRead(item: CommunityNotification) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    setNotifications((current) => current.map((notification) =>
      notification.id === item.id ? { ...notification, read_at: now } : notification));
    const { error } = await supabase.from('community_notifications')
      .update({ read_at: now }).eq('id', item.id);
    if (error) {
      setNotifications((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, read_at: null } : notification));
      Alert.alert('Could not mark notification read', error.message);
    }
  }

  async function manageCrew() {
    if (!managementMode || !managementDraft.trim() || busy) return;
    setBusy(true);
    try {
      if (managementMode === 'create') {
        const { data, error } = await supabase.rpc('create_community_crew', { crew_name: managementDraft.trim() });
        if (error) throw error;
        const crew = data as Crew;
        Alert.alert('Crew created', `Share invite code ${crew.invite_code} with your friends.`);
      } else {
        const { error } = await supabase.rpc('join_community_crew', { requested_invite_code: managementDraft.trim() });
        if (error) throw error;
        Alert.alert('Crew joined', 'You can now share activities with this crew.');
      }
      setManagementMode(null);
      setManagementDraft('');
      await loadFeed('crews');
    } catch (error) {
      Alert.alert('Could not update crews', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const refresh = () => {
    setRefreshing(true);
    if (mode === 'notifications') void loadCurrentNotifications();
    else void loadFeed(tab);
  };

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const isFeedMode = mode === 'feed';
  const isNotificationMode = mode === 'notifications';
  const isFollowingTab = tab === 'following';
  const isLocalTab = tab === 'local';
  const isCrewTab = tab === 'crews';
  const showCrewActions = isCrewTab && isFeedMode;
  const screenTitle = isFeedMode ? 'Community' : 'Activity history';
  const toggleMode = () => setMode(isFeedMode ? 'notifications' : 'feed');
  const emptyTitle = isFollowingTab
    ? 'Your feed is quiet'
    : isLocalTab
      ? 'Nothing nearby yet'
      : 'No crew posts yet';
  const emptyBody = isFollowingTab
    ? 'When people you follow share a drive or sprint, it will show up here.'
    : isLocalTab
      ? 'Shared activities within 50 km / 30 mi will appear here.'
      : crews.length === 0
        ? 'Create a crew or join one with an invite code to share activities privately.'
        : 'Activities shared with your crews will appear here.';

  function renderPost(post: CommunityPost) {
    const track = Array.isArray(post.track) ? post.track : [];
    const isCrewAudiencePost = post.audience === 'crew';
    const isLocalAudiencePost = post.audience === 'local';
    const hasCrewName = isCrewAudiencePost && Boolean(post.crew_id);
    const audienceIcon = isLocalAudiencePost
      ? 'location-outline'
      : isCrewAudiencePost
        ? 'flag-outline'
        : 'people-outline';
    const audienceLabel = isLocalAudiencePost
      ? 'LOCAL'
      : isCrewAudiencePost
        ? 'CREW'
        : 'FOLLOWERS';
    const activityLabel = post.activity_type === 'sprint' ? 'SPRINT' : 'DRIVE';
    const postStats: Array<{ label: string; value: string }> = [
      { label: 'DISTANCE', value: formatTravelDistance(post.distance_meters, DISTANCE_UNIT, 1) },
      { label: 'DURATION', value: formatDuration(post.duration_seconds) },
      { label: 'AVG SPEED', value: formatSpeed(post.average_speed_kmh, DISTANCE_UNIT) },
    ];
    if (post.top_speed_kmh != null) {
      postStats.push({ label: 'TOP SPEED', value: formatSpeed(post.top_speed_kmh, DISTANCE_UNIT) });
    }
    if (typeof post.details?.peakG === 'number') {
      postStats.push({ label: 'PEAK G', value: `${post.details.peakG.toFixed(2)} g` });
    }
    if (typeof post.details?.peakBrakingG === 'number') {
      postStats.push({ label: 'BRAKING G', value: `${post.details.peakBrakingG.toFixed(2)} g` });
    }
    if (typeof post.details?.peakLateralG === 'number') {
      postStats.push({ label: 'LATERAL G', value: `${post.details.peakLateralG.toFixed(2)} g` });
    }
    if (typeof post.details?.elevationGainMeters === 'number') {
      postStats.push({
        label: 'ELEVATION',
        value: formatElevation(post.details.elevationGainMeters, DISTANCE_UNIT),
      });
    }
    return (
      <View key={post.id} style={styles.postCard}>
        <View style={styles.postHeader}>
          {post.author_avatar_url
            ? <Image source={{ uri: post.author_avatar_url }} style={styles.avatar} />
            : <View style={styles.avatar}><Text style={styles.avatarText}>{post.author_name.slice(0, 1).toUpperCase()}</Text></View>}
          <View style={styles.postAuthor}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.postMeta}>@{post.author_username} · {formatDate(post.created_at)}</Text>
            {hasCrewName && (
              <Text style={styles.crewMeta}>{crews.find((crew) => crew.id === post.crew_id)?.name || 'Crew'}</Text>
            )}
          </View>
          <View style={styles.audienceBadge}>
            <Ionicons name={audienceIcon} size={12} color={LIME} />
            <Text style={styles.audienceBadgeText}>{audienceLabel}</Text>
          </View>
        </View>

        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <View style={styles.vehicleLine}>
          <Ionicons name="car-sport-outline" size={15} color="#A9B5A0" />
          <Text style={styles.vehicleText}>{post.vehicle}</Text>
          <View style={styles.activityBadge}>
            <Text style={styles.activityBadgeText}>{activityLabel}</Text>
          </View>
        </View>

        {track.length > 1 ? (
          <MapView
            style={styles.routeMap}
            initialRegion={regionForTrack(track)}
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
            <Polyline coordinates={track} strokeColor="#000000" strokeWidth={9} />
            <Polyline coordinates={track} strokeColor={LIME} strokeWidth={5} />
          </MapView>
        ) : (
          <View style={[styles.routeMap, styles.noRoute]}>
            <Ionicons name="map-outline" size={25} color="#687263" />
            <Text style={styles.noRouteText}>No route data was recorded</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          {postStats.map((stat) => <Stat key={stat.label} label={stat.label} value={stat.value} />)}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => void toggleLike(post)} accessibilityRole="button" accessibilityLabel={likedPostIds.has(post.id) ? 'Unlike post' : 'Like post'}>
            <Ionicons name={likedPostIds.has(post.id) ? 'heart' : 'heart-outline'} size={20} color={likedPostIds.has(post.id) ? LIME : '#F4F6EF'} />
            <Text style={[styles.actionText, likedPostIds.has(post.id) && styles.likedText]}>{post.like_count}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => void openComments(post)} accessibilityRole="button" accessibilityLabel="View comments">
            <Ionicons name="chatbubble-outline" size={19} color="#F4F6EF" />
            <Text style={styles.actionText}>{post.comment_count}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>HOTLAP / DRIVERS</Text>
          <Text style={styles.headerTitle}>{screenTitle}</Text>
        </View>
        <View style={styles.headerActions}>
          {showCrewActions && (
            <Pressable style={styles.headerButton} onPress={() => { setManagementMode('join'); setManagementDraft(''); }} accessibilityLabel="Join a crew">
              <Ionicons name="enter-outline" size={18} color={LIME} />
            </Pressable>
          )}
          {showCrewActions && (
            <Pressable style={styles.headerButton} onPress={() => { setManagementMode('create'); setManagementDraft(''); }} accessibilityLabel="Create a crew">
              <Ionicons name="add" size={20} color={LIME} />
            </Pressable>
          )}
          <Pressable
            style={[styles.headerButton, isNotificationMode && styles.headerButtonActive]}
            onPress={toggleMode}
            accessibilityRole="button"
            accessibilityLabel={isFeedMode ? `Activity history, ${unreadCount} unread` : 'Back to community feed'}
          >
            <Ionicons name={isFeedMode ? 'notifications-outline' : 'people-outline'} size={18} color={isNotificationMode ? '#101311' : LIME} />
            {isFeedMode && unreadCount > 0 && <View style={styles.notificationDot} />}
          </Pressable>
        </View>
      </View>

      {isFeedMode && (
        <View style={styles.tabs}>
          {FEED_TABS.map((feedTab) => (
            <Pressable key={feedTab.id} style={[styles.tab, tab === feedTab.id && styles.tabActive]} onPress={() => setTab(feedTab.id)}>
              <Ionicons name={feedTab.icon} size={14} color={tab === feedTab.id ? '#101311' : '#A9B5A0'} />
              <Text style={[styles.tabText, tab === feedTab.id && styles.tabTextActive]}>{feedTab.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={LIME} colors={[LIME]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.stateBox}><ActivityIndicator color={LIME} /><Text style={styles.stateText}>LOADING COMMUNITY…</Text></View>
        ) : isNotificationMode ? (
          notifications.length === 0 ? (
            <EmptyState title="All caught up" body="Likes and comments on your shared activities will appear here." />
          ) : notifications.map((item) => (
            <Pressable key={item.id} style={[styles.notificationCard, !item.read_at && styles.notificationUnread]} onPress={() => void markNotificationRead(item)}>
              {item.actor_avatar_url
                ? <Image source={{ uri: item.actor_avatar_url }} style={styles.avatar} />
                : <View style={styles.avatar}><Text style={styles.avatarText}>{item.actor_name.slice(0, 1).toUpperCase()}</Text></View>}
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationText}>
                  <Text style={styles.notificationActor}>{item.actor_name}</Text>
                  {item.notification_type === 'like' ? ' liked your activity' : ' commented on your activity'}
                </Text>
                <Text style={styles.postMeta}>{formatDate(item.created_at)}</Text>
              </View>
              <Ionicons name={item.notification_type === 'like' ? 'heart' : 'chatbubble'} size={17} color={item.notification_type === 'like' ? LIME : '#A9B5A0'} />
            </Pressable>
          ))
        ) : posts.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
          />
        ) : posts.map(renderPost)}
        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={Boolean(selectedPost)} animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.headerButton} onPress={() => setSelectedPost(null)} accessibilityLabel="Close comments">
              <Ionicons name="close" size={19} color={LIME} />
            </Pressable>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={styles.headerButton} />
          </View>
          <ScrollView contentContainerStyle={styles.commentsList} keyboardShouldPersistTaps="handled">
            {comments.length === 0 ? (
              <EmptyState title="Start the conversation" body="Add the first comment on this activity." />
            ) : comments.map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                {comment.author_avatar_url
                  ? <Image source={{ uri: comment.author_avatar_url }} style={styles.commentAvatar} />
                  : <View style={styles.commentAvatar}><Text style={styles.avatarText}>{comment.author_name.slice(0, 1).toUpperCase()}</Text></View>}
                <View style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>{comment.author_name} <Text style={styles.commentHandle}>@{comment.author_username}</Text></Text>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                  <Text style={styles.commentDate}>{formatDate(comment.created_at)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.commentComposer}>
            <TextInput
              style={styles.commentInput}
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Write a comment…"
              placeholderTextColor="#879181"
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => void addComment()}
            />
            <Pressable style={[styles.sendButton, (!commentDraft.trim() || busy) && styles.disabled]} onPress={() => void addComment()} disabled={!commentDraft.trim() || busy}>
              {busy ? <ActivityIndicator size="small" color="#101311" /> : <Ionicons name="arrow-up" size={18} color="#101311" />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={managementMode != null} transparent animationType="fade" onRequestClose={() => setManagementMode(null)}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{managementMode === 'create' ? 'Create a crew' : 'Join a crew'}</Text>
            <Text style={styles.dialogBody}>{managementMode === 'create' ? 'Choose a name, then share the invite code with your crew.' : 'Enter the invite code shared by a crew member.'}</Text>
            <TextInput
              style={styles.dialogInput}
              value={managementDraft}
              onChangeText={setManagementDraft}
              placeholder={managementMode === 'create' ? 'Crew name' : 'Invite code'}
              placeholderTextColor="#879181"
              autoCapitalize={managementMode === 'join' ? 'characters' : 'words'}
              maxLength={48}
            />
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogCancel} onPress={() => setManagementMode(null)}><Text style={styles.dialogCancelText}>CANCEL</Text></Pressable>
              <Pressable style={styles.dialogSubmit} onPress={() => void manageCrew()} disabled={busy}>
                <Text style={styles.dialogSubmitText}>{busy ? 'PLEASE WAIT…' : managementMode === 'create' ? 'CREATE' : 'JOIN'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name="people-outline" size={22} color={LIME} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  headerEyebrow: { color: '#879181', fontFamily: 'Manrope-Bold', fontSize: 8, letterSpacing: 1.3 },
  headerTitle: { color: '#F4F6EF', fontFamily: 'Syne', fontSize: 25, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 7 },
  headerButton: { width: 39, height: 39, borderRadius: 13, borderWidth: 1, borderColor: '#303A30', backgroundColor: '#1A201A', alignItems: 'center', justifyContent: 'center' },
  headerButtonActive: { backgroundColor: LIME },
  notificationDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, top: 7, right: 7, backgroundColor: '#FF766C' },
  tabs: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 13 },
  tab: { flex: 1, minHeight: 37, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingHorizontal: 6,   borderRadius: 12, backgroundColor: 'rgba(244,246,239,0.05)', borderWidth: 1, borderColor: 'rgba(244,246,239,0.12)' },
  tabActive: { backgroundColor: LIME, borderColor: LIME },
  tabText: { color: '#A9B5A0', fontFamily: 'Manrope-Bold', fontSize: 8 },
  tabTextActive: { color: '#101311' },
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 14, paddingBottom: 20 },
  postCard: { backgroundColor: 'rgba(244,246,239,0.05)', borderRadius: 18, padding: 14, marginBottom: 13, borderWidth: 1, borderColor: 'rgba(244,246,239,0.12)' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#303A30', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: LIME, fontFamily: 'Syne', fontSize: 14 },
  postAuthor: { flex: 1, marginLeft: 10 },
  authorName: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 11 },
  postMeta: { color: '#879181', fontFamily: 'Manrope', fontSize: 8, marginTop: 3 },
  crewMeta: { color: LIME, fontFamily: 'Manrope-Bold', fontSize: 8, marginTop: 3 },
  audienceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 6, borderRadius: 9, backgroundColor: '#252C25' },
  audienceBadgeText: { color: LIME, fontFamily: 'Manrope-Bold', fontSize: 7, letterSpacing: 0.5 },
  caption: { color: '#E4EAE1', fontFamily: 'Manrope', fontSize: 11, lineHeight: 17, marginBottom: 12 },
  vehicleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  vehicleText: { flex: 1, color: '#A9B5A0', fontFamily: 'Manrope-Bold', fontSize: 9 },
  activityBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(194,240,68,0.12)' },
  activityBadgeText: { color: LIME, fontFamily: 'Manrope-Bold', fontSize: 7, letterSpacing: 0.7 },
  routeMap: { height: 205, borderRadius: 12, overflow: 'hidden', backgroundColor: '#080A09' },
  noRoute: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  noRouteText: { color: '#879181', fontFamily: 'Manrope', fontSize: 9 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, marginBottom: 11 },
  stat: { minWidth: '30%', flexGrow: 1, padding: 9, borderRadius: 10, backgroundColor: '#252C25' },
  statValue: { color: '#F4F6EF', fontFamily: 'ChakraPetch', fontSize: 13 },
  statLabel: { color: '#879181', fontFamily: 'Manrope-Bold', fontSize: 7, letterSpacing: 0.8, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 21, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#303A30' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  actionText: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 10 },
  likedText: { color: LIME },
  stateBox: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 12 },
  stateText: { color: '#879181', fontFamily: 'Manrope-Bold', fontSize: 9, letterSpacing: 1 },
  emptyState: { minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 25 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#20281C', justifyContent: 'center', alignItems: 'center', marginBottom: 13 },
  emptyTitle: { color: '#F4F6EF', fontFamily: 'Michroma', fontSize: 11, textAlign: 'center' },
  emptyBody: { maxWidth: 280, color: '#879181', fontFamily: 'Manrope', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  notificationCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, marginBottom: 8, borderRadius: 14, backgroundColor: 'rgba(244,246,239,0.05)', borderWidth: 1, borderColor: 'rgba(244,246,239,0.12)' },
  notificationUnread: { borderColor: 'rgba(194,240,68,0.45)', backgroundColor: '#20281C' },
  notificationCopy: { flex: 1 },
  notificationText: { color: '#D4DDCF', fontFamily: 'Manrope', fontSize: 10, lineHeight: 15 },
  notificationActor: { color: '#F4F6EF', fontFamily: 'Manrope-Bold' },
  modalContainer: { flex: 1, backgroundColor: '#101311' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 17, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#303A30' },
  modalTitle: { color: '#F4F6EF', fontFamily: 'Michroma', fontSize: 12 },
  commentsList: { flexGrow: 1, padding: 16 },
  commentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#303A30', justifyContent: 'center', alignItems: 'center' },
  commentBubble: { flex: 1, backgroundColor: '#1A201A', borderRadius: 12, padding: 10 },
  commentAuthor: { color: '#F4F6EF', fontFamily: 'Manrope-Bold', fontSize: 9 },
  commentHandle: { color: '#879181', fontFamily: 'Manrope', fontWeight: '400' },
  commentBody: { color: '#D4DDCF', fontFamily: 'Manrope', fontSize: 10, lineHeight: 15, marginTop: 5 },
  commentDate: { color: '#687263', fontFamily: 'Manrope', fontSize: 7, marginTop: 6 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderTopWidth: 1, borderTopColor: '#303A30' },
  commentInput: { flex: 1, minHeight: 42, maxHeight: 100, borderRadius: 13, paddingHorizontal: 12, color: '#F4F6EF', backgroundColor: '#1A201A', fontFamily: 'Manrope', fontSize: 10 },
  sendButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 25 },
  dialog: { padding: 18, backgroundColor: '#1A201A', borderRadius: 17, borderWidth: 1, borderColor: '#303A30' },
  dialogTitle: { color: '#F4F6EF', fontFamily: 'Michroma', fontSize: 12 },
  dialogBody: { color: '#A9B5A0', fontFamily: 'Manrope', fontSize: 10, lineHeight: 15, marginTop: 8 },
  dialogInput: { height: 45, borderRadius: 11, backgroundColor: '#101311', borderWidth: 1, borderColor: '#303A30', paddingHorizontal: 11, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 11, marginTop: 15 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 14 },
  dialogCancel: { minWidth: 75, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  dialogCancelText: { color: '#A9B5A0', fontFamily: 'Manrope-Bold', fontSize: 8 },
  dialogSubmit: { minWidth: 85, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: LIME },
  dialogSubmitText: { color: '#101311', fontFamily: 'Manrope-Bold', fontSize: 8 },
});
