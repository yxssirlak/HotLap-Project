import * as Location from 'expo-location';

type LocationListener = (location: Location.LocationObject) => void;

let subscription: Location.LocationSubscription | null = null;

export async function startDriveTracking(onLocation: LocationListener) {
  await stopDriveTracking();
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 0,
      timeInterval: 500,
    },
    onLocation,
  );
}

export async function stopDriveTracking() {
  subscription?.remove();
  subscription = null;
}
