import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

function createSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    // During SSR/build, create a new instance each time (or return null)
    return createSupabaseClient()
  }

  // On client, use singleton
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient()
  }
  return supabaseInstance
}

// Legacy export - will be null if env vars not set
export const supabase = createSupabaseClient()
