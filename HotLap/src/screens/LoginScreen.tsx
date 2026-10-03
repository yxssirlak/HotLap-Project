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
  interpolate,
  withSequence
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPRING_CONFIG = { damping: 12, stiffness: 250, mass: 0.8 };

const GearButton = () => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }]
  }));

  return (
    <Animated.View style={[style, styles.gearContainer]}>
      <Pressable
        onPressIn={() => { 
          scale.value = withSpring(1.05, SPRING_CONFIG); 
          rotation.value = withSpring(45, SPRING_CONFIG); 
        }}
        onPressOut={() => { 
          scale.value = withSpring(1, SPRING_CONFIG); 
          rotation.value = withSpring(0, SPRING_CONFIG); 
        }}
      >
        <Ionicons name="settings-outline" size={24} color="#A9B5A0" />
      </Pressable>
    </Animated.View>
  );
};

const AnimatedButton = ({ onPress, title, loading = false }: any) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: scale.value < 1 ? 0 : -1 }],
    backgroundColor: loading ? withTiming('#252C25') : withTiming('#C2F044'),
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.primaryButtonWrapper, animatedStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, SPRING_CONFIG);
          glowOpacity.value = withTiming(0.6, { duration: 150 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING_CONFIG);
          glowOpacity.value = withTiming(0.3, { duration: 250 });
        }}
        onPress={onPress}
        style={styles.primaryButtonInner}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#C2F044" />
        ) : (
          <Text style={styles.primaryButtonText}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const SocialButton = ({ icon, color, onPress }: any) => {
  const scale = useSharedValue(1);
  const bg = useSharedValue('#101311');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: bg.value,
  }));

  return (
    <Animated.View style={[styles.socialCircle, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { 
          scale.value = withSpring(1.05, SPRING_CONFIG); 
          bg.value = withTiming('#252C25', { duration: 100 }); 
        }}
        onPressOut={() => { 
          scale.value = withSpring(1, SPRING_CONFIG); 
          bg.value = withTiming('#101311', { duration: 150 }); 
        }}
        style={styles.socialCircleInner}
      >
        <Ionicons name={icon} size={24} color={color} />
      </Pressable>
    </Animated.View>
  );
};

const AnimatedInputContainer = ({ focused, error, children }: any) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.02 : 1, SPRING_CONFIG);
    glow.value = withTiming(focused ? 1 : 0, { duration: 250, easing: Easing.out(Easing.ease) });
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.3,
    shadowColor: error ? '#FF4C4C' : '#C2F044',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    borderColor: error ? '#FF4C4C' : focused ? '#C2F044' : '#303A30',
  }));

  return (
    <Animated.View style={[styles.inputContainer, animStyle]}>
      {children}
    </Animated.View>
  );
};

