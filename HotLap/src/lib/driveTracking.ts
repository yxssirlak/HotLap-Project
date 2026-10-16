import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const DRIVE_TASK = 'hotlap-drive-tracking';

type LocationListener = (location: Location.LocationObject) => void;

let listener: LocationListener | null = null;

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(DRIVE_TASK, ({ data, error }) => {
    if (error || !data) return;
    data.locations.forEach((location) => listener?.(location));
  });
}

export async function startDriveTracking(onLocation: LocationListener) {
  listener = onLocation;
  if (await Location.hasStartedLocationUpdatesAsync(DRIVE_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVE_TASK);
  }
  await Location.startLocationUpdatesAsync(DRIVE_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 0,
    timeInterval: 500,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'HotLap is recording your drive',
      notificationBody: 'Tap to return to your drive.',
      notificationColor: '#C2F044',
    },
  });
}

export async function stopDriveTracking() {
  listener = null;
  if (await Location.hasStartedLocationUpdatesAsync(DRIVE_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(DRIVE_TASK);
  }
}
