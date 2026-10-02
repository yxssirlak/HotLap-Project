import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import HomeScreen from '../screens/HomeScreen';
import CommunityScreen from '../screens/CommunityScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_BAR_WIDTH = SCREEN_WIDTH;
const TAB_WIDTH = TAB_BAR_WIDTH / 4;
const TAB_BAR_HEIGHT = 85;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Community: 'people',
  Map: 'location-sharp',
  Profile: 'person-outline',
};

// SVG Math: The purple ball has a radius of 28 (56 width).
// The cutout now has a radius of 33, creating a perfect 5px gap around it.
const LiquidBackground = () => {
  const center = TAB_BAR_WIDTH + TAB_WIDTH / 2;
  
  return (
    <Svg width={TAB_BAR_WIDTH * 2} height={TAB_BAR_HEIGHT + 100} style={styles.svgBackground}>
      <Path
        d={`
          M 0,20 
          L ${center - 40},20 
          C ${center - 36},20 ${center - 33},22 ${center - 33},25 
          C ${center - 33},43.2 ${center - 18.2},58 ${center},58 
          C ${center + 18.2},58 ${center + 33},43.2 ${center + 33},25 
          C ${center + 33},22 ${center + 36},20 ${center + 40},20 
          L ${TAB_BAR_WIDTH * 2},20 
          L ${TAB_BAR_WIDTH * 2},${TAB_BAR_HEIGHT + 100} 
          L 0,${TAB_BAR_HEIGHT + 100} 
          Z
        `}
        fill="#141420"
      />
    </Svg>
  );
};

function LiquidTabBar({ state, navigation }: any) {
  const indicatorPosition = useSharedValue(0);

  useEffect(() => {
    indicatorPosition.value = withTiming(-(TAB_BAR_WIDTH - (state.index * TAB_WIDTH)), {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index]);

  const animatedSvgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.shadowWrapper}>
        <Animated.View style={[styles.svgWrapper, animatedSvgStyle]}>
          <LiquidBackground />
        </Animated.View>

        <View style={styles.iconsContainer}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
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
                <AnimatedIcon isActive={isFocused} icon={iconName} />
                <AnimatedLabel isActive={isFocused} name={route.name} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const AnimatedIcon = ({ isActive, icon }: { isActive: boolean, icon: any }) => {
  const translateY = useSharedValue(0);
  
  useEffect(() => {
    // Moves up exactly to sit in the mathematical center of the cutout (Y=25)
    translateY.value = withTiming(isActive ? -30 : 0, { 
      duration: 250, 
      easing: Easing.out(Easing.quad) 
    });
  }, [isActive]);
  
  const style = useAnimatedStyle(() => ({ 
    transform: [{ translateY: translateY.value }] 
  }));
  
  return (
    <Animated.View style={[style, isActive && styles.activeIconCircle]}>
      <Ionicons name={icon} size={24} color={isActive ? '#FFFFFF' : '#8E8E93'} />
    </Animated.View>
  );
};

const AnimatedLabel = ({ isActive, name }: { isActive: boolean, name: string }) => {
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

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator tabBar={(props) => <LiquidTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Community" component={CommunityScreen} />
        <Tab.Screen name="Map" component={MapScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
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
    backgroundColor: '#7B61FF', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  navText: {
    fontSize: 10,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});