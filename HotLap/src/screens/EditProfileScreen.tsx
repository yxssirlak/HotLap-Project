import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((base64.length * 3) / 4) - padding);
  let byteIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(base64[index]);
    const second = BASE64_ALPHABET.indexOf(base64[index + 1]);
    const third = BASE64_ALPHABET.indexOf(base64[index + 2]);
    const fourth = BASE64_ALPHABET.indexOf(base64[index + 3]);
    const block = (first << 18) | (second << 12) | ((third & 63) << 6) | (fourth & 63);

    if (byteIndex < bytes.length) bytes[byteIndex++] = (block >> 16) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (block >> 8) & 255;
    if (byteIndex < bytes.length) bytes[byteIndex++] = block & 255;
  }

  return bytes.buffer;
}

type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfileScreen'>;

export default function EditProfileScreen({ route, navigation }: EditProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const profile = route.params?.profile;
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [carBrand, setCarBrand] = useState(profile?.car_brand || '');
  const [carModel, setCarModel] = useState(profile?.car_model || '');
  const [carYear, setCarYear] = useState(profile?.car_year?.toString() || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarMimeType, setAvatarMimeType] = useState('image/jpeg');

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow HotLap to access your photos to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.base64) {
          Alert.alert('Could not load photo', 'Please choose another image and try again.');
          return;
        }
        setAvatarUrl(asset.uri);
        setAvatarBase64(asset.base64);
        setAvatarMimeType(asset.mimeType || 'image/jpeg');
      }
    } catch (error) {
      Alert.alert('Photo unavailable', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSave() {
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanName) {
      Alert.alert('Name required', 'Please enter the name shown on your profile.');
      return;
    }
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(cleanUsername)) {
      Alert.alert('Invalid username', 'Use 3–24 letters, numbers, underscores, or periods.');
      return;
    }
    if (carYear && !/^(19|20)\d{2}$/.test(carYear.trim())) {
      Alert.alert('Invalid car year', 'Enter a four-digit year, for example 2020.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Your session has expired. Please sign in again.');

      let savedAvatarUrl = avatarUrl;
      if (avatarBase64) {
        setPhotoLoading(true);
        const extension = avatarMimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const objectPath = `${user.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(objectPath, base64ToArrayBuffer(avatarBase64), {
            contentType: avatarMimeType,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
        savedAvatarUrl = data.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          username: cleanUsername,
          bio: bio.trim(),
          avatar_url: savedAvatarUrl,
          car_brand: carBrand.trim(),
          car_model: carModel.trim(),
          car_year: carYear.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPhotoLoading(false);
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color="#101311" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        entering={FadeInRight.duration(400)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.avatarSection}>
          <Pressable
            style={styles.avatarWrapper}
            onPress={pickImage}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Choose profile photo"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{fullName.charAt(0).toUpperCase() || 'D'}</Text>
              </View>
            )}
            <View style={styles.cameraButton}>
              {photoLoading
                ? <ActivityIndicator size="small" color="#101311" />
                : <Ionicons name="camera" size={19} color="#101311" />}
            </View>
          </Pressable>
          <Text style={styles.changePhotoText}>Tap to choose a profile photo</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(140)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#687263"
            value={fullName}
            onChangeText={setFullName}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(180)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>Driver handle</Text>
          <TextInput
            style={styles.input}
            placeholder="your_handle"
            placeholderTextColor="#687263"
            value={username}
            onChangeText={setUsername}
            maxLength={24}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={styles.helperText}>This is how other drivers find and share your profile.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(220)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>Driver bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell the crew about yourself, your builds and your favorite roads..."
            placeholderTextColor="#687263"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(260)} style={styles.carSection}>
          <Text style={styles.carSectionTitle}>YOUR GARAGE</Text>
          <Text style={styles.carSectionHint}>Add your main car to your HotLap profile.</Text>
          <View style={styles.carInputRow}>
            <TextInput
              style={[styles.input, styles.carYearInput]}
              placeholder="Year"
              placeholderTextColor="#687263"
              value={carYear}
              onChangeText={setCarYear}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TextInput
              style={[styles.input, styles.carMakeInput]}
              placeholder="Make"
              placeholderTextColor="#687263"
              value={carBrand}
              onChangeText={setCarBrand}
              maxLength={40}
              autoCapitalize="words"
            />
          </View>
          <TextInput
            style={[styles.input, styles.carModelInput]}
            placeholder="Model or build"
            placeholderTextColor="#687263"
            value={carModel}
            onChangeText={setCarModel}
            maxLength={60}
            autoCapitalize="words"
          />
        </Animated.View>
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <Pressable style={[styles.saveButton, loading && styles.disabledButton]} onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#101311" />
            : <Text style={styles.saveButtonText}>Save profile</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C2F044', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Michroma', fontSize: 17, color: '#F4F6EF' },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { width: 116, height: 116, borderRadius: 58, borderWidth: 2, borderColor: '#C2F044', backgroundColor: '#252C25', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 58 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 58, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontFamily: 'Michroma', fontSize: 38, color: '#F4F6EF' },
  cameraButton: { position: 'absolute', bottom: -2, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#C2F044', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#101311' },
  changePhotoText: { fontFamily: 'Manrope', fontSize: 13, color: '#A9B5A0', marginTop: 12 },
  inputSection: { marginBottom: 22 },
  inputLabel: { fontFamily: 'Manrope-Bold', fontSize: 13, color: '#F4F6EF', marginBottom: 8 },
  input: { minHeight: 52, backgroundColor: '#252C25', borderRadius: 12, borderWidth: 1, borderColor: '#303A30', paddingHorizontal: 15, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 15 },
  textArea: { minHeight: 120, paddingTop: 14, paddingBottom: 14 },
  helperText: { fontFamily: 'Manrope', fontSize: 11, color: '#879181', marginTop: 7 },
  charCount: { fontFamily: 'Manrope', fontSize: 11, color: '#879181', textAlign: 'right', marginTop: 7 },
  carSection: { marginBottom: 24, padding: 15, borderRadius: 14, backgroundColor: '#1A201A', borderWidth: 1, borderColor: '#303A30' },
  carSectionTitle: { fontFamily: 'Manrope-Bold', fontSize: 12, color: '#F4F6EF', letterSpacing: 1 },
  carSectionHint: { fontFamily: 'Manrope', fontSize: 11, color: '#879181', marginTop: 5, marginBottom: 13 },
  carInputRow: { flexDirection: 'row', gap: 9 },
  carYearInput: { width: 86 },
  carMakeInput: { flex: 1 },
  carModelInput: { marginTop: 9 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#252C25' },
  saveButton: { backgroundColor: '#C2F044', height: 54, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: '#101311', fontFamily: 'Manrope-Bold', fontSize: 15 },
});
