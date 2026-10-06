import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';

export default function EditProfileScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile } = route.params;

    const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null); 

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload a profile picture!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  }

    async function handleSave() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Opmerking: Voor een werkende productie-app moet de lokale avatarUrl (file uri) eerst 
      // naar een Supabase Storage bucket geüpload worden, en moet je die public URL opslaan.
      const { error } = await supabase
        .from('profiles')
        .update({ bio: bio, avatar_url: avatarUrl }) 
        .eq('id', user.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        // Ga soepel terug naar het vorige scherm
        navigation.goBack();
      }
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      
      {/* HEADER MET DE NIEUWE TERUG-KNOP */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#101311" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} /> {/* Spacer om titel in het midden te houden */}
      </View>

      <Animated.ScrollView 
        entering={FadeInRight.duration(400)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        
                {/* PROFILE PICTURE EDITOR */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.avatarSection}>
          <Pressable style={styles.avatarWrapper} onPress={pickImage}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0) || 'D'}</Text>
              </View>
            )}
            
            {/* Camera Overlay Knop */}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={20} color="#101311" />
            </View>
          </Pressable>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </Animated.View>

        {/* BIO EDITOR */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>Bio / Description</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="Tell the crew about yourself and your builds..."
              placeholderTextColor="#5A6550"
              value={bio}
              onChangeText={setBio}
              multiline={true}
              maxLength={150}
              keyboardAppearance="dark"
            />
          </View>
          <Text style={styles.charCount}>{bio.length}/150</Text>
        </Animated.View>

      </Animated.ScrollView>

      {/* SAVE BUTTON */}
      <Animated.View entering={FadeInDown.duration(500).delay(300)} style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#101311" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>
      </Animated.View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' }, // Obsidian achtergrond
  
  // Header & Nieuwe Terugknop
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, paddingBottom: 20 },
  backButton: { 
    width: 40, height: 40, 
    borderRadius: 20, 
    backgroundColor: '#C2F044', // Acid Lime[cite: 20]
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#C2F044', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4
  },
  headerTitle: { fontFamily: 'Michroma', fontSize: 18, color: '#F4F6EF' },
  
  content: { paddingHorizontal: 30, paddingTop: 20 },

  // Avatar sectie
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarWrapper: {
    width: 120, height: 120, 
    borderRadius: 60, 
    borderWidth: 2, borderColor: '#303A30', 
    backgroundColor: '#252C25',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative'
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 60 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontFamily: 'Michroma', fontSize: 40, color: '#F4F6EF' },
  
  cameraButton: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#C2F044',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#101311'
  },
  changePhotoText: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', marginTop: 16 },

  // Bio input sectie
  inputSection: { marginBottom: 30 },
  inputLabel: { fontFamily: 'Manrope', fontSize: 14, color: '#F4F6EF', fontWeight: '600', marginBottom: 8 },
  inputContainer: { 
    backgroundColor: '#252C25', // Charcoal green[cite: 20]
    borderRadius: 12, 
    borderWidth: 1, borderColor: '#303A30', 
    padding: 15, 
    height: 120 
  },
  textArea: { flex: 1, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 16, textAlignVertical: 'top' },
  charCount: { fontFamily: 'Manrope', fontSize: 12, color: '#5A6550', textAlign: 'right', marginTop: 8 },

  // Footer & Save knop
  footer: { paddingHorizontal: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#252C25' },
  saveButton: { 
    backgroundColor: '#C2F044', 
    height: 55, 
    borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#C2F044', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  saveButtonText: { color: '#101311', fontFamily: 'Manrope', fontWeight: '800', fontSize: 16 }
});