import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/utils/supabase';

// Uses database function with SECURITY DEFINER - no service role key needed
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
    const { data, error } = await supabase.rpc('get_user_email_by_user_id', {
      lookup_user_id: user_id
    });

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json(
        { error: 'Failed to lookup user' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = data[0];
    return NextResponse.json({
      email: user.email,
      user_id: user.user_id,
      consultant_type: user.consultant_type,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

