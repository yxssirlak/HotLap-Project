import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Mock data voor de community feed
const FEED_POSTS = [
  {
    id: '1',
    userName: 'Nabil Chebbane',
    userInitials: 'NC',
    timeAgo: '2 hours ago',
    vehicle: 'Audi A3 e-tron',
    routeTitle: 'Rotterdam Harbor Sprint',
    description: 'Empty roads, perfect weather. The e-tron handled the corners beautifully tonight. 🔋💨',
    stats: { distance: '45.2 km', duration: '42m' },
    categoryColor: '#1689EF', // Coastal/Water blue
    likes: 24,
    comments: 3,
    hasLiked: true,
  },
  {
    id: '2',
    userName: 'Mitchell Van der Berg',
    userInitials: 'MB',
    timeAgo: '5 hours ago',
    vehicle: 'Porsche 911 GT3',
    routeTitle: 'Zandvoort Circuit - Track Day',
    description: 'Pushed the new tires to the limit. Incredible grip in sector 2!',
    stats: { distance: '12.4 km', duration: '18m' },
    categoryColor: '#DE55C4', // Special/Urban
    likes: 112,
    comments: 18,
    hasLiked: false,
  },
  {
    id: '3',
    userName: 'Alicia Jansen',
    userInitials: 'AJ',
    timeAgo: 'Yesterday',
    vehicle: 'BMW M2 Competition',
    routeTitle: 'Veluwe Forest Run',
    description: 'Crisp morning air and a very twisty route through the trees. Highly recommend this segment.',
    stats: { distance: '85.6 km', duration: '1h 15m' },
    categoryColor: '#268852', // Forest green
    likes: 45,
    comments: 6,
    hasLiked: false,
  },
];

export default function CommunityScreen() {
  const [feed, setFeed] = useState(FEED_POSTS);

  const toggleLike = (id: string) => {
    setFeed(feed.map(post => {
      if (post.id === id) {
        return { 
          ...post, 
          hasLiked: !post.hasLiked, 
          likes: post.hasLiked ? post.likes - 1 : post.likes + 1 
        };
      }
      return post;
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search" size={24} color="#F4F6EF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="person-add-outline" size={24} color="#F4F6EF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity style={[styles.filterBadge, styles.filterBadgeActive]}>
            <Text style={[styles.filterText, styles.filterTextActive]}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBadge}>
            <Text style={styles.filterText}>Local Discover</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBadge}>
            <Text style={styles.filterText}>Clubs</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Feed */}
      <ScrollView style={styles.feedContainer} showsVerticalScrollIndicator={false}>
        {feed.map((post) => (
          <View key={post.id} style={styles.postCard}>
            
            {/* Post Header */}
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{post.userInitials}</Text>
              </View>
              <View style={styles.postHeaderInfo}>
                <Text style={styles.userName}>{post.userName}</Text>
                <Text style={styles.timeText}>{post.timeAgo}</Text>
              </View>
              <TouchableOpacity style={styles.optionsBtn}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#A9B5A0" />
              </TouchableOpacity>
            </View>

            {/* Vehicle Badge */}
            <View style={styles.vehicleBadge}>
              <Ionicons name="car-sport" size={14} color="#A9B5A0" />
              <Text style={styles.vehicleText}>{post.vehicle}</Text>
            </View>

            {/* Content */}
            <View style={styles.postContent}>
              <Text style={styles.routeTitle}>{post.routeTitle}</Text>
              <Text style={styles.description}>{post.description}</Text>
            </View>

            {/* Map Placeholder / Media */}
            <View style={[styles.mediaContainer, { borderColor: post.categoryColor }]}>
              {/* In een echte app komt hier een MapView of een gemaakte foto */}
              <MaterialCommunityIcons name="map-marker-path" size={48} color={post.categoryColor} style={{ opacity: 0.5 }} />
              <View style={styles.mediaOverlay}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{post.stats.distance}</Text>
                  <Text style={styles.statLabel}>DISTANCE</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{post.stats.duration}</Text>
                  <Text style={styles.statLabel}>TIME</Text>
                </View>
              </View>
            </View>

            {/* Action Bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={() => toggleLike(post.id)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={post.hasLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={post.hasLiked ? "#C2F044" : "#F4F6EF"} 
                />
                <Text style={[styles.actionText, post.hasLiked && { color: '#C2F044' }]}>
                  {post.likes}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                <Ionicons name="chatbubble-outline" size={22} color="#F4F6EF" />
                <Text style={styles.actionText}>{post.comments}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                <Ionicons name="paper-plane-outline" size={22} color="#F4F6EF" />
              </TouchableOpacity>
            </View>
            
          </View>
        ))}

        {/* Extra padding aan de onderkant zodat de Liquid Navbar niets blokkeert */}
        <View style={{ height: 120 }} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, marginBottom: 15 },
  headerTitle: { fontSize: 28, fontFamily: 'Syne', color: '#F4F6EF' },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 15, width: 40, height: 40, borderRadius: 20, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#303A30' },
  filterContainer: { marginBottom: 15 },
  filterScroll: { paddingHorizontal: 20 },
  filterBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#252C25', marginRight: 10, borderWidth: 1, borderColor: '#303A30' },
  filterBadgeActive: { backgroundColor: '#C2F044', borderColor: '#C2F044' },
  filterText: { fontFamily: 'Outfit', fontSize: 14, fontWeight: '700', color: '#A9B5A0' },
  filterTextActive: { color: '#101311' },
  feedContainer: { flex: 1, paddingHorizontal: 15 },
  postCard: { backgroundColor: '#252C25', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#303A30' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#303A30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontFamily: 'Syne', fontSize: 14, color: '#C2F044' },
  postHeaderInfo: { flex: 1 },
  userName: { fontFamily: 'Outfit', fontSize: 16, fontWeight: '800', color: '#F4F6EF' },
  timeText: { fontFamily: 'Outfit', fontSize: 12, fontWeight: '500', color: '#A9B5A0', marginTop: 2 },
  optionsBtn: { padding: 5 },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(169, 181, 160, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  vehicleText: { fontFamily: 'Outfit', fontSize: 12, fontWeight: '700', color: '#A9B5A0', marginLeft: 6 },
  postContent: { marginBottom: 15 },
  routeTitle: { fontFamily: 'Syne', fontSize: 18, color: '#F4F6EF', marginBottom: 8 },
  description: { fontFamily: 'Outfit', fontSize: 14, color: '#A9B5A0', lineHeight: 20 },
  mediaContainer: { height: 200, backgroundColor: '#101311', borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  mediaOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(16, 19, 17, 0.8)', paddingVertical: 12, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  statBox: { flex: 1 },
  statValue: { fontFamily: 'Syne', fontSize: 16, color: '#F4F6EF' },
  statLabel: { fontFamily: 'Outfit', fontSize: 10, fontWeight: '700', color: '#A9B5A0', marginTop: 4, letterSpacing: 0.5 },
  actionBar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#303A30', paddingTop: 15 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
  actionText: { fontFamily: 'Outfit', fontSize: 14, fontWeight: '700', color: '#F4F6EF', marginLeft: 6 },
});