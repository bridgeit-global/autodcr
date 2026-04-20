/**
 * Public Supabase URL + anon key — same defaults as the browser client (`supabase.ts`).
 * Ensures API routes (`resolveConsultantMetadata`, RPC, etc.) work locally without `.env.local`.
 */
export function getSupabasePublicUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://mgxbetsxswaislwhtygw.supabase.co"
  );
}

export function getSupabasePublicAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGJldHN4c3dhaXNsd2h0eWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzcwNjksImV4cCI6MjA4MDI1MzA2OX0.tJPN5_q4EMrQHjAZpGT4_NSzxIvLMyLiotjbkTltavs"
  );
}
