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
  EditProfileScreen: { profile?: Profile };
};
