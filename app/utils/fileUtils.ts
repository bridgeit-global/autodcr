/**
 * Utility functions for file operations including idempotent uploads
 */

/**
 * Generates SHA-256 hash of a file
 * @param file - The file to hash
 * @returns Promise<string> - Hex string of the hash
 */
export async function generateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Gets file extension from filename
 * @param filename - The filename
 * @returns The file extension (without dot)
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Result of an idempotent file upload
 */
export interface IdempotentUploadResult {
  url: string;
  path: string;
  hash: string;
  isNewUpload: boolean; // true if file was uploaded, false if already existed
}

/**
 * Idempotent file upload to Supabase Storage
 * Checks if file with same hash exists before uploading
 * 
 * @param file - The file to upload
 * @param userId - User ID for organizing files
 * @param fileType - Type of file ('photo' or 'letterhead')
 * @param supabase - Supabase client instance
 * @returns Promise<IdempotentUploadResult | null>
 */
export async function uploadFileIdempotent(
  file: File,
  userId: string,
  fileType: 'photo' | 'letterhead',
  supabase: any
): Promise<IdempotentUploadResult | null> {
  try {
    // Generate hash of file content
    const hash = await generateFileHash(file);
    const fileExt = getFileExtension(file.name);
    
    // Determine file extension and folder based on type
    const folder = fileType === 'photo' ? 'photos' : 'letterheads';
    const extension = fileType === 'photo' ? fileExt : 'pdf';
    
    // Validate extension
    if (!extension || extension.length === 0) {
      throw new Error(`Invalid file extension for ${fileType}. File: ${file.name}`);
    }
    
    // Construct file path using hash
    const filePath = `${userId}/${folder}/${hash}.${extension}`;
    
    
    // Verify user is authenticated first (required for RLS policy)
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      console.error('User not authenticated:', authError);
      throw new Error('User authentication required for file upload. Please log in again.');
    }
    
    // Ensure userId matches authenticated user's ID (required by RLS policy)
    // RLS policy checks: (storage.foldername(name))[1] = (auth.uid())::text
    // So the first folder in the path must match auth.uid()
    const actualUserId = userId !== authUser.id ? authUser.id : userId;
    
    // Reconstruct filePath with correct userId to match RLS policy
    const correctedFilePath = `${actualUserId}/${folder}/${hash}.${extension}`;
    
    
    // Use corrected file path
    const finalFilePath = correctedFilePath;
    
    // Check if file already exists before uploading (idempotent approach)
    // Try to verify file exists via direct HTTP HEAD request (more reliable than list)
    const { data: checkUrlData } = supabase.storage
      .from('consultant-documents')
      .getPublicUrl(finalFilePath);
    
    // Try HEAD request to check if file exists and is accessible
    try {
      const headResponse = await fetch(checkUrlData.publicUrl, { method: 'HEAD' });
      if (headResponse.ok) {
        // File already exists and is accessible
        return {
          url: checkUrlData.publicUrl,
          path: finalFilePath,
          hash,
          isNewUpload: false
        };
      }
      // File doesn't exist - proceed with upload
    } catch (fetchError) {
      // Network error - proceed with upload
    }
    
    // File doesn't exist - proceed with upload using the corrected path
    // Try without upsert first (some RLS policies may not allow upsert/update on new files)
    let uploadResult = await supabase.storage
      .from('consultant-documents')
      .upload(finalFilePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    // If upload fails with "already exists" error, try with upsert
    if (uploadResult.error) {
      const errorMsg = uploadResult.error.message || '';
      const statusCode = uploadResult.error.statusCode;
      
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || statusCode === 409 || statusCode === '409') {
        uploadResult = await supabase.storage
          .from('consultant-documents')
          .upload(finalFilePath, file, {
            cacheControl: '3600',
            upsert: true
          });
      }
    }
    
    const { data, error: uploadError } = uploadResult;
    
    
    // Check if upload failed
    if (uploadError) {
      // Log full error for debugging
      console.error(`Error uploading ${fileType}:`, uploadError.message || uploadError);
      
      // Provide more helpful error messages based on status code
      if (uploadError.statusCode === '500' || uploadError.statusCode === 500) {
        throw new Error(`Supabase Storage server error (500). This is typically caused by RLS policy restrictions. Please verify your INSERT policy allows paths matching "${actualUserId}/letterheads/*" or "${actualUserId}/photos/*". File path attempted: ${finalFilePath}`);
      }
      
      // Return error details for better error messages
      throw new Error(uploadError.message || `Failed to upload ${fileType}. Please check your connection and try again.`);
    }
    
    // Verify upload was successful
    if (!data || !data.path) {
      console.error(`Upload succeeded but no data returned for ${fileType}`);
      throw new Error(`Upload failed: No data returned from storage.`);
    }
    
    // Skip list() verification as it can fail with 500 errors
    // We'll verify via download instead which is more reliable
    
    // Get public URL for newly uploaded file
    const { data: urlData } = supabase.storage
      .from('consultant-documents')
      .getPublicUrl(data.path);
    
    if (!urlData || !urlData.publicUrl) {
      console.error(`Failed to get public URL for ${fileType} at path: ${data.path}`);
      throw new Error(`Failed to get public URL for uploaded file.`);
    }
    
    // Verify the file is actually accessible by trying to download it
    // This ensures the file is fully committed to storage
    // Wait a bit for eventual consistency
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let downloadData = null;
    let downloadError = null;
    let retries = 3;
    
    // Retry download verification a few times in case of eventual consistency
    while (retries > 0) {
      const result = await supabase.storage
        .from('consultant-documents')
        .download(data.path);
      
      downloadData = result.data;
      downloadError = result.error;
      
      if (!downloadError && downloadData) {
        break; // Success
      }
      
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (downloadError || !downloadData) {
      console.error(`File uploaded but not accessible after retries:`, downloadError?.message || downloadError);
      
      throw new Error(`Upload verification failed: File is not accessible after upload. ${downloadError?.message || 'Unknown error'}`);
    }
    
    
    return {
      url: urlData.publicUrl,
      path: data.path,
      hash,
      isNewUpload: true
    };
    
  } catch (err: any) {
    console.error(`Unexpected error in idempotent upload for ${fileType}:`, err);
    // Re-throw if it's already an Error with a message
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Failed to upload ${fileType}. ${err?.message || 'Unknown error occurred.'}`);
  }
}

/**
 * Deletes old file from storage if it exists and is different from current
 * 
 * @param oldFilePath - Path to the old file (can be null)
 * @param newHash - Hash of the new file
 * @param supabase - Supabase client instance
 */
export async function cleanupOldFile(
  oldFilePath: string | null,
  newHash: string,
  supabase: any
): Promise<void> {
  if (!oldFilePath) return;
  
  try {
    // Extract hash from old file path
    // Path format: userId/folder/hash.ext
    const pathParts = oldFilePath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const oldHash = filename.split('.')[0];
    
    // Only delete if hash is different (different file)
    if (oldHash !== newHash) {
      const { error } = await supabase.storage
        .from('consultant-documents')
        .remove([oldFilePath]);
      
      if (error) {
        console.error('Error deleting old file:', error.message);
        // Don't throw - cleanup failure shouldn't block the operation
      }
    }
  } catch (err) {
    console.error('Unexpected error in cleanup:', err);
    // Don't throw - cleanup failure shouldn't block the operation
  }
}

