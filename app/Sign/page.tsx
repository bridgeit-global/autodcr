"use client";

import React, { useState, useRef, useEffect } from "react";
import { Viewer, Worker, RenderPageProps } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// Set up pdfjs worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
}

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  pageWidth: number; // PDF page width in points
  pageHeight: number; // PDF page height in points
  scale: number; // Scale at which the page was displayed
  viewportWidth: number; // Viewport width in pixels
  viewportHeight: number; // Viewport height in pixels
}

interface Signature {
  id: string;
  image: string; // base64 or data URL
  position: SignaturePosition;
}

const DigitalSignaturePage: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSignatureMode, setIsSignatureMode] = useState(false);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [signatureArea, setSignatureArea] = useState<SignaturePosition | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null); // Store signed PDF blob
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  // Store page render info for coordinate conversion
  const [pageRenderInfo, setPageRenderInfo] = useState<Map<number, { width: number; height: number; scale: number; viewportWidth: number; viewportHeight: number }>>(new Map());

  // Handle PDF file selection
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      // Clean up old signed PDF blob if exists
      setSignedPdfBlob(null);
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setIsSignatureMode(false);
      setSignatures([]);
      setSignatureArea(null);
    }
  };

  // Helper function to handle PDF file directly (for drag-and-drop)
  const handlePdfFile = (file: File) => {
    if (file && file.type === "application/pdf") {
      // Clean up old signed PDF blob if exists
      setSignedPdfBlob(null);
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setIsSignatureMode(false);
      setSignatures([]);
      setSignatureArea(null);
    }
  };

  // Handle signature image selection
  const handleSignatureImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Support both image files and SVG files
      if (file.type.startsWith("image/") || file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageDataUrl = reader.result as string;
          
          // Capture current signature area before state updates
          const currentArea = signatureArea;
          const currentMode = isSignatureMode;
          
          console.log("Signature image loaded:", { 
            hasArea: !!currentArea, 
            isMode: currentMode,
            area: currentArea 
          });
          
          // If area is already selected, place signature immediately
          if (currentArea && currentMode && imageDataUrl) {
            // Set the image temporarily
            setSignatureImage(imageDataUrl);
            
            // Use a timeout to ensure image state is set
            setTimeout(() => {
              // Use functional update to access latest state
              setSignatures((prev) => {
                // Create new signature with captured area and image
                const finalArea = { ...currentArea };
                if (finalArea.width < 50) finalArea.width = 150;
                if (finalArea.height < 30) finalArea.height = 60;
                
                const newSignature: Signature = {
                  id: Date.now().toString(),
                  image: imageDataUrl,
                  position: finalArea,
                };
                
                console.log("Adding signature to state:", newSignature);
                return [...prev, newSignature];
              });
              
              // Reset state
              setSignatureArea(null);
              setIsSignatureMode(false);
              setSignatureImage(null);
              if (signatureInputRef.current) {
                signatureInputRef.current.value = "";
              }
              
              console.log("Signature placed successfully!");
            }, 300);
          } else {
            // No area selected yet - prompt user to select area first
            alert("Please select an area on the PDF first!\n\nClick 'Add Signature' button, then drag on the PDF to select where you want to place the signature.");
            // Store the image temporarily so they can use it after selecting area
            setSignatureImage(imageDataUrl);
            // Enable area selection mode
            if (!currentMode) {
              setIsSignatureMode(true);
              setIsSelectingArea(true);
            }
            // Clear the file input so they can select it again after selecting area
            if (signatureInputRef.current) {
              signatureInputRef.current.value = "";
            }
          }
        };
        reader.onerror = (error) => {
          console.error("Error reading signature file:", error);
          alert("Error reading signature file. Please try again.");
        };
        reader.readAsDataURL(file);
      } else {
        alert("Please select an image file (PNG, JPG, SVG, etc.)");
      }
    }
  };

  // Handle drag and drop for signature file
  const handleSignatureDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/") || file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageDataUrl = reader.result as string;
          const currentArea = signatureArea;
          const currentMode = isSignatureMode;
          
          // If area is already selected, place signature immediately
          if (currentArea && currentMode) {
            setSignatureImage(imageDataUrl);
            setTimeout(() => {
              placeSignatureInSelectedArea();
            }, 200);
          } else {
            // No area selected - prompt user
            alert("Please select an area on the PDF first!\n\nClick 'Add Signature' button, then drag on the PDF to select where you want to place the signature.");
            setSignatureImage(imageDataUrl);
            if (!currentMode) {
              setIsSignatureMode(true);
              setIsSelectingArea(true);
            }
          }
        };
        reader.onerror = (error) => {
          console.error("Error reading dropped signature file:", error);
          alert("Error reading signature file. Please try again.");
        };
        reader.readAsDataURL(file);
      } else if (file.type === "application/pdf") {
        // If PDF dropped, treat it as PDF document
        handlePdfFile(file);
      }
    }
  };

  const handleSignatureDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Start signature placement mode - just enable area selection
  const handleAddSignature = () => {
    if (!pdfUrl) {
      alert("Please upload a PDF first");
      return;
    }
    // Clear any previous signature image and area
    setSignatureImage(null);
    setSignatureArea(null);
    setIsSignatureMode(true);
    setIsSelectingArea(true);
  };

  // Handle mouse down for area selection
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !isSignatureMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startPosRef.current = { x, y };
    
    // Get page info and viewport dimensions
    const info = pageRenderInfo.get(currentPage);
    let viewportWidth = rect.width;
    let viewportHeight = rect.height;
    
    // Try to get actual canvas dimensions for more accurate viewport
    const pageContainer = document.querySelector(`[data-page-number="${currentPage + 1}"]`);
    if (pageContainer) {
      const canvas = pageContainer.querySelector('canvas');
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        viewportWidth = canvasRect.width || viewportWidth;
        viewportHeight = canvasRect.height || viewportHeight;
      }
    }
    
    // Ensure viewport dimensions are valid
    if (viewportWidth <= 0) viewportWidth = rect.width || 612;
    if (viewportHeight <= 0) viewportHeight = rect.height || 792;
    
    if (info && info.width > 0 && info.height > 0) {
      setSignatureArea({
        x,
        y,
        width: 0,
        height: 0,
        pageIndex: currentPage,
        pageWidth: info.width,
        pageHeight: info.height,
        scale: info.scale || 1,
        viewportWidth,
        viewportHeight,
      });
    } else {
      // Fallback: try to get actual PDF page dimensions
      if (pdfFile) {
        // Use the page render info map which should have actual dimensions
        const fallbackInfo = Array.from(pageRenderInfo.values())[0];
      if (fallbackInfo && fallbackInfo.width > 0) {
          setSignatureArea({
            x,
            y,
            width: 0,
            height: 0,
            pageIndex: currentPage,
            pageWidth: fallbackInfo.width,
            pageHeight: fallbackInfo.height,
            scale: 1,
            viewportWidth,
            viewportHeight,
          });
        } else {
          // Last resort fallback
          setSignatureArea({
            x,
            y,
            width: 0,
            height: 0,
            pageIndex: currentPage,
            pageWidth: 612,
            pageHeight: 792,
            scale: 1,
            viewportWidth,
            viewportHeight,
          });
        }
      } else {
        // No PDF file - shouldn't happen, but just in case
        setSignatureArea({
          x,
          y,
          width: 0,
          height: 0,
          pageIndex: currentPage,
          pageWidth: 612,
          pageHeight: 792,
          scale: 1,
          viewportWidth,
          viewportHeight,
        });
      }
    }
  };

  // Handle mouse move for area selection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !isSignatureMode || !startPosRef.current || !signatureArea) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Calculate width and height
    let width = Math.abs(currentX - startPosRef.current.x);
    let height = Math.abs(currentY - startPosRef.current.y);
    
    // Ensure minimum size
    if (width < 10) width = 10;
    if (height < 10) height = 10;
    
    const x = Math.min(startPosRef.current.x, currentX);
    const y = Math.min(startPosRef.current.y, currentY);
    
    setSignatureArea({
      ...signatureArea,
      x,
      y,
      width,
      height,
    });
  };

  // Handle mouse up to complete area selection
  const handleMouseUp = () => {
    if (!isSelectingArea || !isSignatureMode || !startPosRef.current) {
      if (startPosRef.current) {
        startPosRef.current = null;
      }
      return;
    }
    
    setIsSelectingArea(false);
    
    // Check if we have a valid signature area
    if (signatureArea) {
      let finalArea = { ...signatureArea };
      
      // If area is too small, set minimum dimensions
      if (finalArea.width < 50) {
        finalArea.width = 150; // Default width
      }
      if (finalArea.height < 30) {
        finalArea.height = 60; // Default height
      }
      
      // Update the signature area with final dimensions
      setSignatureArea(finalArea);
      
      // Now prompt user to upload signature image
      // Focus on the signature input or show a message
      if (signatureInputRef.current) {
        signatureInputRef.current.click();
      }
      
      console.log("Area selected, waiting for signature upload:", finalArea);
    }
    
    startPosRef.current = null;
  };
  
  // Place signature in the selected area after upload
  const placeSignatureInSelectedArea = () => {
    if (!signatureArea || !signatureImage) {
      console.log("Cannot place signature - missing area or image", { signatureArea, signatureImage: !!signatureImage });
      return;
    }
    
    const finalArea = { ...signatureArea };
    
    // Ensure minimum dimensions
    if (finalArea.width < 50) finalArea.width = 150;
    if (finalArea.height < 30) finalArea.height = 60;
    
    // Add signature to the list
    const newSignature: Signature = {
      id: Date.now().toString(),
      image: signatureImage,
      position: finalArea,
    };
    
    setSignatures((prev) => {
      const updated = [...prev, newSignature];
      console.log("Signature added to state:", newSignature, "Total signatures:", updated.length);
      return updated;
    });
    
    // Reset for next signature (but keep signature in state)
    setSignatureArea(null);
    setIsSignatureMode(false);
    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
    
    // Clear signature image state (but keep it in signatures array)
    setTimeout(() => {
      setSignatureImage(null);
    }, 100);
    
    console.log("Signature placed in selected area:", newSignature);
  };

  // Helper function to convert SVG to PNG
  const convertSvgToPng = (svgDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          // Use natural width/height if available, otherwise use defaults
          const width = img.naturalWidth || img.width || 300;
          const height = img.naturalHeight || img.height || 150;
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          
          // Draw the image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to PNG
          const pngDataUrl = canvas.toDataURL("image/png");
          
          if (!pngDataUrl || pngDataUrl === "data:,") {
            reject(new Error("Failed to convert SVG to PNG data URL"));
            return;
          }
          
          resolve(pngDataUrl);
        } catch (error) {
          reject(new Error(`Error converting SVG: ${error instanceof Error ? error.message : String(error)}`));
        }
      };
      
      img.onerror = (error) => {
        reject(new Error(`Failed to load SVG image: ${error instanceof Event ? (error.target as HTMLImageElement)?.src : 'Unknown error'}`));
      };
      
      // Set crossOrigin to anonymous to handle CORS issues
      img.crossOrigin = "anonymous";
      img.src = svgDataUrl;
    });
  };

  // Apply signature to PDF
  const applySignatureToPdf = async (): Promise<Blob | null> => {
    if (!pdfFile || signatures.length === 0) {
      alert("Please upload a PDF and add at least one signature");
      return null;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      let successCount = 0;
      let errorCount = 0;
      const errorMessages: string[] = [];

      for (const signature of signatures) {
        try {
          const page = pages[signature.position.pageIndex];
          if (!page) {
            const errorMsg = `Page ${signature.position.pageIndex + 1} not found (total pages: ${pages.length})`;
            console.warn(errorMsg);
            errorMessages.push(errorMsg);
            errorCount++;
            continue;
          }

          // Get actual PDF page dimensions
          const { width: actualPageWidth, height: actualPageHeight } = page.getSize();
          
          // Use stored page dimensions from when signature was placed
          const { pageWidth, pageHeight, viewportWidth, viewportHeight } = signature.position;
          
          // Validate viewport dimensions - if invalid, use default calculation
          let scaleX, scaleY;
          if (viewportWidth > 0 && viewportHeight > 0) {
            // Calculate scale factor: how many PDF points per viewport pixel
            scaleX = pageWidth / viewportWidth;
            scaleY = pageHeight / viewportHeight;
          } else {
            // Fallback: estimate from page dimensions
            console.warn("Invalid viewport dimensions, using fallback calculation");
            // Find the actual rendered canvas to get viewport size
            const pageContainer = document.querySelector(`[data-page-number="${signature.position.pageIndex + 1}"]`);
            if (pageContainer) {
              const canvas = pageContainer.querySelector('canvas');
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const estimatedViewportWidth = rect.width || 612;
                const estimatedViewportHeight = rect.height || 792;
                scaleX = actualPageWidth / estimatedViewportWidth;
                scaleY = actualPageHeight / estimatedViewportHeight;
              } else {
                // Last resort: use default scale
                scaleX = actualPageWidth / 612;
                scaleY = actualPageHeight / 792;
              }
            } else {
              scaleX = actualPageWidth / 612;
              scaleY = actualPageHeight / 792;
            }
          }
          
          // Convert screen coordinates to PDF coordinates
          // PDF coordinates start from bottom-left (0,0 is bottom-left)
          // Screen coordinates start from top-left (0,0 is top-left)
          const pdfX = signature.position.x * scaleX;
          const pdfY = actualPageHeight - (signature.position.y * scaleY) - (signature.position.height * scaleY);
          const pdfWidth = signature.position.width * scaleX;
          const pdfHeight = signature.position.height * scaleY;

          console.log("Embedding signature:", {
            pageIndex: signature.position.pageIndex,
            screenCoords: { x: signature.position.x, y: signature.position.y, w: signature.position.width, h: signature.position.height },
            pdfCoords: { x: pdfX, y: pdfY, w: pdfWidth, h: pdfHeight },
            scale: { x: scaleX, y: scaleY },
            pageSize: { w: actualPageWidth, h: actualPageHeight }
          });

          // Load and embed the signature image
          let image;
          let imageDataUrl = signature.image;
          
          // Convert SVG to PNG if needed
          if (imageDataUrl.includes("svg") || imageDataUrl.startsWith("data:image/svg")) {
            try {
              console.log("Converting SVG to PNG...");
              imageDataUrl = await convertSvgToPng(imageDataUrl);
              console.log("SVG converted successfully");
            } catch (svgError) {
              const errorMsg = `Failed to convert SVG to PNG: ${svgError instanceof Error ? svgError.message : String(svgError)}`;
              console.error(errorMsg, svgError);
              errorMessages.push(errorMsg);
              errorCount++;
              continue;
            }
          }
          
          try {
            console.log("Fetching signature image from data URL...");
            const response = await fetch(imageDataUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const imageBytes = await response.arrayBuffer();
            console.log("Image bytes loaded:", imageBytes.byteLength, "bytes");
            
            // Try PNG first, then JPG
            try {
              image = await pdfDoc.embedPng(imageBytes);
              console.log("Successfully embedded PNG");
            } catch (pngError) {
              console.log("PNG embedding failed, trying JPG...", pngError);
              try {
                image = await pdfDoc.embedJpg(imageBytes);
                console.log("Successfully embedded JPG");
              } catch (jpgError) {
                const errorMsg = `Failed to embed image as PNG or JPG. PNG error: ${pngError instanceof Error ? pngError.message : String(pngError)}. JPG error: ${jpgError instanceof Error ? jpgError.message : String(jpgError)}`;
                console.error(errorMsg, { pngError, jpgError });
                errorMessages.push(errorMsg);
                errorCount++;
                continue;
              }
            }
          } catch (error) {
            const errorMsg = `Error loading signature image: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg, error);
            errorMessages.push(errorMsg);
            errorCount++;
            continue;
          }
          
          if (!image) {
            const errorMsg = "Failed to load signature image - image object is null";
            console.warn(errorMsg);
            errorMessages.push(errorMsg);
            errorCount++;
            continue;
          }

          // Validate coordinates are reasonable
          if (isNaN(pdfX) || isNaN(pdfY) || isNaN(pdfWidth) || isNaN(pdfHeight)) {
            const errorMsg = `Invalid coordinates: x=${pdfX}, y=${pdfY}, w=${pdfWidth}, h=${pdfHeight}`;
            console.error(errorMsg);
            errorMessages.push(errorMsg);
            errorCount++;
            continue;
          }

          // Add image to page
          console.log("Drawing image on PDF page:", {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight
          });
          
          page.drawImage(image, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
          });
          
          successCount++;
          console.log("Signature successfully added to page");
        } catch (error) {
          const errorMsg = `Error processing signature ${signature.id}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg, error);
          errorMessages.push(errorMsg);
          errorCount++;
        }
      }

      if (successCount === 0) {
        const errorDetails = errorMessages.length > 0 
          ? `\n\nError details:\n${errorMessages.join('\n')}`
          : '';
        alert(`Failed to apply any signatures. Errors: ${errorCount}${errorDetails}\n\nPlease check the browser console (F12) for more details.`);
        console.error("All signatures failed. Errors:", errorMessages);
        return null;
      }

      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const uint8Array = new Uint8Array(pdfBytes);
      const blob = new Blob([uint8Array], { type: "application/pdf" });
      
      // Store the signed PDF blob for downloading
      setSignedPdfBlob(blob);
      
      // Create a URL for the signed PDF to display in viewer
      const url = URL.createObjectURL(blob);
      
      // Update the PDF URL and file (revoke old URL first)
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(url);
      
      // Create a new File object for download
      const newFile = new File([blob], pdfFile.name.replace(".pdf", "_signed.pdf"), {
        type: "application/pdf",
      });
      setPdfFile(newFile);
      
      console.log("Signed PDF created:", {
        blobSize: blob.size,
        successCount,
        errorCount
      });
      
      alert(`Signatures applied successfully! ${successCount} signature(s) embedded. ${errorCount > 0 ? `(${errorCount} error(s))` : ''} You can now download the signed PDF.`);
      
      // Return the blob so it can be used immediately for download
      return blob;
    } catch (error) {
      console.error("Error applying signature:", error);
      alert(`Error applying signature: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Download signed PDF
  const handleDownload = async () => {
    let blobToDownload: Blob | null = null;
    let fileName = pdfFile?.name || "document.pdf";
    
    // If signatures haven't been applied yet, apply them first
    if (!signedPdfBlob && signatures.length > 0) {
      const apply = confirm("Signatures haven't been applied to the PDF yet. Would you like to apply them now and then download?");
      if (apply) {
        // Apply signatures and get the blob directly
        blobToDownload = await applySignatureToPdf();
        
        if (!blobToDownload) {
          alert("Failed to apply signatures. Please try again.");
          return;
        }
        
        fileName = pdfFile?.name.replace(".pdf", "_signed.pdf") || "signed_document.pdf";
      } else {
        return;
      }
    } else if (signedPdfBlob) {
      // Use already signed PDF blob
      blobToDownload = signedPdfBlob;
      fileName = pdfFile?.name.replace(".pdf", "_signed.pdf") || "signed_document.pdf";
    } else if (pdfUrl) {
      // Fallback: download from URL (original PDF without signatures)
      try {
        const response = await fetch(pdfUrl);
        blobToDownload = await response.blob();
        fileName = pdfFile?.name || "document.pdf";
        
        if (signatures.length > 0) {
          console.warn("Downloading PDF without applied signatures. Please click 'Apply Signatures to PDF' first.");
        }
      } catch (error) {
        console.error("Error downloading PDF:", error);
        alert("Error downloading PDF. Please try again.");
        return;
      }
    } else {
      alert("No PDF available to download.");
      return;
    }
    
    if (!blobToDownload) {
      alert("No PDF available to download.");
      return;
    }
    
    // Create download link
    const url = URL.createObjectURL(blobToDownload);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL after download
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log("PDF downloaded:", fileName, "Size:", blobToDownload.size, "bytes");
  };

  // Clear all signatures
  const clearSignatures = () => {
    setSignatures([]);
    setSignatureArea(null);
    setSignatureImage(null);
    setIsSignatureMode(false);
    setIsSelectingArea(false);
  };

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  // Load PDF to get actual page dimensions
  useEffect(() => {
    const loadPageDimensions = async () => {
      if (!pdfFile) return;
      
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        
        const newPageInfo = new Map<number, { width: number; height: number; scale: number; viewportWidth: number; viewportHeight: number }>();
        
        pages.forEach((page, index) => {
          const { width, height } = page.getSize();
          newPageInfo.set(index, {
            width,
            height,
            scale: 1,
            viewportWidth: 0,
            viewportHeight: 0,
          });
        });
        
        setPageRenderInfo(newPageInfo);
      } catch (error) {
        console.error("Error loading PDF dimensions:", error);
      }
    };
    
    loadPageDimensions();
  }, [pdfFile]);

  // Debug: Log when signatures change
  useEffect(() => {
    console.log("Signatures state updated:", signatures.length, "signatures");
    signatures.forEach((sig, index) => {
      console.log(`Signature ${index + 1}:`, {
        id: sig.id,
        page: sig.position.pageIndex,
        x: sig.position.x,
        y: sig.position.y,
        width: sig.position.width,
        height: sig.position.height,
        hasImage: !!sig.image
      });
    });
  }, [signatures]);

  const renderPage = (props: RenderPageProps) => {
    const { canvasLayer, textLayer, annotationLayer, scale } = props;
    const pageNumber = props.pageIndex + 1;
    
    return (
      <>
        {canvasLayer.children}
        {textLayer.children}
        {annotationLayer.children}
        
        {/* Signature overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: isSelectingArea ? "auto" : "none",
            zIndex: 25,
            overflow: "visible",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Render existing signatures */}
          {signatures
            .filter((sig) => sig.position.pageIndex === props.pageIndex)
            .map((signature) => {
              console.log("Rendering signature on page:", props.pageIndex, signature);
              return (
                <div
                  key={signature.id}
                  style={{
                    position: "absolute",
                    left: `${signature.position.x}px`,
                    top: `${signature.position.y}px`,
                    width: `${signature.position.width}px`,
                    height: `${signature.position.height}px`,
                    pointerEvents: "none",
                    border: "2px solid #3b82f6",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    zIndex: 30,
                    boxSizing: "border-box",
                  }}
                >
                  <img
                    src={signature.image}
                    alt="Signature"
                    onLoad={() => console.log("Signature image loaded:", signature.id)}
                    onError={(e) => {
                      console.error("Error loading signature image:", signature.id, e);
                      e.currentTarget.style.display = "none";
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
              );
            })}
          
          {/* Selection area - show while dragging */}
          {signatureArea && signatureArea.pageIndex === props.pageIndex && isSelectingArea && (
            <div
              ref={selectionRef}
              style={{
                position: "absolute",
                left: `${signatureArea.x}px`,
                top: `${signatureArea.y}px`,
                width: `${Math.max(signatureArea.width, 50)}px`,
                height: `${Math.max(signatureArea.height, 30)}px`,
                border: "2px dashed #3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                pointerEvents: "none",
              }}
            >
              {signatureImage && (
                <img
                  src={signatureImage}
                  alt="Signature preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Digital Signature</h1>
        
        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload PDF Document
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            
            <div 
              className={`flex-1 ${signatureArea && isSignatureMode ? 'ring-2 ring-green-500 rounded-lg p-3 bg-green-50' : ''}`}
              onDrop={handleSignatureDrop}
              onDragOver={handleSignatureDragOver}
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {signatureArea && isSignatureMode 
                  ? "✓ Upload Signature Image (Required)" 
                  : signatureImage && isSignatureMode
                  ? "⚠️ Please select area first, then upload signature"
                  : "Select Signature Image (or drag & drop)"}
              </label>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*,.svg"
                onChange={handleSignatureImageChange}
                disabled={!signatureArea && isSignatureMode}
                className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold ${
                  signatureArea && isSignatureMode 
                    ? 'file:bg-green-100 file:text-green-700 hover:file:bg-green-200' 
                    : (!signatureArea && isSignatureMode)
                    ? 'file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 opacity-50'
                    : 'file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                }`}
              />
              <p className={`text-xs mt-1 ${
                signatureArea && isSignatureMode 
                  ? 'text-green-700 font-medium' 
                  : (!signatureArea && isSignatureMode)
                  ? 'text-yellow-700 font-medium'
                  : 'text-gray-500'
              }`}>
                {signatureArea && isSignatureMode 
                  ? "✓ Upload now - signature will be placed in the selected area automatically!" 
                  : (!signatureArea && isSignatureMode)
                  ? "⚠️ First select an area on the PDF, then upload your signature"
                  : "Supports: PNG, JPG, SVG, etc. (Select area on PDF first)"}
              </p>
            </div>
          </div>
          
          {signatureImage && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Selected Signature:</p>
              <img
                src={signatureImage}
                alt="Signature preview"
                className="max-w-xs max-h-32 border border-gray-300 rounded"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-3">
          <button
            onClick={handleAddSignature}
            disabled={!pdfUrl || (isSignatureMode && !!signatureArea)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSelectingArea && !signatureArea 
              ? "Click and drag on PDF to select area" 
              : isSignatureMode && signatureArea
              ? "Area Selected - Upload Signature Below"
              : "Add Signature"}
          </button>
          
          {signatureArea && isSignatureMode && (
            <button
              onClick={() => {
                setSignatureArea(null);
                setIsSignatureMode(false);
                setIsSelectingArea(false);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Cancel Selection
            </button>
          )}
          
          <button
            onClick={applySignatureToPdf}
            disabled={signatures.length === 0 || isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Apply Signatures to PDF"}
          </button>
          
          <button
            onClick={handleDownload}
            disabled={!pdfUrl || signatures.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title={!signedPdfBlob && signatures.length > 0 ? "Click to apply signatures first, then download" : "Download the signed PDF"}
          >
            {signedPdfBlob ? "Download Signed PDF" : signatures.length > 0 ? "Apply & Download PDF" : "Download Signed PDF"}
          </button>
          
          <button
            onClick={clearSignatures}
            disabled={signatures.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Clear All Signatures
          </button>
        </div>

        {/* Instructions */}
        {!isSignatureMode && !signatureArea && signatures.length === 0 && pdfUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium mb-2">
              📍 How to add a signature:
            </p>
            <ol className="text-blue-700 text-sm list-decimal list-inside space-y-1">
              <li>Click the <strong>"Add Signature"</strong> button below</li>
              <li>Click and drag on the PDF to <strong>select the area</strong> where you want the signature</li>
              <li>Upload your signature image file - it will be placed automatically in the selected area</li>
            </ol>
          </div>
        )}
        
        {isSelectingArea && !signatureArea && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">
              Step 1: Select where you want to place the signature on the PDF
            </p>
            <p className="text-blue-700 text-sm mt-1">
              • Click and drag on the PDF to select the area where your signature should appear
              • Release the mouse button when you're done selecting the area
            </p>
          </div>
        )}
        
        {signatureArea && isSignatureMode && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              ✓ Area selected! Now upload your signature image
            </p>
            <p className="text-green-700 text-sm mt-1">
              • Click "Choose Signature File" below to upload your signature image
              • Or drag and drop your signature file onto the upload area
              • The signature will be placed automatically in the selected area
            </p>
          </div>
        )}
        
        {signatures.length > 0 && !isSelectingArea && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              ✓ {signatures.length} signature{signatures.length > 1 ? 's' : ''} ready to apply!
            </p>
            <p className="text-green-700 text-sm mt-1">
              Click "Apply Signatures to PDF" to embed them permanently, then download the signed PDF.
            </p>
          </div>
        )}

        {/* PDF Viewer */}
        {pdfUrl && (
          <div 
            className="bg-white rounded-lg shadow-md p-6" 
            ref={containerRef}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && (file.type.startsWith("image/") || file.name.endsWith(".svg"))) {
                // If area is already selected, place signature directly
                if (signatureArea && isSignatureMode) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const imageDataUrl = reader.result as string;
                    setSignatureImage(imageDataUrl);
                    setTimeout(() => {
                      placeSignatureInSelectedArea();
                    }, 100);
                  };
                  reader.readAsDataURL(file);
                } else {
                  // Otherwise, just load the signature and wait for area selection
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setSignatureImage(reader.result as string);
                    // Auto-trigger area selection mode
                    setIsSignatureMode(true);
                    setIsSelectingArea(true);
                  };
                  reader.readAsDataURL(file);
                }
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <div 
                style={{ 
                  height: "800px", 
                  position: "relative",
                  cursor: isSelectingArea ? "crosshair" : "default",
                }}
              >
                <Viewer
                  fileUrl={pdfUrl}
                  plugins={[defaultLayoutPluginInstance]}
                  defaultScale={1.0}
                  renderPage={renderPage}
                  onPageChange={(e) => setCurrentPage(e.currentPage)}
                />
              </div>
            </Worker>
            
            {signatures.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">
                  ✓ Signatures added: {signatures.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {signatures.map((sig, index) => (
                    <div
                      key={sig.id}
                      className="text-xs bg-white px-2 py-1 rounded border border-green-300"
                    >
                      Signature {index + 1} - Page {sig.position.pageIndex + 1} 
                      <span className="ml-1 text-green-600">●</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-700 mt-2">
                  Signatures are displayed on the PDF. Click "Apply Signatures to PDF" to embed them permanently.
                </p>
              </div>
            )}
          </div>
        )}

        {!pdfUrl && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">
              Please upload a PDF document to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DigitalSignaturePage;

