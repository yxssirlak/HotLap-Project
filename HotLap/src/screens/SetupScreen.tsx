import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TextInput, Alert, ActivityIndicator, 
  Pressable, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  Modal, FlatList
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps, // <-- Voeg deze toe
  withTiming, 
  Easing 
} from 'react-native-reanimated';

// FIX: SCREEN_HEIGHT toegevoegd
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Vaste, schone lijst voor merken en jaren voor de beste UX
const CAR_DATA = {
  brands: [
    'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti', 'Cadillac', 
    'Chevrolet', 'Chrysler', 'Citroën', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Honda', 
    'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Maserati', 
    'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 
    'Porsche', 'Renault', 'Rolls-Royce', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
  ].sort(),
  years: Array.from({length: 40}, (_, i) => (2026 - i).toString())
};

export default function SetupScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { email, password, username } = route.params;
  
  const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'brand' | 'model' | 'year' | null>(null);

  // API State voor modellen
  const [apiModels, setApiModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 1. We starten keihard op 20% (0.2) voor die psychologische voorsprong
  const progress = useSharedValue(0.2); 

  useEffect(() => {
    // Pagina 1 = 20%, Pagina 2 = 60%, Pagina 3 = 100%
    let targetProgress = 0.2;
    if (step === 2) targetProgress = 0.6;
    if (step === 3) targetProgress = 1.0;

    progress.value = withTiming(targetProgress, { 
      duration: 1000, // Iets langzamer (1 seconde) zodat je de teller echt ziet optellen (21..22..23)
      easing: Easing.bezier(0.25, 1, 0.5, 1) 
    });
  }, [step]);

  // Deze hook zorgt voor de live counter-animatie van de text
  const animatedTextProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(progress.value * 100)}%`,
      defaultValue: `${Math.round(progress.value * 100)}%`,
    } as any;
  });

  // --- API KOPPELING NHTSA ---
  useEffect(() => {
    if (carBrand) {
      fetchModelsFromAPI(carBrand);
    }
  }, [carBrand]);

  async function fetchModelsFromAPI(brand: string) {
    setModelsLoading(true);
    setApiModels([]); // Clear oude lijst
    try {
      // Haal live alle modellen van dit merk op via de officiële Vehicle API
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${brand}?format=json`);
      const data = await response.json();
      
      // Filter en sorteer de unieke modellen uit de API data
      if (data && data.Results) {
        const models = data.Results.map((item: any) => item.Model_Name);
        const uniqueModels = [...new Set(models)].sort() as string[];
        setApiModels(uniqueModels);
      }
    } catch (error) {
      console.error("API Error:", error);
      Alert.alert("API Error", "Could not load car models.");
    } finally {
      setModelsLoading(false);
    }
  }

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const animatedCarStyle = useAnimatedStyle(() => {
    const barWidth = SCREEN_WIDTH - 60; 
    return { transform: [{ translateX: progress.value * barWidth - 15 }] };
  });
  
  // Beweegt het percentage precies met de auto mee
  const animatedPercentageStyle = useAnimatedStyle(() => {
    const barWidth = SCREEN_WIDTH - 60; 
    return { 
      transform: [{ translateX: progress.value * barWidth - 12 }],
      opacity: progress.value >= 0.99 ? withTiming(0, { duration: 300 }) : 1
    };
  });

  // Laat de auto en vlag iconen verdwijnen bij de finish
  const animatedIconsStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= 0.99 ? withTiming(0, { duration: 300 }) : withTiming(1),
    transform: [{ scale: progress.value >= 0.99 ? withTiming(1.3, { duration: 300 }) : 1 }]
  }));

  async function finalizeAccount() {
    if (!carBrand || !carModel || !carYear) {
      Alert.alert("Missing details", "Please select your complete vehicle setup.");
      setStep(2);
      return;
    }

    setLoading(true);

    const { error: signUpError, data } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { username: username } }
    });

    if (signUpError) {
      console.log("SUPABASE SIGNUP ERROR:", signUpError); // <-- Voeg deze toe
      Alert.alert('Registration failed', signUpError.message);
      setStep(2);
      setLoading(false);
      return;
    }

    if (data.user) {
      // 2. Sla al je gegevens direct op in de 'profiles' tabel (volgens jouw schema)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          car_brand: carBrand,
          car_model: carModel,
          car_year: carYear
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.log("Profile update error:", updateError.message);
        Alert.alert("Setup error", updateError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    // Zodra dit klaar is, pakt App.tsx de sessie op en navigeert de app automatisch naar je hoofdscherm!
  }

  const getModalOptions = () => {
    if (modalType === 'brand') return CAR_DATA.brands;
    if (modalType === 'model') return apiModels;
    if (modalType === 'year') return CAR_DATA.years;
    return [];
  };

  const openSelection = (type: 'brand' | 'model' | 'year') => {
    if (type === 'model' && !carBrand) {
      Alert.alert("Select Brand First", "Please select a brand before choosing a model.");
      return;
    }
    setModalType(type);
    setModalVisible(true);
  };

  const selectOption = (item: string) => {
    if (modalType === 'brand' && carBrand !== item) {
      setCarBrand(item);
      setCarModel(''); // Reset model als je van merk wisselt
    }
    if (modalType === 'model') setCarModel(item);
    if (modalType === 'year') setCarYear(item);
    
    setModalVisible(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#F4F6EF" />
        </Pressable>
        <Text style={styles.title}>Account Setup</Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressTrack} />
        <Animated.View style={[styles.progressFill, animatedProgressStyle]} />
        
        {/* Vlag en auto iconen met fade-out animatie bij finish */}
        <Animated.View style={[styles.flagContainer, animatedIconsStyle]}>
          <Ionicons name="flag" size={18} color="#A9B5A0" />
        </Animated.View>
        <Animated.View style={[styles.carContainer, animatedIconsStyle]}>
          <Ionicons name="car-sport" size={24} color="#C2F044" />
        </Animated.View>

        {/* Live percentage onder de auto */}
        <Animated.View style={[styles.percentageWrapper, animatedPercentageStyle]}>
          <AnimatedTextInput 
            editable={false} 
            animatedProps={animatedTextProps} 
            style={styles.percentageText} 
          />
        </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            <Text style={styles.stepSubtitle}>How should we call you on the track?</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#A9B5A0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#5A6550"
                value={fullName}
                onChangeText={setFullName}
                keyboardAppearance="dark"
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={() => setStep(2)}>
              <Text style={styles.primaryButtonText}>Next Step</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Ride</Text>
            <Text style={styles.stepSubtitle}>Select your vehicle setup.</Text>

            <Text style={styles.inputLabel}>Brand</Text>
            <Pressable style={styles.dropdownContainer} onPress={() => openSelection('brand')}>
              <Text style={[styles.dropdownText, !carBrand && styles.dropdownPlaceholder]}>
                {carBrand || "Select Brand (e.g. Audi)"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#A9B5A0" />
            </Pressable>

            <Text style={styles.inputLabel}>Model</Text>
            <Pressable style={styles.dropdownContainer} onPress={() => openSelection('model')}>
              <Text style={[styles.dropdownText, !carModel && styles.dropdownPlaceholder]}>
                {carModel || "Select Model (e.g. A3)"}
              </Text>
              {modelsLoading ? (
                <ActivityIndicator size="small" color="#C2F044" />
              ) : (
                <Ionicons name="chevron-down" size={20} color="#A9B5A0" />
              )}
            </Pressable>

            <Text style={styles.inputLabel}>Year</Text>
            <Pressable style={styles.dropdownContainer} onPress={() => openSelection('year')}>
              <Text style={[styles.dropdownText, !carYear && styles.dropdownPlaceholder]}>
                {carYear || "Select Year (e.g. 2016)"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#A9B5A0" />
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={() => { setStep(3); finalizeAccount(); }}>
              {loading ? <ActivityIndicator color="#101311" /> : <Text style={styles.primaryButtonText}>Finish Setup</Text>}
            </Pressable>
            
            <Pressable style={styles.secondaryButton} onPress={() => setStep(1)}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Starting engines...</Text>
            <Text style={styles.stepSubtitle}>Preparing your HOTLAP account.</Text>
            <ActivityIndicator size="large" color="#C2F044" style={{ marginTop: 40 }} />
          </View>
        )}
      </ScrollView>

      {/* --- MODAL --- */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {modalType}</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#F4F6EF" />
              </Pressable>
            </View>
            <FlatList
              data={getModalOptions()}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable style={styles.modalOption} onPress={() => selectOption(item)}>
                  <Text style={styles.modalOptionText}>{item}</Text>
                  {((modalType === 'brand' && carBrand === item) ||
                    (modalType === 'model' && carModel === item) ||
                    (modalType === 'year' && carYear === item)) && (
                    <Ionicons name="checkmark" size={20} color="#C2F044" />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#A9B5A0', fontFamily: 'Manrope' }}>No options found.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101311' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, marginBottom: 40 },
  backButton: { marginRight: 20 },
  title: { fontFamily: 'Michroma', fontSize: 20, color: '#F4F6EF' },
  
  progressBarContainer: { height: 30, marginHorizontal: 30, marginBottom: 20, justifyContent: 'center' },
  progressTrack: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#303A30', borderRadius: 2 },
  progressFill: { position: 'absolute', left: 0, height: 4, backgroundColor: '#C2F044', borderRadius: 2, shadowColor: '#C2F044', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
  flagContainer: { position: 'absolute', right: -5, top: -5 },
  carContainer: { position: 'absolute', top: -10 },
  percentageWrapper: {
    position: 'absolute',
    top: 22,
    alignItems: 'center',
  },
  percentageText: {
    fontFamily: 'Michroma',
    fontSize: 10,
    color: '#C2F044',
  },

  formContent: { paddingHorizontal: 30, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  stepTitle: { fontFamily: 'Michroma', fontSize: 24, color: '#F4F6EF', marginBottom: 8 },
  stepSubtitle: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', marginBottom: 30 },
  
  inputLabel: { fontFamily: 'Manrope', fontSize: 14, color: '#F4F6EF', fontWeight: '600', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101311', borderRadius: 12, borderWidth: 1, borderColor: '#303A30', marginBottom: 20, paddingHorizontal: 15, height: 55 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 16, height: '100%' },
  
  dropdownContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101311', borderRadius: 12, borderWidth: 1, borderColor: '#303A30', marginBottom: 20, paddingHorizontal: 15, height: 55 },
  dropdownText: { flex: 1, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 16 },
  dropdownPlaceholder: { color: '#5A6550' },

  primaryButton: { backgroundColor: '#C2F044', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#C2F044', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#101311', fontFamily: 'Manrope', fontWeight: '800', fontSize: 16 },
  
  secondaryButton: { height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#A9B5A0', fontFamily: 'Manrope', fontWeight: '700', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#252C25', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.6, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#303A30' },
  modalTitle: { fontFamily: 'Michroma', fontSize: 18, color: '#F4F6EF', textTransform: 'capitalize' },
  modalClose: { padding: 4 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#303A30' },
  modalOptionText: { fontFamily: 'Manrope', fontSize: 16, color: '#F4F6EF' }
});