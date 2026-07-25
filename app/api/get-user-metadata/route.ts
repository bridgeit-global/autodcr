import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/utils/supabase';
import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicUrl } from '@/app/utils/supabaseEnv';

// API route to fetch raw_user_meta_data from auth.users table
export async function POST(request: NextRequest) {
  try {
    const { user_id, email } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[get-user-metadata] lookup request", { lookup_user_id: user_id });
    }

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceRole) {
      const admin = createClient(getSupabasePublicUrl(), serviceRole, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: adminData, error: adminErr } = await admin.auth.admin.getUserById(
        String(user_id).trim()
      );
      if (
        !adminErr &&
        adminData?.user?.user_metadata &&
        typeof adminData.user.user_metadata === "object"
      ) {
        return NextResponse.json({
          metadata: adminData.user.user_metadata,
          user_id: adminData.user.id,
          email: adminData.user.email,
        });
      }
    }

    // Call database function - uses SECURITY DEFINER so it can access auth.users
    // Use the same function as get-user-email since it likely returns full user data
    const { data, error } = await supabase.rpc('get_user_email_by_user_id', {
      lookup_user_id: user_id
    });

    if (error) {
      console.error('Error fetching user metadata:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user metadata' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      if (email && serviceRole) {
        const admin = createClient(getSupabasePublicUrl(), serviceRole, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const normalizedEmail = String(email).trim().toLowerCase();
        for (let page = 1; page <= 5; page += 1) {
          const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (usersErr) break;
          const match = usersPage?.users?.find(
            (u) => (u.email || "").trim().toLowerCase() === normalizedEmail
          );
          if (match && match.user_metadata && typeof match.user_metadata === "object") {
            if (process.env.NODE_ENV === "development") {
              console.log("[get-user-metadata] debug(admin-by-email)", {
                lookup_user_id: user_id,
                lookup_email: email,
                returned_user_id: match.id,
                raw_user_meta_data: match.user_metadata,
              });
            }
            return NextResponse.json({
              metadata: match.user_metadata,
              user_id: match.id,
              email: match.email,
            });
          }
          if (!usersPage?.users || usersPage.users.length < 200) break;
        }
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[get-user-metadata] lookup miss", {
          lookup_user_id: user_id,
          lookup_email: email || null,
        });
      }
      return NextResponse.json(
        { error: 'User metadata not found' },
        { status: 404 }
      );
    }

    const user = data[0];
    const metadata = user.raw_user_meta_data || user.metadata || user.user_metadata || {};

    if (process.env.NODE_ENV === "development") {
      console.log("[get-user-metadata] debug", {
        lookup_user_id: user_id,
        returned_user_id: user.user_id,
        raw_user_meta_data: user.raw_user_meta_data ?? null,
        metadata_keys:
          metadata && typeof metadata === "object"
            ? Object.keys(metadata as Record<string, unknown>).slice(0, 60)
            : [],
      });
    }
    
    return NextResponse.json({
      metadata: metadata,
      user_id: user.user_id,
      email: user.email,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
