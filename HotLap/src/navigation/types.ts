export type Profile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  car_brand?: string | null;
  car_model?: string | null;
  car_year?: string | number | null;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Sprint: undefined;
  DriveDetail: { driveId: string };
  ShareActivity: {
    activity: {
      type: 'drive' | 'sprint';
      vehicle: string;
      durationSeconds: number;
      distanceMeters: number;
      averageSpeedKmh: number;
      topSpeedKmh?: number;
      details?: Record<string, number | string | null>;
      track: Array<{ latitude: number; longitude: number }>;
      startLatitude?: number;
      startLongitude?: number;
    };
  };
  EditProfileScreen: { profile?: Profile };
};
