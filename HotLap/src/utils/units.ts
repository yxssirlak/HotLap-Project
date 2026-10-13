import * as Localization from 'expo-localization';

export type DistanceUnit = 'km' | 'mi';

const MILES_COUNTRIES = new Set(['BS', 'BZ', 'GB', 'KY', 'LR', 'MM', 'US']);
const METERS_PER_MILE = 1609.344;

export function getDistanceUnit(): DistanceUnit {
  const regionCode = Localization.getLocales()[0]?.regionCode?.toUpperCase();
  return regionCode && MILES_COUNTRIES.has(regionCode) ? 'mi' : 'km';
}

export function formatTravelDistance(meters: number, unit: DistanceUnit, decimals = 2) {
  if (unit === 'mi') return `${(meters / METERS_PER_MILE).toFixed(decimals)} mi`;
  return meters >= 1000
    ? `${(meters / 1000).toFixed(decimals)} km`
    : `${Math.round(meters)} m`;
}

export function formatSpeed(kilometersPerHour: number, unit: DistanceUnit) {
  return unit === 'mi'
    ? `${Math.round(kilometersPerHour * 0.621371)} mph`
    : `${Math.round(kilometersPerHour)} km/h`;
}

export function formatElevation(meters: number, unit: DistanceUnit) {
  return unit === 'mi'
    ? `${Math.round(meters * 3.28084)} ft`
    : `${Math.round(meters)} m`;
}

export function sprintDistanceLabel(meters: number, unit: DistanceUnit) {
  if (unit === 'mi') {
    if (meters < 500) return '1/4 MILE';
    if (meters < 1200) return '1/2 MILE';
    return '1 MILE';
  }
  if (meters < 500) return '400 METERS';
  if (meters < 1200) return '800 METERS';
  return '1.6 KILOMETERS';
}

export function sprintDistanceValue(meters: number, unit: DistanceUnit) {
  return unit === 'mi'
    ? `${(meters / METERS_PER_MILE).toFixed(3)} mi`
    : meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km`
      : `${Math.round(meters)} m`;
}
