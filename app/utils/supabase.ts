import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mgxbetsxswaislwhtygw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGJldHN4c3dhaXNsd2h0eWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzcwNjksImV4cCI6MjA4MDI1MzA2OX0.tJPN5_q4EMrQHjAZpGT4_NSzxIvLMyLiotjbkTltavs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

