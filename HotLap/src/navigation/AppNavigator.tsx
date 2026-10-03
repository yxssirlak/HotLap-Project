import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

// Importeer al je schermen
import HomeScreen from '../screens/HomeScreen';
import CommunityScreen from '../screens/CommunityScreen';
import RecordScreen from '../screens/RecordScreen'; 
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator(); // <-- De nieuwe Stack Navigator!
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_BAR_WIDTH = SCREEN_WIDTH;
const TAB_WIDTH = TAB_BAR_WIDTH / 5;
const TAB_BAR_HEIGHT = 85;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Discover: 'map',
  Community: 'people',
  Record: 'add', 
  Map: 'location',
  Profile: 'person',
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Liquid Tab Bar Component
function LiquidTabBar({ state, navigation }: any) {
  const indicatorPosition = useSharedValue(0);
  const cutoutRadius = useSharedValue(33);

  useEffect(() => {
    indicatorPosition.value = withTiming(-(TAB_BAR_WIDTH - (state.index * TAB_WIDTH)), {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // Laat de uitsnede iets groeien voor de grote Record knop
    cutoutRadius.value = withTiming(state.index === 2 ? 37 : 33, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index]);

  const animatedSvgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const animatedPathProps = useAnimatedProps(() => {
    const r = cutoutRadius.value;
    const center = TAB_BAR_WIDTH + TAB_WIDTH / 2;
    
    // Y-coördinaten
    const topY = 20;
    const bowlStartY = 30; // Startpunt van de cirkel is verlaagd voor gladdere hoeken
    const bottomY = 25 + r;

    // Dynamische schouder-berekening voor extreem zachte hoeken
    const shoulderWidth = 26; 
    const startX = center - r - shoulderWidth;
    const endX = center + r + shoulderWidth;

    const d = `
      M 0,${topY} 
      L ${startX},${topY} 
      C ${center - r - 12},${topY} ${center - r},${topY + 2} ${center - r},${bowlStartY} 
      C ${center - r},${25 + r * 0.552} ${center - (r * 0.552)},${bottomY} ${center},${bottomY} 
      C ${center + (r * 0.552)},${bottomY} ${center + r},${25 + r * 0.552} ${center + r},${bowlStartY} 
      C ${center + r},${topY + 2} ${center + r + 12},${topY} ${endX},${topY} 
      L ${TAB_BAR_WIDTH * 2},${topY} 
      L ${TAB_BAR_WIDTH * 2},${TAB_BAR_HEIGHT + 100} 
      L 0,${TAB_BAR_HEIGHT + 100} 
      Z
    `;
    return { d };
  });

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.shadowWrapper}>
        <Animated.View style={[styles.svgWrapper, animatedSvgStyle]}>
          <Svg width={TAB_BAR_WIDTH * 2} height={TAB_BAR_HEIGHT + 100} style={styles.svgBackground}>
            <AnimatedPath animatedProps={animatedPathProps} fill="#252C25" />
          </Svg>
        </Animated.View>

        <View style={styles.iconsContainer}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const isRecord = route.name === 'Record'; 
            const iconName = ICONS[route.name];

            const handlePress = () => {
              if (!isFocused) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity 
                key={index} 
                style={styles.navItem} 
                onPress={handlePress} 
                activeOpacity={1}
              >
                <AnimatedIcon isActive={isFocused} icon={iconName} isRecord={isRecord} />
                <AnimatedLabel isActive={isFocused} name={route.name} isRecord={isRecord} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// Icon Animations
const AnimatedIcon = ({ isActive, icon, isRecord }: { isActive: boolean, icon: any, isRecord: boolean }) => {
  const translateY = useSharedValue(isRecord ? -14 : 0);
  
  useEffect(() => {
    const targetY = isRecord 
      ? (isActive ? -30 : -14) 
      : (isActive ? -30 : 0);
      
    translateY.value = withTiming(targetY, { 
      duration: 250, 
      easing: Easing.out(Easing.quad) 
    });
  }, [isActive, isRecord]);
  
  const style = useAnimatedStyle(() => ({ 
    transform: [{ translateY: translateY.value }] 
  }));
  
  return (
    <Animated.View style={[
      style, 
      isActive && !isRecord && styles.activeIconCircle, 
      isRecord && styles.recordIconCircle 
    ]}>
      {isRecord ? (
        <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: 28, height: 6, backgroundColor: '#101311', borderRadius: 3 }} />
          <View style={{ position: 'absolute', width: 6, height: 28, backgroundColor: '#101311', borderRadius: 3 }} />
        </View>
      ) : (
        <Ionicons name={icon} size={24} color={isActive ? '#101311' : '#A9B5A0'} />
      )}
    </Animated.View>
  );
};

// Label Animations
const AnimatedLabel = ({ isActive, name, isRecord }: { isActive: boolean, name: string, isRecord: boolean }) => {
  if (isRecord) return null;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  
  useEffect(() => {
    opacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
    translateY.value = withTiming(isActive ? 0 : 5, { duration: 250 });
  }, [isActive]);
  
  const style = useAnimatedStyle(() => ({ 
    opacity: opacity.value, 
    transform: [{ translateY: translateY.value }],
    position: 'absolute',
    bottom: 12, 
  }));
  
  return <Animated.Text style={[styles.navText, style]}>{name}</Animated.Text>;
};

// --- NAVIGATORS ---

// 1. De Tab Navigator (Jouw menu onderaan)
function TabNavigator() {
  return (
    <Tab.Navigator tabBar={(props) => <LiquidTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Discover" component={HomeScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// 2. De Hoofd Stack Navigator (Combinaert tabs met losse schermen zoals Edit Profile)
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* MainTabs laadt je hele bottom menu in */}
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        
        {/* Dit is het nieuwe scherm dat OVER je tabs heen schuift */}
        <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0, 
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
  },
  shadowWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  svgWrapper: {
    position: 'absolute',
    top: -20, 
    left: 0,
    right: 0,
    bottom: -50, 
    overflow: 'visible',
  },
  svgBackground: {
    position: 'absolute',
  },
  iconsContainer: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    paddingBottom: 15, 
  },
  navItem: {
    width: TAB_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconCircle: {
    width: 56, 
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C2F044', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C2F044',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  recordIconCircle: {
    width: 64, 
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C2F044', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C2F044',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  navText: {
    fontSize: 10,
    fontFamily: 'Manrope',
    fontWeight: '700',
    color: '#F4F6EF',
    letterSpacing: 0.5,
  },
});