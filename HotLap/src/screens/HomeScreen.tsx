import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LiveTelemetryGForce from '../components/LiveTelemetryGForce';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'created' | 'explore'>('created');

  const mySegments = [
    { id: 1, name: 'Coastal Escape', location: 'Big Sur, CA', bestTime: '1:45.20', distance: '3.2', unit: 'km', color: '#1689EF' },
    { id: 2, name: 'Mountain Pass Rally', location: 'Alps, CH', bestTime: '4:12.05', distance: '8.5', unit: 'km', color: '#9062DB' },
  ];

  const exploreSegments = [
    { id: 1, name: 'Forest Run', location: 'Black Forest, DE', bestTime: '0:35.42', distance: '1.2', unit: 'km', color: '#268852' },
    { id: 2, name: 'Outback Adventure', location: 'Alice Springs, AU', bestTime: '7:55.89', distance: '20.8', unit: 'km', color: '#E77938' },
  ];

  const renderSegments = () => {
    const data = activeTab === 'created' ? mySegments : exploreSegments;

    if (data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No segments found.</Text>
        </View>
      );
    }

    return data.map((item) => (
      <TouchableOpacity key={`${activeTab}-${item.id}`} style={styles.card} activeOpacity={0.8}>
        <View style={[styles.mapPlaceholder, { borderColor: item.color }]}>
           <MaterialCommunityIcons name="map-marker-path" size={28} color={item.color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.routeText}>{item.name}</Text>
          <Text style={styles.locationText}>{item.location}</Text>
          <View style={styles.bestTimeRow}>
            <Ionicons name="timer-outline" size={14} color="#A9B5A0" />
            <Text style={styles.bestTimeText}>PR: {item.bestTime}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceValue}>{item.distance}</Text>
            <Text style={styles.distanceUnit}>{item.unit}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#A9B5A0" />
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.greetingText}>Drive. Explore. Connect.</Text>
          <View style={styles.activeVehicleRow}>
            <Ionicons name="car-sport" size={14} color="#C2F044" />
            <Text style={styles.activeVehicleText}>Audi A3 e-tron</Text>
          </View>
        </View>
        <TouchableOpacity 
  style={styles.notificationBtn} 
  activeOpacity={0.7}
  onPress={() => supabase.auth.signOut()}
>
  <Ionicons name="log-out-outline" size={24} color="#F4F6EF" />
</TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionWrapper}>
          <LiveTelemetryGForce />
        </View>

        <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.8}>
          <View style={styles.createActionContent}>
            <Ionicons name="add-circle" size={28} color="#101311" />
            <Text style={styles.createActionText}>Record a Drive</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(16, 19, 17, 0.5)" />
        </TouchableOpacity>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'created' && styles.tabButtonActive]}
            onPress={() => setActiveTab('created')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
              My Routes
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'explore' && styles.tabButtonActive]}
            onPress={() => setActiveTab('explore')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
              Explore
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {renderSegments()}
        </View>
        
        <View style={{ height: 120 }} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 15, marginBottom: 20 },
  headerTitle: { fontSize: 32, fontFamily: 'ChakraPetch', color: '#F4F6EF', letterSpacing: 0.5 },
  greetingText: { fontSize: 16, fontFamily: 'Inter', color: '#A9B5A0', marginTop: 4 },
  activeVehicleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#252C25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  activeVehicleText: { color: '#C2F044', fontFamily: 'Inter', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#303A30', marginTop: 4 },
  notificationDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#C2F044' },
  scrollContent: { flex: 1 },
  sectionWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  createActionBtn: { backgroundColor: '#C2F044', marginHorizontal: 20, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, shadowColor: '#C2F044', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  createActionContent: { flexDirection: 'row', alignItems: 'center' },
  createActionText: { color: '#101311', fontFamily: 'Inter', fontSize: 18, fontWeight: '800', marginLeft: 12 },
  tabsContainer: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#252C25', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#303A30' },
  tabText: { color: '#A9B5A0', fontFamily: 'Inter', fontSize: 15, fontWeight: '700' },
  tabTextActive: { color: '#C2F044' },
  listContainer: { paddingHorizontal: 20 },
  card: { flexDirection: 'row', backgroundColor: '#252C25', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center' },
  mapPlaceholder: { width: 65, height: 65, backgroundColor: '#101311', borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardContent: { flex: 1, justifyContent: 'center' },
  routeText: { color: '#F4F6EF', fontFamily: 'Inter', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  locationText: { color: '#A9B5A0', fontFamily: 'Inter', fontSize: 13, marginBottom: 8 },
  bestTimeRow: { flexDirection: 'row', alignItems: 'center' },
  bestTimeText: { color: '#A9B5A0', fontFamily: 'Inter', fontSize: 13, marginLeft: 4, fontWeight: '600' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
  distanceContainer: { alignItems: 'center', marginBottom: 8 },
  distanceValue: { color: '#F4F6EF', fontFamily: 'ChakraPetch', fontSize: 18 },
  distanceUnit: { color: '#A9B5A0', fontFamily: 'Inter', fontSize: 12 },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyStateText: { color: '#A9B5A0', fontFamily: 'Inter', fontSize: 15 },
});