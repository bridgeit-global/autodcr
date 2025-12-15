'use client';

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { uploadFileIdempotent, cleanupOldFile } from "@/app/utils/fileUtils";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("./PDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

const PDFViewerWithErrorHandling = dynamic(() => import("./PDFViewerWithErrorHandling"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

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
    setValue
  } = useForm<FormValues>();

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
            
            // Try to generate thumbnail for existing letterhead
            generatePDFThumbnail(existingLetterheadUrl).then((thumbnail) => {
              if (thumbnail) {
                setLetterheadThumbnail(thumbnail);
                setOriginalLetterheadThumbnail(thumbnail);
              } else {
                setLetterheadThumbnail(null);
                setOriginalLetterheadThumbnail(null);
              }
            }).catch((error) => {
              console.warn('Failed to generate letterhead thumbnail:', error);
              setLetterheadThumbnail(null);
              setOriginalLetterheadThumbnail(null);
            });
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
          
          // Verify the URL is valid
          if (!letterheadUploadResult.url || !letterheadUploadResult.url.endsWith('.pdf')) {
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

  // Generate thumbnail from PDF
  const generatePDFThumbnail = async (pdfUrl: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    
    try {
      // Dynamically import pdfjs-dist
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1); // Get first page

      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating PDF thumbnail:', error);
      return null;
    }
  };

  const handleLetterheadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    
    // Validate it's a PDF
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setSubmitError("Please upload a PDF file for letterhead");
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

    // Generate thumbnail
    const thumbnail = await generatePDFThumbnail(fileUrl);
    if (thumbnail) {
      if (letterheadThumbnail && letterheadThumbnail.startsWith('data:image')) {
        // Clean up old thumbnail if it was a data URL
        URL.revokeObjectURL(letterheadThumbnail);
      }
      setLetterheadThumbnail(thumbnail);
    }

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

              {/* General Information Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-black">General Information</h3>
                  <button
                    onClick={handleCloseAttempt}
                    className="text-2xl font-bold text-gray-700 hover:text-black"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-black mb-1">
                      Name:
                    </label>
                    <input
                      {...register("name", { required: "Name is required" })}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Console:
                    </label>
                    <input
                      {...register("console")}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      PAN No.:
                    </label>
                    <input
                      {...register("panNo", {
                        pattern: {
                          value: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
                          message: "PAN must be 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)"
                        }
                      })}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed uppercase"
                      placeholder="ABCDE1234F"
                      disabled={true}
                    />
                    {errors.panNo && (
                      <p className="text-red-600 text-sm mt-1">{errors.panNo.message}</p>
                    )}
                  </div>
                </div>

                {/* Profile Photo and Letterhead */}
                <div className="flex items-center gap-4 mt-4">
                  {/* Profile Photo */}
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                          {userMetadata?.first_name?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={`inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition cursor-pointer ${
                        isSubmitting 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-blue-700'
                      }`}>
                        Upload Photo
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
                  </div>

                  {/* Letterhead PDF */}
                  <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-300">
                    <div 
                      className={`w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden transition ${
                        (letterheadPreviewUrl || letterheadUrl) 
                          ? 'cursor-pointer hover:bg-gray-300' 
                          : 'cursor-default'
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
                          <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                            <svg className="w-12 h-12 text-red-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-red-600 font-medium">PDF</span>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <svg className="w-12 h-12 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">PDF</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleUploadPDFClick}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Upload PDF
                      </button>
                      <input
                        ref={letterheadInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleLetterheadChange}
                        className="hidden"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-black mb-4">Contact Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block font-medium text-black mb-1">
                      Address:
                    </label>
                    <input
                      {...register("address")}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      City:
                    </label>
                    <input
                      {...register("city")}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Zip Code:
                    </label>
                    <input
                      {...register("zip", {
                        pattern: {
                          value: /^\d{6}$/,
                          message: "Zip code must be 6 digits"
                        }
                      })}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="123456"
                      maxLength={6}
                      disabled={true}
                    />
                    {errors.zip && (
                      <p className="text-red-600 text-sm mt-1">{errors.zip.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Email:
                    </label>
                    <input
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Invalid email address"
                        }
                      })}
                      type="email"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                    {errors.email && (
                      <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Mobile:
                    </label>
                    <input
                      {...register("mobile", {
                        pattern: {
                          value: /^\d{10}$/,
                          message: "Mobile number must be exactly 10 digits"
                        }
                      })}
                      type="tel"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="9876543210"
                      maxLength={10}
                      disabled={true}
                    />
                    {errors.mobile && (
                      <p className="text-red-600 text-sm mt-1">{errors.mobile.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      {getRegistrationInfo().label}
                    </label>
                    <input
                      {...register("nmaRegNumber")}
                      type="text"
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={true}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(profilePhotoFile || letterheadFile) && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    This is a demo showing where your letterhead will be placed in the system.
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
                <div className="border rounded-lg bg-white" style={{ minHeight: "600px" }}>
                  {previewUrl.startsWith('blob:') ? (
                    // Blob URL - always valid (local file)
                    <PDFViewer fileUrl={previewUrl} />
                  ) : (
                    // Supabase URL - wrap in error boundary/fallback
                    <PDFViewerWithErrorHandling fileUrl={previewUrl} />
                  )}
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

