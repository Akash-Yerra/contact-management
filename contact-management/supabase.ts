import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jpeebekqujcvjdxvsqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZWViZWtxdWpjdmpkeHZzcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1OTM1NjgsImV4cCI6MjA1NTE2OTU2OH0.jjMvCr4oAvSYksu1qE_xAThW6ZWDY6bwUhlg2c9P2L4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 