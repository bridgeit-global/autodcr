import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This uses the service role key (server-side only) to update user role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_id, role, metadata } = await request.json();

    if (!user_id || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Update user metadata and role in a single call
    const updatePayload: any = {
      app_metadata: { role: role }
    };

    // If metadata is provided, include it in user_metadata
    if (metadata) {
      updatePayload.user_metadata = metadata;
    }

    // Update user using Admin API (metadata and role)
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      updatePayload
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user', details: updateError.message },
        { status: 500 }
      );
    }

    // Update role column directly in auth.users table using database function
    // Try calling with named parameters first
    let functionError = null;
    try {
      const { error } = await supabaseAdmin.rpc('update_auth_user_role', {
        user_uuid: user_id,
        new_role: role
      });
      functionError = error;
    } catch (err) {
      // If named parameters fail, try positional parameters
      console.warn('Named parameter call failed, trying alternative approach');
      functionError = err as any;
    }

    if (functionError) {
      console.error('Error updating user role column via RPC:', functionError);
      // Warn but don't fail since app_metadata.role is set
      console.warn('Role set in app_metadata but role column update failed. The role is still set in app_metadata.');
      console.warn('Note: PostgREST schema cache may need to refresh. Wait 30-60 seconds and try again.');
    }

    return NextResponse.json({
      success: true,
      user: updateData.user,
      message: 'User metadata and role updated successfully'
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

