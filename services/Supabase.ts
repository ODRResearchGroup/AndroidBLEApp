import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://bqfolbyqgkrwgownmcoa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZm9sYnlxZ2tyd2dvd25tY29hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjAzNTcsImV4cCI6MjA4MTQzNjM1N30.m6eLKjc7Tdx85EytjwQJjK2LRy23AkzDxvPsWf565EY',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
