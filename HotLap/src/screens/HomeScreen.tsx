import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LiveTelemetryGForce from '../components/LiveTelemetryGForce';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'created' | 'explore'>('created');

  const mySegments = [
    { id: 1, name: 'Rotterdam Harbor Sprint', location: 'Rotterdam, NL', bestTime: '1:45.20', distance: '3.2', unit: 'km' },
    { id: 2, name: 'A13 Highway Run', location: 'South Holland, NL', bestTime: '4:12.05', distance: '8.5', unit: 'km' },
  ];

  const exploreSegments = [
    { id: 1, name: 'Zandvoort Circuit - Sector 1', location: 'Zandvoort, NL', bestTime: '0:35.42', distance: '1.2', unit: 'km' },
    { id: 2, name: 'Nürburgring Nordschleife', location: 'Nürburg, DE', bestTime: '7:55.89', distance: '20.8', unit: 'km' },
  ];

  const renderSegments = () => {
    const data = activeTab === 'created' ? mySegments : exploreSegments;
    const iconColor = activeTab === 'created' ? '#3B82F6' : '#7B61FF';

    if (data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No segments found.</Text>
        </View>
      );
    }

    return data.map((item) => (
      <TouchableOpacity key={`${activeTab}-${item.id}`} style={styles.card} activeOpacity={0.8}>
        <View style={[styles.mapPlaceholder, { borderColor: iconColor }]}>
           <MaterialCommunityIcons name="map-marker-path" size={28} color={iconColor} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.routeText}>{item.name}</Text>
          <Text style={styles.locationText}>{item.location}</Text>
          <View style={styles.bestTimeRow}>
            <Ionicons name="timer-outline" size={14} color="#8E8E93" />
            <Text style={styles.bestTimeText}>PR: {item.bestTime}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceValue}>{item.distance}</Text>
            <Text style={styles.distanceUnit}>{item.unit}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Home</Text>
          <Text style={styles.greetingText}>Welcome back, Nabil 👋</Text>
          <View style={styles.activeVehicleRow}>
            <Ionicons name="car-sport" size={14} color="#3B82F6" />
            <Text style={styles.activeVehicleText}>Audi A3 e-tron</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={24} color="#FFF" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionWrapper}>
          <LiveTelemetryGForce />
        </View>

        <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.8}>
          <View style={styles.createActionContent}>
            <Ionicons name="add-circle" size={28} color="#FFF" />
            <Text style={styles.createActionText}>Create New Segment</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'created' && styles.tabButtonActive]}
            onPress={() => setActiveTab('created')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
              My Segments
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
        
        {/* Extra padding at the bottom so the LiquidTabBar doesn't block the last item */}
        <View style={{ height: 120 }} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 15, marginBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  greetingText: { fontSize: 16, color: '#8E8E93', marginTop: 4 },
  activeVehicleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  activeVehicleText: { color: '#3B82F6', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#141420', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A3A', marginTop: 4 },
  notificationDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#A020F0' },
  scrollContent: { flex: 1 },
  sectionWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  createActionBtn: { backgroundColor: '#7B61FF', marginHorizontal: 20, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  createActionContent: { flexDirection: 'row', alignItems: 'center' },
  createActionText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 12 },
  tabsContainer: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#141420', borderRadius: 12, padding: 4, marginBottom: 15, borderWidth: 1, borderColor: '#2A2A3A' },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#2A2A3A' },
  tabText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  listContainer: { paddingHorizontal: 20 },
  card: { flexDirection: 'row', backgroundColor: '#141420', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1C1C28' },
  mapPlaceholder: { width: 65, height: 65, backgroundColor: '#0F0F16', borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardContent: { flex: 1, justifyContent: 'center' },
  routeText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  locationText: { color: '#8E8E93', fontSize: 13, marginBottom: 8 },
  bestTimeRow: { flexDirection: 'row', alignItems: 'center' },
  bestTimeText: { color: '#A0A0B0', fontSize: 13, marginLeft: 4, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
  distanceContainer: { alignItems: 'center', marginBottom: 8 },
  distanceValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  distanceUnit: { color: '#8E8E93', fontSize: 12 },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyStateText: { color: '#8E8E93', fontSize: 15 },
});