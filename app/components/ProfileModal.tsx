'use client';

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { uploadFileIdempotent, cleanupOldFile } from "@/app/utils/fileUtils";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  name: string;
  console: string;
  panNo: string;
  address: string;
  city: string;
  zip: string;
  email: string;
  mobile: string;
  nmaRegNumber: string;
};

const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const { userMetadata, fetchUserMetadata } = useUserMetadata();
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get registration label and value based on role and type
  const getRegistrationInfo = (): { label: string; value: string } => {
    if (!userMetadata) return { label: "NMA Reg Number:", value: "" };
    
    if (userMetadata.role === "Owner") {
      const entityType = userMetadata.entity_type;
      if (entityType === "Pvt. Ltd. / Ltd. Company") {
        return { label: "CIN Number:", value: userMetadata.cin || "" };
      } else if (entityType === "LLP") {
        return { label: "LLPIN Number:", value: userMetadata.llpin || "" };
      } else if (entityType === "Partnership Firm") {
        return { label: "Firm Registration No:", value: userMetadata.firm_registration_no || "" };
      } else if (entityType === "Trust / Society") {
        return { label: "Trust Registration No:", value: userMetadata.trust_registration_no || "" };
      } else if (entityType === "Govt. / PSU / Local Body") {
        return { label: "Trust Reg No:", value: userMetadata.trust_reg_no || "" };
      }
    } else if (userMetadata.role === "Consultant") {
      const consultantType = userMetadata.consultant_type;
      if (consultantType === "Architect") {
        return { label: "COA Reg No:", value: userMetadata.coa_reg_no || "" };
      } else if (consultantType === "Structural Engineer") {
        return { label: "Structural License No:", value: userMetadata.structural_license_no || "" };
      } else if (consultantType === "Licensed Surveyor") {
        return { label: "LBS License No:", value: userMetadata.lbs_license_no || "" };
      } else if (consultantType === "MEP Consultant") {
        return { label: "Electrical License No:", value: userMetadata.electrical_license_no || "" };
      } else if (consultantType === "Plumber") {
        return { label: "Plumber License No:", value: userMetadata.plumber_license_no || "" };
      } else if (consultantType === "Fire Consultant") {
        return { label: "Fire License No:", value: userMetadata.fire_license_no || "" };
      } else if (consultantType === "Landscape Consultant") {
        return { label: "Landscape License No:", value: userMetadata.landscape_license_no || "" };
      }
    }
    
    return { label: "NMA Reg Number:", value: "" };
  };
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(null);
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [letterheadThumbnail, setLetterheadThumbnail] = useState<string | null>(null);
  const [originalLetterheadUrl, setOriginalLetterheadUrl] = useState<string | null>(null);
  const [originalLetterheadThumbnail, setOriginalLetterheadThumbnail] = useState<string | null>(null);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<FormValues>();

  // Fetch user_id from localStorage
  useEffect(() => {
    if (open) {
      const storedMetadata = localStorage.getItem("userMetadata");
      if (storedMetadata) {
        try {
          const parsed = JSON.parse(storedMetadata);
          if (parsed?.user_id) {
            setUserId(parsed.user_id);
          }
        } catch (e) {
          console.error('Error parsing userMetadata from localStorage:', e);
        }
      }
    }
  }, [open]);

  // Populate form with user metadata when modal opens or metadata loads
  useEffect(() => {
    if (open && userMetadata) {
      // Format name: last_name first_name middle_name
      const lastName = userMetadata.last_name || "";
      const firstName = userMetadata.first_name || "";
      const middleName = userMetadata.middle_name || "";
      const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ");

      setValue("name", fullName || "");
      setValue("console",  userMetadata.role == "Owner" ? userMetadata.entity_type : userMetadata.consultant_type );
      setValue("panNo", userMetadata.pan || "");
      setValue("address", userMetadata.address || "");
      setValue("city", userMetadata.city || "");
      setValue("zip", userMetadata.pincode || "");
      setValue("email", userMetadata.email || "");
      setValue("mobile", userMetadata.alternate_phone || userMetadata.mobile || "");
      const existingPhotoUrl = userMetadata.authorized_signatory_photo_url || null;
      setProfilePhoto(existingPhotoUrl);
      setOriginalPhotoUrl(existingPhotoUrl);
      
      // Set letterhead URL from metadata
      // Verify file exists before setting URL
      const existingLetterheadUrl = userMetadata.letterhead_url || null;
      if (existingLetterheadUrl) {
        // Verify file exists before using the URL
        verifyFileExists(existingLetterheadUrl).then((exists) => {
          if (exists) {
            setLetterheadUrl(existingLetterheadUrl);
            setOriginalLetterheadUrl(existingLetterheadUrl);
            // For images, use the URL directly as thumbnail
            setLetterheadThumbnail(existingLetterheadUrl);
            setOriginalLetterheadThumbnail(existingLetterheadUrl);
          } else {
            // File doesn't exist at that URL - try to find it by extracting path and reconstructing URL
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/...path
            const urlMatch = existingLetterheadUrl.match(/\/consultant-documents\/(.+)$/);
            if (urlMatch) {
              const pathInUrl = urlMatch[1];
              
              // Get current user to check if path needs userId prepended
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user?.id) {
                  // Check if path already starts with userId
                  if (!pathInUrl.startsWith(user.id + '/')) {
                    // Try reconstructing URL with userId if hash/filename matches pattern
                    const parts = pathInUrl.split('/');
                    if (parts.length >= 2 && parts[0] === 'letterheads') {
                      // Path might be missing userId - try adding it
                      const reconstructedPath = `${user.id}/${parts.join('/')}`;
                      const { data: urlData } = supabase.storage
                        .from('consultant-documents')
                        .getPublicUrl(reconstructedPath);
                      
                      verifyFileExists(urlData.publicUrl).then((reconstructedExists) => {
                        if (reconstructedExists) {
                          setLetterheadUrl(urlData.publicUrl);
                          setOriginalLetterheadUrl(urlData.publicUrl);
                        } else {
                          // File not found - clear URL
                          setLetterheadUrl(null);
                          setOriginalLetterheadUrl(null);
                          setLetterheadThumbnail(null);
                          setOriginalLetterheadThumbnail(null);
                        }
                      });
                    } else {
                      // Clear URL if we can't reconstruct
                      setLetterheadUrl(null);
                      setOriginalLetterheadUrl(null);
                      setLetterheadThumbnail(null);
                      setOriginalLetterheadThumbnail(null);
                    }
                  } else {
                    // Path already has userId but file doesn't exist - clear URL
                    setLetterheadUrl(null);
                    setOriginalLetterheadUrl(null);
                    setLetterheadThumbnail(null);
                    setOriginalLetterheadThumbnail(null);
                  }
                } else {
                  // Can't verify - clear URL
                  setLetterheadUrl(null);
                  setOriginalLetterheadUrl(null);
                  setLetterheadThumbnail(null);
                  setOriginalLetterheadThumbnail(null);
                }
              });
            } else {
              // Can't parse URL - clear it
              setLetterheadUrl(null);
              setOriginalLetterheadUrl(null);
              setLetterheadThumbnail(null);
              setOriginalLetterheadThumbnail(null);
            }
          }
        }).catch((error) => {
          console.error('Error verifying letterhead file existence:', error);
          // On error, clear URL to avoid showing broken preview
          setLetterheadUrl(null);
          setOriginalLetterheadUrl(null);
          setLetterheadThumbnail(null);
          setOriginalLetterheadThumbnail(null);
        });
      } else {
        setLetterheadUrl(null);
        setOriginalLetterheadUrl(null);
        setLetterheadThumbnail(null);
        setOriginalLetterheadThumbnail(null);
      }
      
      // Set NMA Reg Number based on role and type
      const registrationInfo = getRegistrationInfo();
      setValue("nmaRegNumber", registrationInfo.value);
    }
  }, [open, userMetadata, setValue]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setSubmitError(null);
      setSubmitSuccess(false);
      
      // Reset any unsaved changes when modal opens
      setLetterheadFile(null);
      setLetterheadPreviewUrl(null);
      setLetterheadUrl(originalLetterheadUrl);
      setLetterheadThumbnail(originalLetterheadThumbnail);
      setProfilePhotoFile(null);
      setProfilePhoto(originalPhotoUrl);
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    } else {
      document.body.style.overflow = "auto";
      reset();
      
      // Reset any unsaved changes when modal closes
      setLetterheadFile(null);
      setLetterheadPreviewUrl(null);
      setLetterheadUrl(originalLetterheadUrl);
      setLetterheadThumbnail(originalLetterheadThumbnail);
      setProfilePhotoFile(null);
      setProfilePhoto(originalPhotoUrl);
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, reset, originalLetterheadUrl, originalLetterheadThumbnail]);

  // Clean up blob URLs when letterheadPreviewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl && letterheadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      if (!userMetadata) {
        setSubmitError("User metadata not found. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      // Get current user ID from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.id) {
        setSubmitError("User not found. Please log in again.");
        setIsSubmitting(false);
        return;
      }

      const userId = user.id;

      // Upload photo if a new file was selected
      let photoUrl = originalPhotoUrl;
      if (profilePhotoFile) {
        try {
          const photoUploadResult = await uploadFileIdempotent(
            profilePhotoFile,
            userId,
            'photo',
            supabase
          );
          
          if (!photoUploadResult) {
            throw new Error("Failed to upload photo. Upload returned no result.");
          }
          
          photoUrl = photoUploadResult.url;
          
          // Cleanup old photo if it's different
          if (originalPhotoUrl && originalPhotoUrl !== photoUrl) {
            // Extract path from URL (remove domain and bucket info)
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/userId/photos/hash.ext
            const urlParts = originalPhotoUrl.split('/consultant-documents/');
            if (urlParts.length > 1) {
              const oldPath = urlParts[1];
              await cleanupOldFile(oldPath, photoUploadResult.hash, supabase);
            }
          }
        } catch (uploadErr: any) {
          throw new Error(uploadErr.message || "Failed to upload photo. Please try again.");
        }
      }

      // Upload letterhead if a new file was selected
      let letterheadUrlResult = originalLetterheadUrl;
      if (letterheadFile) {
        try {
          const letterheadUploadResult = await uploadFileIdempotent(
            letterheadFile,
            userId,
            'letterhead',
            supabase
          );
          
          if (!letterheadUploadResult) {
            throw new Error("Failed to upload letterhead. Upload returned no result.");
          }
          
          // Verify the URL is valid (should end with .jpg, .jpeg, or .png)
          const validExtensions = ['.jpg', '.jpeg', '.png'];
          const hasValidExtension = validExtensions.some(ext => letterheadUploadResult.url?.toLowerCase().endsWith(ext));
          if (!letterheadUploadResult.url || !hasValidExtension) {
            console.error('Invalid letterhead URL returned:', letterheadUploadResult.url);
            throw new Error("Invalid letterhead URL returned from upload. Please try again.");
          }
          
          // Additional verification: Check if file is actually accessible via HTTP
          const fileExists = await verifyFileExists(letterheadUploadResult.url);
          if (!fileExists) {
            console.error('Upload reported success but file is not accessible:', letterheadUploadResult.url);
            throw new Error("File upload failed: File is not accessible after upload. Please try again.");
          }
          
          letterheadUrlResult = letterheadUploadResult.url;
          
          // Cleanup old letterhead if it's different
          if (originalLetterheadUrl && originalLetterheadUrl !== letterheadUrlResult) {
            // Extract path from URL (remove domain and bucket info)
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/userId/letterheads/hash.pdf
            const urlParts = originalLetterheadUrl.split('/consultant-documents/');
            if (urlParts.length > 1) {
              const oldPath = urlParts[1];
              await cleanupOldFile(oldPath, letterheadUploadResult.hash, supabase);
            }
          }
        } catch (uploadErr: any) {
          console.error('Letterhead upload error:', uploadErr);
          throw new Error(uploadErr.message || "Failed to upload letterhead. Please try again.");
        }
      }

      // Parse name into first_name, middle_name, last_name
      const nameParts = data.name.trim().split(/\s+/);
      let firstName = "";
      let middleName = "";
      let lastName = "";

      if (nameParts.length === 1) {
        lastName = nameParts[0];
      } else if (nameParts.length === 2) {
        lastName = nameParts[0];
        firstName = nameParts[1];
      } else if (nameParts.length >= 3) {
        lastName = nameParts[0];
        firstName = nameParts[1];
        middleName = nameParts.slice(2).join(" ");
      }

      // Build updated metadata - merge with existing metadata
      const updatedMetadata = {
        ...userMetadata,
        // Update basic fields
        first_name: firstName || userMetadata.first_name,
        middle_name: middleName || userMetadata.middle_name || null,
        last_name: lastName || userMetadata.last_name,
        pan: data.panNo || userMetadata.pan,
        address: data.address || userMetadata.address,
        city: data.city || userMetadata.city,
        pincode: data.zip || userMetadata.pincode,
        email: data.email || userMetadata.email,
        alternate_phone: data.mobile || userMetadata.alternate_phone,
        // Update file URLs if new files were uploaded
        authorized_signatory_photo_url: photoUrl || userMetadata.authorized_signatory_photo_url,
        letterhead_url: letterheadUrlResult || userMetadata.letterhead_url,
      };

      // Get user role from metadata
      const userRole = userMetadata.role || "Owner";

      // Update user metadata via API
      const updateResponse = await fetch('/api/set-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          role: userRole,
          metadata: updatedMetadata
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      // Refresh user metadata in context
      await fetchUserMetadata();
      
      setSubmitSuccess(true);
      
      // Reload the page to reflect changes in all components
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      setSubmitError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        setSubmitError("Please upload an image file for photo");
        if (photoInputRef.current) {
          photoInputRef.current.value = "";
        }
        return;
      }
      
      // Store file for later upload
      setProfilePhotoFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Verify if a file exists at the given URL
  const verifyFileExists = async (fileUrl: string): Promise<boolean> => {
    if (!fileUrl || !fileUrl.startsWith('https://')) {
      return false;
    }
    
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Error verifying file existence:', error);
      return false;
    }
  };


  const handleLetterheadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    
    // Validate it's an image (JPG or PNG)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validImageTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setSubmitError("Please upload a JPG or PNG image file for letterhead");
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      return;
    }

    // Update file state
    setLetterheadFile(file);

    // Create preview URL
    if (letterheadPreviewUrl) {
      URL.revokeObjectURL(letterheadPreviewUrl);
    }
    const fileUrl = URL.createObjectURL(file);
    setLetterheadPreviewUrl(fileUrl);

    // For images, use the preview URL directly as thumbnail
    setLetterheadThumbnail(fileUrl);

    // Always open preview modal when new file is selected
    setTimeout(() => setIsLetterheadModalOpen(true), 0);
  };

  const handleLetterheadThumbnailClick = () => {
    // Always prioritize blob preview URL (newly selected file) over Supabase URL (uploaded file)
    // Blob URLs are for files that haven't been uploaded yet
    const urlToShow = letterheadPreviewUrl || letterheadUrl;
    if (urlToShow) {
      setIsLetterheadModalOpen(true);
    }
  };

  const handleUploadPDFClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (letterheadInputRef.current && !isSubmitting) {
      letterheadInputRef.current.click();
    }
  };

  const handleCloseAttempt = () => {
    // If there are unsaved file uploads, show confirmation dialog
    if (profilePhotoFile || letterheadFile) {
      setShowCloseConfirmation(true);
    } else {
      // No unsaved changes, close directly
      onClose();
    }
  };

  const handleConfirmClose = () => {
    // User confirmed, close the modal
    setShowCloseConfirmation(false);
    onClose();
  };

  const handleCancelClose = () => {
    // User cancelled, just hide the confirmation dialog
    setShowCloseConfirmation(false);
  };

  const handleCloseLetterheadModal = () => {
    setIsLetterheadModalOpen(false);
    // Clean up preview URL when closing (but keep file for upload later)
  };

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  if (!open) return null;

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleCloseAttempt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Modal Container */}
          <motion.div
            className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Success Message */}
              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
                  Profile updated successfully!
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                  {submitError}
                </div>
              )}

              {/* Profile Header Section */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-6 flex-1">
                  {/* Profile Photo with Camera Icon */}
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-4xl font-bold">
                          {userMetadata?.first_name?.[0] || userMetadata?.last_name?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    {/* Camera Icon Overlay */}
                    <label className="absolute bottom-0 right-0 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-700 transition shadow-lg border-4 border-white">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>

                  {/* User Details */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {watch("name") || (userMetadata && userMetadata.first_name && userMetadata.last_name 
                        ? `${userMetadata.first_name} ${userMetadata.last_name}`.trim()
                        : "User Name")}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-emerald-600 mb-3">
                      <span>{watch("console") || userMetadata?.role || "Role"}</span>
                      <span>|</span>
                      <span>{userId || "User ID"}</span>
                    </div>
                    
                    {/* Letterhead Preview and Upload */}
                    <div className="flex items-center gap-3 mt-3">
                      {/* Letterhead Thumbnail */}
                      <div 
                        className={`w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden transition ${
                          (letterheadPreviewUrl || letterheadUrl) 
                            ? 'cursor-pointer hover:bg-gray-300 border-2 border-emerald-500' 
                            : 'cursor-default border-2 border-gray-300'
                        }`}
                        onClick={handleLetterheadThumbnailClick}
                        title={(letterheadPreviewUrl || letterheadUrl) ? "Click to view letterhead" : "No letterhead uploaded"}
                      >
                        {(letterheadPreviewUrl || letterheadUrl) ? (
                          letterheadThumbnail ? (
                            <img 
                              src={letterheadThumbnail} 
                              alt="Letterhead Preview" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                              <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-gray-500 font-medium">Image</span>
                            </div>
                          )
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">Image</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div>
                        <button
                          type="button"
                          onClick={handleUploadPDFClick}
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer disabled:bg-emerald-300 disabled:cursor-not-allowed"
                        >
                          Update Letterhead
                        </button>
                        <input
                          ref={letterheadInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                          onChange={handleLetterheadChange}
                          className="hidden"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleCloseAttempt}
                  className="text-2xl font-bold text-gray-700 hover:text-black ml-4"
                >
                  ×
                </button>
              </div>

              {/* Personal Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">First name</label>
                    <div className="text-base font-semibold text-gray-900">
                      {userMetadata?.first_name || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Last name</label>
                    <div className="text-base font-semibold text-gray-900">
                      {userMetadata?.last_name || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Phone</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("mobile") || userMetadata?.alternate_phone || userMetadata?.mobile || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Title</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("console") || userMetadata?.role || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">PAN No.</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("panNo") || userMetadata?.pan || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">{getRegistrationInfo().label}</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("nmaRegNumber") || getRegistrationInfo().value || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Address</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Country</label>
                    <div className="text-base font-semibold text-gray-900">
                      India
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">City/State</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("city") || userMetadata?.city || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Zip Code</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("zip") || userMetadata?.pincode || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Address</label>
                    <div className="text-base font-semibold text-gray-900">
                      {watch("address") || userMetadata?.address || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(profilePhotoFile || letterheadFile) && (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold hover:bg-emerald-700 transition disabled:bg-emerald-300 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={isSubmitting || submitSuccess}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving...
                      </>
                    ) : submitSuccess ? (
                      "Saved!"
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Letterhead Preview Modal */}
    <AnimatePresence>
      {isLetterheadModalOpen && (() => {
        // Determine which URL to use for preview
        // Priority: blob URL (newly selected file) > Supabase URL (uploaded/existing file)
        // Blob URLs (blob:) are for local preview before upload
        // Supabase URLs (https://) are for files already uploaded
        const previewUrl = letterheadPreviewUrl || letterheadUrl;
        
        if (!previewUrl) return null;
        
        // Validate URL format - must be either blob: (local) or https:// (Supabase)
        // Allow any https:// URL to support existing letterheads from userMetadata
        if (!previewUrl.startsWith('blob:') && !previewUrl.startsWith('https://')) {
          console.error('Invalid letterhead preview URL:', previewUrl);
          return null;
        }
        
        return (
          <motion.div
            className="fixed inset-0 z-[10000] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
            onClick={handleCloseLetterheadModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              id="letterhead-modal"
              className="bg-white w-full max-w-5xl rounded-xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -40, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex justify-between items-center p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-black">Letterhead Preview - Assigned Placement Demo</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    This content area should be blank.
                  </p>
                </div>
                <button
                  onClick={handleCloseLetterheadModal}
                  className="text-2xl font-bold text-gray-700 hover:text-black transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-4">
                <div className="border rounded-lg bg-white flex items-center justify-center" style={{ minHeight: "600px" }}>
                  <img 
                    src={previewUrl} 
                    alt="Letterhead" 
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      console.error('Error loading letterhead image:', previewUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>

    {/* Close Confirmation Modal */}
    <AnimatePresence>
      {showCloseConfirmation && (
        <motion.div
          className="fixed inset-0 z-[10000] flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleCancelClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-black">Unsaved Changes</h3>
              <button
                onClick={handleCancelClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>
            
            <p className="text-gray-700 mb-6">
              You have unsaved changes. Are you sure you want to close without saving?
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelClose}
                className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                No
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium shadow hover:bg-red-700 transition"
              >
                Yes, Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default ProfileModal;

