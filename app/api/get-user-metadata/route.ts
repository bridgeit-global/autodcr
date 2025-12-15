import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/utils/supabase';

// API route to fetch raw_user_meta_data from auth.users table
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'User metadata not found' },
        { status: 404 }
      );
    }

    const user = data[0];
    const metadata = user.raw_user_meta_data || user.metadata || user.user_metadata || {};
    
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

