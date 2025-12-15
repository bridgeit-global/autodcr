import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/utils/supabase';

// Uses database function with SECURITY DEFINER - no service role key needed
export async function POST(request: NextRequest) {
  try {
    const { user_id, role, metadata } = await request.json();

    if (!user_id || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Prepare metadata payloads
    // IMPORTANT: Don't set app_metadata.role to application roles like "Consultant" or "Owner"
    // because Supabase Storage tries to use it as a PostgreSQL role, which will fail.
    // Store the application role in user_metadata.role instead, and set app_metadata.role to "authenticated"
    // which is a valid PostgreSQL role that Supabase recognizes.
    
    // Ensure the role is stored in user_metadata, not app_metadata
    let userMetadata = metadata || {};
    if (!userMetadata.role) {
      userMetadata = { ...userMetadata, role: role };
    }
    
    // Set app_metadata.role to "authenticated" (valid PostgreSQL role) instead of application roles
    // This prevents the "role does not exist" error when uploading files to storage
    const appMetadata = { role: 'authenticated' };

    // Call database function to update user metadata, app_metadata, and role
    const { data, error } = await supabase.rpc('update_user_metadata_and_role', {
      user_uuid: user_id,
      new_role: 'authenticated',
      user_metadata: userMetadata,
      app_metadata: appMetadata
    });

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Failed to update user', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data,
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

