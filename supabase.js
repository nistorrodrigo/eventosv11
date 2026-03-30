import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://bfdnbrteipvibafouyfy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZG5icnRlaXB2aWJhZm91eWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTg2OTksImV4cCI6MjA5MDQ3NDY5OX0.wSGNowxeaQSabUsjc1qAf8FG78IhDl4P74qgQCT7NZg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})
