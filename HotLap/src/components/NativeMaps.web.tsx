import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

// react-native-maps has no web implementation, so render an empty placeholder.
export function MapView({ style }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; [key: string]: unknown }) {
  return <View style={[{ backgroundColor: '#1A201A' }, style]} />;
}

export function Polyline(_props: { coordinates: unknown[]; strokeColor?: string; strokeWidth?: number }) {
  return null;
}
