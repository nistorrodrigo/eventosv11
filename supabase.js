import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://fwbbicnhehdmodqijkbr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3YmJpY25oZWhkbW9kcWlqa2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDAyNzUsImV4cCI6MjA5OTc3NjI3NX0.GRp5-F-5NTB9Il3M3UhCDnxfxdIPF4wsUX4_bT00-1k'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})
