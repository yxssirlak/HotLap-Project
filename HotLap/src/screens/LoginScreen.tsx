import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TextInput, Alert, ActivityIndicator, 
  Pressable, Dimensions, KeyboardAvoidingView, Platform,
  ScrollView, Keyboard 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps,
  withSpring, 
  withTiming,
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedPath = Animated.createAnimatedComponent(Path);

const AnimatedButton = ({ onPress, title, loading = false }: any) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  const tapCoords = useRef({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={(e) => {
          tapCoords.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
          opacity.value = withTiming(0.8, { duration: 100 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
          opacity.value = withTiming(1, { duration: 150 });
        }}
        onPress={() => onPress(tapCoords.current.x, tapCoords.current.y)}
        style={styles.primaryButton}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#101311" />
        ) : (
          <Text style={styles.primaryButtonText}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  
  const [pageState, setPageState] = useState<'login' | 'signup' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  const morphProgress = useSharedValue(0);
  
  const expandScale = useSharedValue(0);
  const expandOpacity = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const circleOriginX = useSharedValue(SCREEN_WIDTH / 2);
  const circleOriginY = useSharedValue(SCREEN_HEIGHT / 2);

  useEffect(() => {
    let target = 0;
    if (pageState === 'signup') target = 1;
    if (pageState === 'forgot') target = 2;

    morphProgress.value = withTiming(target, { 
      duration: 650, 
      easing: Easing.bezier(0.25, 1, 0.5, 1) 
    });
  }, [pageState]);

  const animatedSvgProps = useAnimatedProps(() => {
    const leftY = interpolate(morphProgress.value, [0, 1, 2], [30, 80, 50]);
    const rightY = interpolate(morphProgress.value, [0, 1, 2], [80, 30, 50]);
    const cp1X = interpolate(morphProgress.value, [0, 1, 2], [30, 70, 50]);
    const cp2X = interpolate(morphProgress.value, [0, 1, 2], [70, 30, 50]);

    return {
      d: `M 0 100 L 0 ${leftY} C ${cp1X} ${leftY}, ${cp2X} ${rightY}, 100 ${rightY} L 100 100 Z`
    };
  });

  const animatedSliderStyle = useAnimatedStyle(() => ({ 
    transform: [{ translateX: interpolate(morphProgress.value, [0, 1, 2], [0, -SCREEN_WIDTH, -SCREEN_WIDTH * 2]) }] 
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    top: circleOriginY.value - 10,
    left: circleOriginX.value - 10,
    opacity: expandOpacity.value,
    transform: [{ scale: expandScale.value }]
  }));
  
  const animatedMessageStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  const playSuccessAnimation = (message: string, tapX: number, tapY: number) => {
    Keyboard.dismiss();
    setSuccessMessage(message);
    
    circleOriginX.value = tapX;
    circleOriginY.value = tapY;

    expandScale.value = 0;
    expandOpacity.value = 1;
    messageOpacity.value = 0;

    expandScale.value = withTiming(150, { duration: 600, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    messageOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
  };

  async function handleLogin(tapX: number, tapY: number) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      Alert.alert('Login failed', error.message);
      setLoading(false);
    } else {
      playSuccessAnimation("Welcome back!", tapX, tapY);
    }
  }

  async function handleSignUp(tapX: number, tapY: number) {
    if (!username || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all details.');
      return;
    }
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({ 
      email, password, options: { data: { username: username } }
    });

    if (error) {
      Alert.alert('Registration failed', error.message);
      setLoading(false);
    } else if (data.session === null) {
      Alert.alert('Success!', 'Account created. Please verify your email.');
      setPageState('login');
      setLoading(false);
    } else {
      playSuccessAnimation("Account Created!", tapX, tapY);
    }
  }

  async function handlePasswordReset(tapX: number, tapY: number) {
    if (!email) {
      Alert.alert('Email required', 'Please enter your email to reset your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      playSuccessAnimation("Email Sent!", tapX, tapY);
      setTimeout(() => {
        expandOpacity.value = withTiming(0);
        messageOpacity.value = withTiming(0);
        setPageState('login');
      }, 2000);
    }
  }

  return (
    <View style={styles.rootContainer}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        <View style={[styles.splashContainer, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.splashTitle}>HOTLAP</Text>
          <Text style={styles.splashSubtitle}>All your routes in one place</Text>
        </View>

        <View style={styles.formWrapper}>
          <View style={styles.svgCurveContainer}>
            <Svg width={SCREEN_WIDTH} height={100} viewBox="0 0 100 100" preserveAspectRatio="none">
              <AnimatedPath animatedProps={animatedSvgProps} fill="#252C25" />
            </Svg>
          </View>

          <View style={styles.formContainerRoot}>
            <Animated.View style={[styles.sliderRow, animatedSliderStyle]}>
              
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Login</Text>
                <Text style={styles.formSubtitle}>Welcome back! Log in to continue.</Text>

                <Text style={styles.inputLabel}>Email</Text>
                <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                  <Ionicons name="mail-outline" size={20} color={emailFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={emailFocused ? "" : "Enter your email"}
                    placeholderTextColor="#5A6550"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    keyboardAppearance="dark"
                    textContentType="username"
                    autoComplete="email"
                  />
                </View>

                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
                  <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={passwordFocused ? "" : "Enter your password"}
                    placeholderTextColor="#5A6550"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    keyboardAppearance="dark"
                    textContentType="password"
                    autoComplete="password"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#A9B5A0" />
                  </Pressable>
                </View>

                <Pressable style={styles.forgotPasswordContainer} onPress={() => setPageState('forgot')}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>

                <AnimatedButton title="Login" onPress={handleLogin} loading={loading} />

                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>Don't have an account? </Text>
                  <Pressable onPress={() => setPageState('signup')}>
                    <Text style={styles.linkText}>Sign up</Text>
                  </Pressable>
                </View>
              </ScrollView>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Create Account</Text>
                <Text style={styles.formSubtitle}>Join the community today.</Text>

                <Text style={styles.inputLabel}>Username</Text>
                <View style={[styles.inputContainer, usernameFocused && styles.inputContainerFocused]}>
                  <Ionicons name="person-outline" size={20} color={usernameFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={usernameFocused ? "" : "Choose a display name"}
                    placeholderTextColor="#5A6550"
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    autoCapitalize="words"
                    keyboardAppearance="dark"
                    textContentType="username"
                  />
                </View>

                <Text style={styles.inputLabel}>Email</Text>
                <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                  <Ionicons name="mail-outline" size={20} color={emailFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={emailFocused ? "" : "Enter your email"}
                    placeholderTextColor="#5A6550"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    keyboardAppearance="dark"
                    textContentType="username"
                    autoComplete="email"
                  />
                </View>

                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
                  <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={passwordFocused ? "" : "Create a secure password"}
                    placeholderTextColor="#5A6550"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    keyboardAppearance="dark"
                    textContentType="newPassword"
                    autoComplete="new-password"
                  />
                </View>

                <AnimatedButton title="Create Account" onPress={handleSignUp} loading={loading} />

                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>Already have an account? </Text>
                  <Pressable onPress={() => setPageState('login')}>
                    <Text style={styles.linkText}>Log in</Text>
                  </Pressable>
                </View>
              </ScrollView>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>We'll send you a recovery link.</Text>

                <Text style={styles.inputLabel}>Email</Text>
                <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
                  <Ionicons name="mail-outline" size={20} color={emailFocused ? "#C2F044" : "#A9B5A0"} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={emailFocused ? "" : "Enter your email"}
                    placeholderTextColor="#5A6550"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    keyboardAppearance="dark"
                    textContentType="username"
                    autoComplete="email"
                  />
                </View>

                <View style={{ marginTop: 20 }}>
                  <AnimatedButton title="Send Link" onPress={handlePasswordReset} loading={loading} />
                </View>

                <View style={styles.switchContainer}>
                  <Pressable onPress={() => setPageState('login')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="arrow-back-outline" size={16} color="#C2F044" style={{ marginRight: 6 }} />
                    <Text style={styles.linkText}>Back to Login</Text>
                  </Pressable>
                </View>
              </ScrollView>

            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <View style={[StyleSheet.absoluteFill, { pointerEvents: successMessage ? 'auto' : 'none', zIndex: 9999, elevation: 9999 }]}>
        <Animated.View style={[styles.successCircleOverlay, animatedOverlayStyle]} />
        <Animated.View style={[styles.successMessageContainer, animatedMessageStyle]}>
          <Text style={styles.successMessageText}>{successMessage}</Text>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#101311' },
  container: { flex: 1, justifyContent: 'space-between' },
  
  splashContainer: { alignItems: 'center', width: '100%' },
  splashTitle: { fontFamily: 'Michroma', fontSize: 42, color: '#F4F6EF', letterSpacing: 2 },
  splashSubtitle: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', marginTop: 8 },
  
  formWrapper: { width: '100%', height: SCREEN_HEIGHT * 0.65 }, 
  svgCurveContainer: { position: 'absolute', top: -99, left: 0, right: 0 },
  formContainerRoot: { flex: 1, backgroundColor: '#252C25' },
  sliderRow: { flexDirection: 'row', width: SCREEN_WIDTH * 3, flex: 1 }, 
  
  page: { width: SCREEN_WIDTH, paddingHorizontal: 30, paddingTop: 40 },
  
  formTitle: { fontFamily: 'Michroma', fontSize: 28, color: '#F4F6EF', marginBottom: 8 },
  formSubtitle: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', marginBottom: 30 },
  inputLabel: { fontFamily: 'Manrope', fontSize: 14, color: '#F4F6EF', fontWeight: '600', marginBottom: 8 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101311', borderRadius: 12, borderWidth: 1, borderColor: '#303A30', marginBottom: 20, paddingHorizontal: 15, height: 55 },
  inputContainerFocused: { borderColor: '#C2F044' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 16, height: '100%' },
  eyeIcon: { padding: 5 },
  forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 30, marginTop: -5 },
  linkText: { fontFamily: 'Manrope', color: '#C2F044', fontSize: 14, fontWeight: '700' },
  
  primaryButton: { backgroundColor: '#C2F044', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#C2F044', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#101311', fontFamily: 'Manrope', fontWeight: '800', fontSize: 16 },
  switchContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30, paddingBottom: 20 },
  switchText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 14 },

  successCircleOverlay: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#C2F044', 
  },
  successMessageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successMessageText: {
    fontFamily: 'Michroma',
    fontSize: 26,
    color: '#101311',
    letterSpacing: 0.5,
  }
});