const PasswordEye = ({ show, onPress, hasError }: any) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0, { duration: 100 }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.back(1.5)) })
    );
    onPress();
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={handlePress} style={styles.eyeIcon}>
      <Animated.View style={style}>
        <Ionicons 
          name={show ? "eye-outline" : "eye-off-outline"} 
          size={20} 
          color={hasError ? "#FF4C4C" : (show ? "#C2F044" : "#A9B5A0")} 
        />
      </Animated.View>
    </Pressable>
  );
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

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

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const morphProgress = useSharedValue(1);
  const expandScale = useSharedValue(0);
  const expandOpacity = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const circleOriginX = useSharedValue(SCREEN_WIDTH / 2);
  const circleOriginY = useSharedValue(SCREEN_HEIGHT / 2);

  const tabIndicatorPos = useSharedValue(0);

  useEffect(() => {
    setEmailError('');
    setPasswordError('');
    setUsernameError('');
    
    let target = 1;
    if (pageState === 'forgot') target = 0;
    if (pageState === 'signup') {
      target = 2;
      tabIndicatorPos.value = withTiming(1, { duration: 300, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    } else {
      tabIndicatorPos.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    }

    // Geen bounce, strakke schuif animatie
    morphProgress.value = withTiming(target, { 
      duration: 500, 
      easing: Easing.bezier(0.25, 1, 0.5, 1) 
    });
  }, [pageState]);

  const animatedSvgProps = useAnimatedProps(() => {
    const leftY = interpolate(morphProgress.value, [0, 1, 2], [50, 30, 80]);
    const rightY = interpolate(morphProgress.value, [0, 1, 2], [50, 80, 30]);
    const cp1X = interpolate(morphProgress.value, [0, 1, 2], [50, 30, 70]);
    const cp2X = interpolate(morphProgress.value, [0, 1, 2], [50, 70, 30]);
    return { d: `M 0 100 L 0 ${leftY} C ${cp1X} ${leftY}, ${cp2X} ${rightY}, 100 ${rightY} L 100 100 Z` };
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
  
  const animatedMessageStyle = useAnimatedStyle(() => ({ opacity: messageOpacity.value }));

  const tabIndicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (SCREEN_WIDTH - 60 - 8) / 2;
    return { transform: [{ translateX: tabIndicatorPos.value * tabWidth }] };
  });

  const playSuccessAnimation = (message: string, tapX: number = SCREEN_WIDTH / 2, tapY: number = SCREEN_HEIGHT / 2) => {
    Keyboard.dismiss();
    setSuccessMessage(message);
    
    circleOriginX.value = tapX;
    circleOriginY.value = tapY;

    expandScale.value = 0;
    expandOpacity.value = 1;
    messageOpacity.value = 0;

    // Veel langzamere, organische "Venom" groei (neemt langzaam het scherm over)
    expandScale.value = withTiming(220, { 
      duration: 1200, 
      easing: Easing.bezier(0.25, 1, 0.5, 1) 
    });
    
    // De tekst "HOTLAP" komt pas tevoorschijn als het scherm bijna vol is
    messageOpacity.value = withDelay(700, withTiming(1, { duration: 600 }));
  };
  async function handleLogin(tapX: number, tapY: number) {
    setEmailError('');
    setPasswordError('');
    
    if (!email || !password) {
      if (!email) setEmailError('Enter your email or username.');
      if (!password) setPasswordError('Enter your password.');
      return;
    }

    setLoading(true);
    let finalEmail = email;
    const isEmail = email.includes('@');

    // Als het geen e-mail is, zoeken we via onze RPC functie in auth.users
    if (!isEmail) {
      const { data: fetchedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', { 
        lookup_username: email 
      });

      if (rpcError || !fetchedEmail) {
        setLoading(false);
        setEmailError('Username is incorrect.');
        return;
      }
      finalEmail = fetchedEmail;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
    setLoading(false);

    if (error) {
      if (isEmail) {
        setEmailError('Email is incorrect.');
      } else {
        setPasswordError('Password is incorrect.');
      }
    } else {
      // 1. Start de trage Venom-animatie met "HOTLAP"
      playSuccessAnimation("HOTLAP", tapX, tapY);

      // 2. Laat het scherm langzaam weggaan (geef het 3 seconden de tijd om van het scherm te genieten)
      setTimeout(() => {
        // Laat eerst de tekst langzaam vervagen
        messageOpacity.value = withTiming(0, { duration: 500 }, () => {
          // Laat daarna pas de lime achtergrond langzaam wegkruipen
          expandScale.value = withTiming(0, { 
            duration: 1000, 
            easing: Easing.bezier(0.4, 0, 0.2, 1) 
          }, () => {
            expandOpacity.value = withTiming(0);
          });
        });
      }, 3000); 
    }
  }
  async function handleSignUp(tapX: number, tapY: number) {
    // 1. BLOKKEER DIRECT als de live-check al heeft gezien dat iets bezet is
    if (emailError === 'This email is already registered.' || usernameError === 'This username is already taken.') {
      return; // Stop de functie, gebruiker kan niet verder
    }

    setEmailError('');
    setPasswordError('');
    setUsernameError('');

    if (!username || !email || !password) {
      if (!username) setUsernameError('Enter your username.');
      if (!email) setEmailError('Enter your email address.');
      if (!password) setPasswordError('Enter your password.');
      return;
    }

    setLoading(true);

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    setLoading(false);

    if (existingUser) {
      setUsernameError('This username is already taken.');
      return;
    }
    
    // Bij succes naar het Setup scherm
    navigation.navigate('Setup', { email, password, username });
  }

  async function handlePasswordReset(tapX: number, tapY: number) {
    setEmailError('');
    if (!email) {
      setEmailError('Enter your email address to reset your password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    
    if (error) {
      setEmailError(error.message);
    } else {
      playSuccessAnimation("Email Sent!", tapX, tapY);
      setTimeout(() => {
        expandOpacity.value = withTiming(0);
        messageOpacity.value = withTiming(0);
        setPageState('login');
      }, 2000);
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) Alert.alert('Google Login failed', error.message);
  }

  return (
    <View style={styles.rootContainer}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        <View style={[styles.splashContainer, { paddingTop: insets.top + 10 }]}>
          <GearButton />
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
              
              {/* --- PAGINA 0: FORGOT PASSWORD (LINKS) --- */}
              <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>We'll send you a recovery link.</Text>

                <Text style={styles.inputLabel}>Email</Text>
                <AnimatedInputContainer focused={emailFocused} error={emailError}>
                  <Ionicons name="mail-outline" size={20} color={emailError ? "#FF4C4C" : (emailFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={emailFocused ? "" : "Enter your email"}
                    placeholderTextColor="#5A6550"
                    value={email}
                    onChangeText={(text) => { setEmail(text); setEmailError(''); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    keyboardAppearance="dark"
                  />
                </AnimatedInputContainer>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                <View style={{ marginTop: 10 }}>
                  <AnimatedButton title="Send Link" onPress={handlePasswordReset} loading={loading} />
                </View>

                <View style={styles.switchContainer}>
                  <Pressable onPress={() => setPageState('login')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.linkText}>Back to Log in</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color="#C2F044" style={{ marginLeft: 6 }} />
                  </Pressable>
                </View>
              </ScrollView>

              {/* --- PAGINA 1: LOGIN (MIDDEN) --- */}
              <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Welcome back.</Text>
                
                {/* TOP TAB SWITCHER */}
                <View style={styles.tabContainer}>
                  <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
                  <Pressable style={styles.tabButton} onPress={() => { setPageState('login'); setEmailError(''); setPasswordError(''); }}>
                    <Text style={[styles.tabText, pageState === 'login' && styles.tabTextActive]}>Log in</Text>
                  </Pressable>
                  <Pressable style={styles.tabButton} onPress={() => { setPageState('signup'); setEmailError(''); setPasswordError(''); }}>
                    <Text style={[styles.tabText, pageState === 'signup' && styles.tabTextActive]}>Register</Text>
                  </Pressable>
                </View>

                <Text style={styles.inputLabel}>Email or Username</Text>
                <AnimatedInputContainer focused={emailFocused} error={emailError}>
                  <Ionicons name="mail-outline" size={20} color={emailError ? "#FF4C4C" : (emailFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={emailFocused ? "" : "Enter your email or username"}
                    placeholderTextColor="#5A6550"
                    value={email}
                    onChangeText={(text) => { setEmail(text); setEmailError(''); setPasswordError(''); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    keyboardAppearance="dark"
                  />
                </AnimatedInputContainer>
                {emailError && emailError !== ' ' ? <Text style={styles.errorText}>{emailError}</Text> : null}

                <Text style={styles.inputLabel}>Password</Text>
                <AnimatedInputContainer focused={passwordFocused} error={passwordError}>
                  <Ionicons name="lock-closed-outline" size={20} color={passwordError ? "#FF4C4C" : (passwordFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={passwordFocused ? "" : "Enter your password"}
                    placeholderTextColor="#5A6550"
                    value={password}
                    onChangeText={(text) => { setPassword(text); setPasswordError(''); setEmailError(''); }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    keyboardAppearance="dark"
                  />
                  <PasswordEye show={showPassword} onPress={() => setShowPassword(!showPassword)} hasError={passwordError !== ''} />
                </AnimatedInputContainer>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                <Pressable style={styles.forgotPasswordContainer} onPress={() => setPageState('forgot')}>
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </Pressable>

                <AnimatedButton title="Log in" onPress={handleLogin} loading={loading} />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.socialRow}>
                  <SocialButton icon="logo-google" color="#F4F6EF" onPress={handleGoogleLogin} />
                  <SocialButton icon="logo-apple" color="#F4F6EF" onPress={() => Alert.alert("Apple Login")} />
                </View>
              </ScrollView>

              {/* --- PAGINA 2: SIGN UP (RECHTS) --- */}
              <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 40 }]}>
                <Text style={styles.formTitle}>Create Account</Text>

                {/* TOP TAB SWITCHER */}
                <View style={styles.tabContainer}>
                  <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
                  <Pressable style={styles.tabButton} onPress={() => { setPageState('login'); setEmailError(''); setPasswordError(''); }}>
                    <Text style={[styles.tabText, pageState === 'login' && styles.tabTextActive]}>Log in</Text>
                  </Pressable>
                  <Pressable style={styles.tabButton} onPress={() => { setPageState('signup'); setEmailError(''); setPasswordError(''); }}>
                    <Text style={[styles.tabText, pageState === 'signup' && styles.tabTextActive]}>Register</Text>
                  </Pressable>
                </View>

                <Text style={styles.inputLabel}>Username</Text>
                <AnimatedInputContainer focused={usernameFocused} error={usernameError}>
                  <Ionicons name="person-outline" size={20} color={usernameError ? "#FF4C4C" : (usernameFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
  style={styles.input}
  placeholder={usernameFocused ? "" : "Choose a display name"}
  placeholderTextColor="#5A6550"
  value={username}
  onChangeText={async (text) => {
    setUsername(text);
    setUsernameError('');

    if (text.trim().length > 2) {
      // Check live in de database of de username al bestaat
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', text.trim())
        .maybeSingle();

      if (data) {
        setUsernameError('This username is already taken.');
      } else {
        setUsernameError(''); // Haal de rode tekst weg als hij niet bestaat!
      }
    } else {
      setUsernameError('');
    }
  }}
  onFocus={() => setUsernameFocused(true)}
  onBlur={() => setUsernameFocused(false)}
  autoCapitalize="none"
  keyboardAppearance="dark"
  textContentType="username"
/>
                </AnimatedInputContainer>
                {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

                <Text style={styles.inputLabel}>Email</Text>
                <AnimatedInputContainer focused={emailFocused} error={emailError}>
                  <Ionicons name="mail-outline" size={20} color={emailError ? "#FF4C4C" : (emailFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
  style={styles.input}
  placeholder={emailFocused ? "" : "Enter your email"}
  placeholderTextColor="#5A6550"
  value={email}
  onChangeText={async (text) => {
    setEmail(text);
    setEmailError('');

    // Check of het in ieder geval op een e-mail lijkt (@ en een punt) om onnodige database calls te voorkomen
    if (text.includes('@') && text.includes('.')) {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', text.trim())
        .maybeSingle();

      if (data) {
        setEmailError('This email is already registered.');
      } else {
        setEmailError(''); // E-mail is vrij!
      }
    }
  }}
  onFocus={() => setEmailFocused(true)}
  onBlur={() => setEmailFocused(false)}
  autoCapitalize="none"
  keyboardType="email-address"
  keyboardAppearance="dark"
/>
                </AnimatedInputContainer>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                <Text style={styles.inputLabel}>Password</Text>
                <AnimatedInputContainer focused={passwordFocused} error={passwordError}>
                  <Ionicons name="lock-closed-outline" size={20} color={passwordError ? "#FF4C4C" : (passwordFocused ? "#C2F044" : "#A9B5A0")} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={passwordFocused ? "" : "Create a secure password"}
                    placeholderTextColor="#5A6550"
                    value={password}
                    onChangeText={(text) => { setPassword(text); setPasswordError(''); }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!showPassword}
                    keyboardAppearance="dark"
                  />
                  <PasswordEye show={showPassword} onPress={() => setShowPassword(!showPassword)} hasError={passwordError !== ''} />
                </AnimatedInputContainer>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                <View style={{ marginTop: 10 }}>
                  <AnimatedButton title="Register" onPress={handleSignUp} loading={loading} />
                </View>

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.socialRow}>
                  <SocialButton icon="logo-google" color="#F4F6EF" onPress={handleGoogleLogin} />
                  <SocialButton icon="logo-apple" color="#F4F6EF" onPress={() => Alert.alert("Apple Login")} />
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
  
  splashContainer: { alignItems: 'center', width: '100%', position: 'relative' },
  gearContainer: { position: 'absolute', top: 20, right: 30, zIndex: 10 },
  splashTitle: { fontFamily: 'Michroma', fontSize: 42, color: '#F4F6EF', letterSpacing: 2 },
  splashSubtitle: { fontFamily: 'Manrope', fontSize: 14, color: '#A9B5A0', marginTop: 8 },
  
  formWrapper: { width: '100%', height: SCREEN_HEIGHT * 0.70 }, 
  svgCurveContainer: { position: 'absolute', top: -99, left: 0, right: 0 },
  formContainerRoot: { flex: 1, backgroundColor: '#252C25' },
  sliderRow: { flexDirection: 'row', width: SCREEN_WIDTH * 3, flex: 1 }, 
  page: { 
  width: SCREEN_WIDTH, 
  paddingHorizontal: 30, 
  paddingTop: 20, 
  paddingBottom: 80 // <-- Verhoog dit van 40 naar 80 zodat alles past
},
  
  formTitle: { fontFamily: 'Michroma', fontSize: 24, color: '#F4F6EF', marginBottom: 10 },
  formSubtitle: { fontFamily: 'Manrope', fontSize: 13, color: '#A9B5A0', marginBottom: 20 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#101311', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#303A30', position: 'relative' },
  tabIndicator: { position: 'absolute', top: 4, left: 4, bottom: 4, width: (SCREEN_WIDTH - 60 - 8) / 2, backgroundColor: '#252C25', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', zIndex: 2 },
  tabText: { fontFamily: 'Manrope', fontWeight: '600', fontSize: 14, color: '#5A6550' },
  tabTextActive: { color: '#F4F6EF' },

  inputLabel: { fontFamily: 'Manrope', fontSize: 13, color: '#F4F6EF', fontWeight: '600', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101311', borderRadius: 12, borderWidth: 1, marginBottom: 12, paddingHorizontal: 15, height: 50 },
  errorText: { color: '#FF4C4C', fontFamily: 'Manrope', fontSize: 12, marginTop: -12, marginBottom: 16, marginLeft: 4 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#F4F6EF', fontFamily: 'Manrope', fontSize: 15, height: '100%' },
  eyeIcon: { padding: 5 },
  
  forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -5 },
  forgotPasswordText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 13, textDecorationLine: 'underline' },
  linkText: { fontFamily: 'Manrope', color: '#C2F044', fontSize: 14, fontWeight: '700' },
  
  primaryButtonWrapper: { borderRadius: 12, shadowColor: '#C2F044', shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 5 },
  primaryButtonInner: { height: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  primaryButtonText: { color: '#101311', fontFamily: 'Manrope', fontWeight: '800', fontSize: 16 },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#303A30' },
  dividerText: { color: '#A9B5A0', fontFamily: 'Manrope', paddingHorizontal: 16, fontSize: 13 },
  
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialCircle: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1, borderColor: '#303A30', overflow: 'hidden' },
  socialCircleInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  switchContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingBottom: 20 },
  switchText: { fontFamily: 'Manrope', color: '#A9B5A0', fontSize: 14 },

  successCircleOverlay: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#C2F044' },
  successMessageContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' },
  successMessageText: { fontFamily: 'Michroma', fontSize: 26, color: '#101311', letterSpacing: 0.5 }
});