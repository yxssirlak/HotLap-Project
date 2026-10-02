import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Vervang deze met jouw unieke project keys uit Supabase
const supabaseUrl = 'https://sbtksormqlfpuiuujssk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidGtzb3JtcWxmcHVpdXVqc3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjMxNzgsImV4cCI6MjEwNjUzOTE3OH0.q-dAKxsha8Q51FT-LWpdlBZSxhHL08c6WaAZX8lY9bE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});