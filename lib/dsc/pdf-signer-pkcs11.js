const crypto = require('crypto');
const forge = require('node-forge');
const { PDFDocument, PDFName, PDFDict, PDFHexString, PDFString, PDFArray, PDFNumber, PDFRef, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

// Constants for signature
const DEFAULT_SIGNATURE_LENGTH = 8192;
const DEFAULT_BYTE_RANGE_PLACEHOLDER = '/ByteRange [0 /********** /********** /**********]';
const SUBFILTER_ADOBE_PKCS7_DETACHED = 'adbe.pkcs7.detached';

/**
 * PDF Signer using PKCS#11 (hardware token)
 * Creates proper embedded PDF signatures with visible signature field
 * Supports Adobe Reader verification
 */
class PDFSignerPKCS11 {
    
    /**
     * Extract certificate details for display
     */
    extractCertificateDetails(cert) {
        const details = {};
        
        // Extract all subject attributes
        if (cert.subject && cert.subject.attributes) {
            for (const attr of cert.subject.attributes) {
                const name = attr.shortName || attr.name || attr.type;
                if (attr.value) {
                    // Map OIDs to readable names
                    if (attr.type === '2.5.4.12') {
                        details['title'] = attr.value;
                    } else if (attr.type === '2.5.4.65') {
                        details['pseudonym'] = attr.value;
                    } else if (attr.type === '2.5.4.17') {
                        details['postalCode'] = attr.value;
                    } else if (attr.type === '2.5.4.5') {
                        details['serialNumber'] = attr.value;
                    } else if (attr.type === '2.5.4.20') {
                        details['2.5.4.20'] = attr.value;
                    } else if (name) {
                        details[name] = attr.value;
                    }
                }
            }
        }
        
        // Map common names
        if (details.countryName) details.C = details.countryName;
        if (details.organizationName) details.O = details.organizationName;
        if (details.stateOrProvinceName) details.ST = details.stateOrProvinceName;
        if (details.commonName) details.CN = details.commonName;
        
        return details;
    }
    
    /**
     * Build DN string from certificate details
     */
    buildDNString(details) {
        const parts = [];
        
        if (details.C) parts.push(`c=${details.C}`);
        if (details.O) parts.push(`o=${details.O}`);
        if (details.title) parts.push(`title=${details.title}`);
        if (details.pseudonym) parts.push(`pseudonym=${details.pseudonym}`);
        if (details.postalCode) parts.push(`postalCode=${details.postalCode}`);
        if (details.ST) parts.push(`st=${details.ST}`);
        if (details.serialNumber) parts.push(`serialNumber=${details.serialNumber}`);
        if (details.CN) parts.push(`cn=${details.CN}`);
        
        return parts.join(', ');
    }
    
    /**
     * Format date for signature display
     */
    formatSignatureDate(date) {
        const pad = (n) => String(n).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        
        // Get timezone offset
        const offset = -date.getTimezoneOffset();
        const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
        const offsetMinutes = pad(Math.abs(offset) % 60);
        const offsetSign = offset >= 0 ? '+' : '-';
        
        return `${year}.${month}.${day} ${hours}:${minutes}:${seconds} ${offsetSign}${offsetHours}'${offsetMinutes}'`;
    }
    
    /**
     * Add visible signature appearance to PDF
     * Style: Left side has bold name, Right side has signature details
     * Dynamically adjusts size based on name length
     */
    async addVisibleSignature(pdfDoc, cert, options = {}) {
        const pages = pdfDoc.getPages();
        const pageIndex = options.pageIndex !== undefined ? options.pageIndex : pages.length - 1;
        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Extract certificate details first to calculate dimensions
        const details = this.extractCertificateDetails(cert);
        const cn = details.CN || details.commonName || 'Digital Signature';
        const signDate = this.formatSignatureDate(new Date());
        
        // Split name into parts for multi-line display on left
        const nameParts = cn.split(' ');
        
        // Embed fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // === CALCULATE DYNAMIC DIMENSIONS ===
        const nameFontSize = 20;
        const nameLineHeight = 22;
        
        // Find the longest name part to determine left column width
        let maxNameWidth = 0;
        for (const part of nameParts) {
            const width = boldFont.widthOfTextAtSize(part, nameFontSize);
            if (width > maxNameWidth) maxNameWidth = width;
        }
        
        // Left column width = longest name + padding
        const leftColumnWidth = Math.max(maxNameWidth + 15, 80);
        
        // Right column width for details
        const rightColumnWidth = 220;
        
        // Total box width
        const calculatedBoxWidth = leftColumnWidth + rightColumnWidth + 10;
        const boxWidth = options.width || calculatedBoxWidth;
        
        // Box height based on number of name parts
        const nameHeight = nameParts.length * nameLineHeight + 10;
        const minHeight = 90; // Minimum for right side content
        const boxHeight = options.height || Math.max(nameHeight, minHeight);
        
        // Position
        const boxX = options.x !== undefined ? options.x : pageWidth - boxWidth - 20;
        const boxY = options.y !== undefined ? options.y : 70;
        
        // Build DN parts for right side
        const dnParts = [];
        if (details.C) dnParts.push(`c=${details.C}`);
        if (details.O) dnParts.push(`o=${details.O}`);
        if (details.title) dnParts.push(`title=${details.title}`);
        if (details.pseudonym) dnParts.push(`pseudonym=${details.pseudonym}`);
        if (details['2.5.4.20']) dnParts.push(`2.5.4.20=${details['2.5.4.20']}`);
        if (details.postalCode) dnParts.push(`postalCode=${details.postalCode}`);
        if (details.ST) dnParts.push(`st=${details.ST}`);
        if (details.serialNumber) dnParts.push(`serialNumber=${details.serialNumber}`);
        if (cn) dnParts.push(`cn=${cn}`);
        
        // Layout positions
        const rightColumnX = boxX + leftColumnWidth + 5;
        
        // === CALCULATE RIGHT SIDE CONTENT FIRST (to get total height) ===
        const detailFontSize = 5.5;
        const detailLineHeight = 7;
        
        // Build all right side lines first to count them
        const rightSideLines = [];
        
        // Line 1: "Digitally signed by NAME"
        rightSideLines.push(`Digitally signed by ${cn}`);
        
        // Line 2: DN: c=XX, o=XXX,
        const firstLineParts = [];
        if (details.C) firstLineParts.push(`c=${details.C}`);
        if (details.O) firstLineParts.push(`o=${details.O}`);
        rightSideLines.push(`DN: ${firstLineParts.join(', ')},`);
        
        // Remaining DN fields wrapped, with value length limited by pseudonym line length
        const remainingParts = [];
        if (details.title) remainingParts.push(`title=${details.title}`);
        if (details.pseudonym) remainingParts.push(`pseudonym=${details.pseudonym}`);
        if (details['2.5.4.20']) remainingParts.push(`2.5.4.20=${details['2.5.4.20']}`);
        if (details.postalCode) remainingParts.push(`postalCode=${details.postalCode}`);
        if (details.ST) remainingParts.push(`st=${details.ST}`);
        if (details.serialNumber) remainingParts.push(`serialNumber=${details.serialNumber}`);
        if (cn) remainingParts.push(`cn=${cn}`);

        // Take the length of the full pseudonym line as the maximum character width example.
        // Other attribute values will be broken into chunks that do not exceed this length.
        const exampleLine = details.pseudonym
            ? `pseudonym=${details.pseudonym}`
            : (remainingParts[0] || '');
        const maxCharsPerLine = Math.max(exampleLine.length, 40);

        const normalizedParts = [];
        for (const part of remainingParts) {
            if (typeof part !== 'string') continue;

            const eqIndex = part.indexOf('=');
            if (eqIndex === -1 || part.length <= maxCharsPerLine) {
                normalizedParts.push(part);
                continue;
            }

            const key = part.slice(0, eqIndex); // e.g. "pseudonym"
            const value = part.slice(eqIndex + 1); // everything after "="
            const keyPrefix = `${key}=`;

            // Available space for the first line's value after "key="
            const firstValueLimit = Math.max(maxCharsPerLine - keyPrefix.length, 1);
            let index = 0;

            // First line includes the key
            const firstChunk = value.slice(0, firstValueLimit);
            normalizedParts.push(`${keyPrefix}${firstChunk}`);
            index += firstValueLimit;

            // Subsequent lines: only value chunks, without extra leading spaces
            const subsequentLimit = Math.max(maxCharsPerLine, 1);

            while (index < value.length) {
                const chunk = value.slice(index, index + subsequentLimit);
                normalizedParts.push(chunk);
                index += subsequentLimit;
            }
        }

        // Add normalized lines directly; they are already length-limited.
        rightSideLines.push(...normalizedParts.slice(0, 9));
        
        // Last line: Date
        rightSideLines.push(`Date: ${signDate}`);
        
        // Calculate maximum text width for right side to avoid excessive empty space
        let maxRightTextWidth = 0;
        for (const line of rightSideLines) {
            const w = font.widthOfTextAtSize(line, detailFontSize);
            if (w > maxRightTextWidth) {
                maxRightTextWidth = w;
            }
        }
        
        // Calculate right side total height
        const rightSideHeight = rightSideLines.length * detailLineHeight;
        const rightBoxPadding = 6;
        const rightBoxTotalHeight = rightSideHeight + rightBoxPadding * 2;
        
        // === DRAW RIGHT SIDE BOX FIRST ===
        const rightBoxX = rightColumnX - rightBoxPadding;
        const rightBoxY = boxY + boxHeight - rightBoxTotalHeight - 5;
        const effectiveRightWidth = Math.min(rightColumnWidth, maxRightTextWidth + 8);
        const rightBoxWidth = effectiveRightWidth + rightBoxPadding;
        
        page.drawRectangle({
            x: rightBoxX,
            y: rightBoxY,
            width: rightBoxWidth,
            height: rightBoxTotalHeight,
            borderColor: rgb(0.6, 0.6, 0.6),
            borderWidth: 0.5,
            color: rgb(1, 1, 1),
        });
        
        // === LEFT SIDE: Bold Name (same height as right box) ===
        const nameLineHeightAdjusted = rightBoxTotalHeight / nameParts.length;
        
        // Align left name with top of right box
        let nameY = rightBoxY + rightBoxTotalHeight - nameFontSize;
        
        // Draw each part of the name with adjusted spacing
        for (const part of nameParts) {
            page.drawText(part, {
                x: boxX,
                y: nameY,
                size: nameFontSize,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            nameY -= nameLineHeightAdjusted;
        }
        
        // === RIGHT SIDE: Draw all the lines inside the box ===
        let detailY = rightBoxY + rightBoxTotalHeight - rightBoxPadding - detailFontSize;
        
        for (const line of rightSideLines) {
            page.drawText(line, {
                x: rightColumnX,
                y: detailY,
                size: detailFontSize,
                font: font,
                color: rgb(0, 0, 0)
            });
            detailY -= detailLineHeight;
        }
        
        // Return the full signature area bounds (for widget positioning)
        const sigAreaX = boxX;
        const sigAreaY = rightBoxY;
        const sigAreaWidth = leftColumnWidth + rightBoxWidth + rightBoxPadding + 10;
        const sigAreaHeight = rightBoxTotalHeight;
        
        return { 
            boxX: sigAreaX, 
            boxY: sigAreaY, 
            boxWidth: sigAreaWidth, 
            boxHeight: sigAreaHeight, 
            pageIndex 
        };
    }
    
    /**
     * Wrap text compactly for DN display
     */
    wrapTextCompact(text, font, fontSize, maxWidth) {
        const lines = [];
        let remaining = text;
        
        while (remaining.length > 0) {
            let lineEnd = remaining.length;
            
            // Find how many characters fit
            while (lineEnd > 0) {
                const testLine = remaining.substring(0, lineEnd);
                const width = font.widthOfTextAtSize(testLine, fontSize);
                
                if (width <= maxWidth) {
                    break;
                }
                lineEnd--;
            }
            
            // If we can't fit even one character, force at least one
            if (lineEnd === 0) lineEnd = 1;
            
            // Try to break at comma or space
            if (lineEnd < remaining.length) {
                const lastComma = remaining.lastIndexOf(',', lineEnd);
                const lastSpace = remaining.lastIndexOf(' ', lineEnd);
                const breakPoint = Math.max(lastComma, lastSpace);
                
                if (breakPoint > 0) {
                    lineEnd = breakPoint + 1;
                }
            }
            
            lines.push(remaining.substring(0, lineEnd).trim());
            remaining = remaining.substring(lineEnd).trim();
        }
        
        return lines;
    }
    
    /**
     * Wrap text to fit within specified width
     */
    wrapText(text, font, fontSize, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = font.widthOfTextAtSize(testLine, fontSize);
            
            if (width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    /**
     * Custom placeholder function that supports widget Rect positioning
     * This allows the signature to be clickable at the visible signature location
     * Handles both traditional trailers and xref streams (PDF 1.5+)
     */
    addPlaceholderWithRect(pdfBuffer, options = {}) {
        const {
            reason = 'Digital Signature',
            location = 'DSC Token', 
            name = 'Signer',
            contactInfo = '',
            widgetRect = [0, 0, 0, 0],
            pageIndex = 0
        } = options;
        
        let pdf = pdfBuffer;
        const pdfString = pdf.toString('latin1');
        
        // Find startxref position
        const startxrefMatch = pdfString.match(/startxref\s*(\d+)/);
        if (!startxrefMatch) {
            throw new Error('Could not find startxref in PDF');
        }
        const xrefPos = parseInt(startxrefMatch[1]);
        
        // Find Root reference - try multiple methods
        let rootObjNum = null;
        
        // Method 1: Traditional trailer
        const trailerMatch = pdfString.match(/trailer\s*<<[\s\S]*?\/Root\s+(\d+)\s+\d+\s+R[\s\S]*?>>/);
        if (trailerMatch) {
            rootObjNum = parseInt(trailerMatch[1]);
        }
        
        // Method 2: xref stream (PDF 1.5+) - Root is in the xref stream object
        if (!rootObjNum) {
            const xrefStreamMatch = pdfString.match(/\/Type\s*\/XRef[\s\S]*?\/Root\s+(\d+)\s+\d+\s+R/);
            if (xrefStreamMatch) {
                rootObjNum = parseInt(xrefStreamMatch[1]);
            }
        }
        
        // Method 3: Search for Root anywhere in the file
        if (!rootObjNum) {
            const rootAnyMatch = pdfString.match(/\/Root\s+(\d+)\s+\d+\s+R/);
            if (rootAnyMatch) {
                rootObjNum = parseInt(rootAnyMatch[1]);
            }
        }
        
        if (!rootObjNum) {
            throw new Error('Could not find Root reference in PDF');
        }
        
        // Find the highest object number
        const objMatches = pdfString.matchAll(/(\d+)\s+\d+\s+obj/g);
        let maxObjNum = 0;
        for (const match of objMatches) {
            const objNum = parseInt(match[1]);
            if (objNum > maxObjNum) maxObjNum = objNum;
        }
        
        // Find page object for the specified page
        // Try to find Kids array in Pages object
        let pageObjNum = null;
        const pagesMatch = pdfString.match(/\/Type\s*\/Pages[\s\S]*?\/Kids\s*\[([^\]]+)\]/);
        if (pagesMatch) {
            const kids = pagesMatch[1].match(/(\d+)\s+\d+\s+R/g);
            if (kids && kids[pageIndex]) {
                const pageRef = kids[pageIndex].match(/(\d+)/);
                if (pageRef) pageObjNum = parseInt(pageRef[1]);
            }
        }
        
        // Fallback: find first Page object
        if (!pageObjNum) {
            const pageMatch = pdfString.match(/(\d+)\s+\d+\s+obj[\s\S]*?\/Type\s*\/Page[^s]/);
            if (pageMatch) {
                pageObjNum = parseInt(pageMatch[1]);
            }
        }
        
        if (!pageObjNum) {
            pageObjNum = 4; // Common default
        }
        
        // Create new objects
        const sigObjNum = maxObjNum + 1;
        const widgetObjNum = maxObjNum + 2;
        const acroFormObjNum = maxObjNum + 3;
        const appearanceObjNum = maxObjNum + 4;
        
        // Format the Rect
        const rectStr = `[${Math.round(widgetRect[0])} ${Math.round(widgetRect[1])} ${Math.round(widgetRect[2])} ${Math.round(widgetRect[3])}]`;
        
        // (debug) signature object creation logs removed

        // Minimal appearance stream (Form XObject) so Adobe treats widget as interactive.
        // Mirrors what Acrobat typically writes: /AP << /N <form-xobject> >>
        const apWidth = Math.max(0, Math.round(widgetRect[2] - widgetRect[0]));
        const apHeight = Math.max(0, Math.round(widgetRect[3] - widgetRect[1]));
        const apStream = 'q\nQ\n'; // 4 bytes
        const appearanceDict = `${appearanceObjNum} 0 obj
<<
/Type /XObject
/Subtype /Form
/BBox [0 0 ${apWidth} ${apHeight}]
/Resources <<
>>
/Length ${apStream.length}
>>
stream
${apStream}endstream
endobj
`;
        
        // Signature dictionary with ByteRange placeholder
        // Match the exact structure from the working original implementation
        const sigDict = `${sigObjNum} 0 obj
<<
/Type /Sig
/Filter /Adobe.PPKLite
/SubFilter /adbe.pkcs7.detached
/Name (${name})
/Location (${location})
/Reason (${reason})
/ContactInfo (${contactInfo})
/M (D:${this.formatPDFDate(new Date())})
/ByteRange [0 /********** /********** /**********]
/Contents <${'0'.repeat(DEFAULT_SIGNATURE_LENGTH * 2)}>
>>
endobj
`;

        // Widget annotation linked to signature - positioned at visible signature
        // Add /AP + /DA + /MK to match Acrobat-signed PDFs (fixes click/right-click in Adobe).
        const widgetDict = `${widgetObjNum} 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Sig
/Rect ${rectStr}
/T (Signature1)
/V ${sigObjNum} 0 R
/F 132
/P ${pageObjNum} 0 R
/DA (/Helvetica 0 Tf 0 Tz 0 g)
/MK <<
>>
/AP <<
/N ${appearanceObjNum} 0 R
>>
>>
endobj
`;

        // AcroForm dictionary - match the exact structure from the working original implementation
        const acroFormDict = `${acroFormObjNum} 0 obj
<<
/SigFlags 3
/Fields [${widgetObjNum} 0 R]
>>
endobj
`;

        // For incremental update, we need to:
        // 1. Extract the original page object and add Annots reference
        // 2. Extract the original root object and add AcroForm reference
        // 3. Append new objects as incremental update
        
        // Find original page object content
        const pageObjRegex = new RegExp(`${pageObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`, 'm');
        const pageObjMatch = pdfString.match(pageObjRegex);
        
        let newPageContent = '';
        if (pageObjMatch) {
            let pageContent = pageObjMatch[1];
            // Check if page already has Annots
            if (pageContent.includes('/Annots')) {
                // Add to existing Annots array
                pageContent = pageContent.replace(/(\/Annots\s*\[)([^\]]*)(\])/, `$1$2 ${widgetObjNum} 0 R$3`);
            } else {
                // Add new Annots array
                pageContent = pageContent + `\n/Annots [${widgetObjNum} 0 R]`;
            }
            newPageContent = `${pageObjNum} 0 obj
<<${pageContent}>>
endobj
`;
        }
        
        // Find original root object content
        const rootObjRegex = new RegExp(`${rootObjNum}\\s+0\\s+obj\\s*<<([\\s\\S]*?)>>\\s*endobj`, 'm');
        const rootObjMatch = pdfString.match(rootObjRegex);
        
        let newRootContent = '';
        if (rootObjMatch && !rootObjMatch[1].includes('/AcroForm')) {
            const rootContent = rootObjMatch[1] + `\n/AcroForm ${acroFormObjNum} 0 R`;
            newRootContent = `${rootObjNum} 0 obj
<<${rootContent}>>
endobj
`;
        }
        
        // Build incremental update - keep original PDF intact, append new/modified objects
        const originalPdf = pdfString;
        const newObjects = sigDict + widgetDict + acroFormDict + appearanceDict + newPageContent + newRootContent;
        
        // Calculate xref entries for new objects
        const baseOffset = originalPdf.length;
        let currentOffset = baseOffset;
        
        const xrefEntries = [];
        
        // Sig object
        xrefEntries.push({ objNum: sigObjNum, offset: currentOffset });
        currentOffset += sigDict.length;
        
        // Widget object
        xrefEntries.push({ objNum: widgetObjNum, offset: currentOffset });
        currentOffset += widgetDict.length;
        
        // AcroForm object
        xrefEntries.push({ objNum: acroFormObjNum, offset: currentOffset });
        currentOffset += acroFormDict.length;

        // Appearance object
        xrefEntries.push({ objNum: appearanceObjNum, offset: currentOffset });
        currentOffset += appearanceDict.length;
        
        // Updated page object (if created)
        if (newPageContent) {
            xrefEntries.push({ objNum: pageObjNum, offset: currentOffset });
            currentOffset += newPageContent.length;
        }
        
        // Updated root object (if created)
        if (newRootContent) {
            xrefEntries.push({ objNum: rootObjNum, offset: currentOffset });
            currentOffset += newRootContent.length;
        }
        
        // Build xref section
        let xrefSection = 'xref\n';
        
        // Group consecutive object numbers for xref subsections
        xrefEntries.sort((a, b) => a.objNum - b.objNum);
        
        let i = 0;
        while (i < xrefEntries.length) {
            const start = xrefEntries[i].objNum;
            let count = 1;
            
            // Find consecutive objects
            while (i + count < xrefEntries.length && 
                   xrefEntries[i + count].objNum === start + count) {
                count++;
            }
            
            xrefSection += `${start} ${count}\n`;
            for (let j = 0; j < count; j++) {
                const entry = xrefEntries[i + j];
                xrefSection += `${String(entry.offset).padStart(10, '0')} 00000 n \n`;
            }
            
            i += count;
        }
        
        // Create new trailer
            const newXref = `${xrefSection}trailer
<<
/Size ${Math.max(appearanceObjNum, acroFormObjNum, pageObjNum, rootObjNum) + 1}
/Root ${rootObjNum} 0 R
/Prev ${xrefPos}
>>
startxref
${baseOffset + newObjects.length}
%%EOF`;
        
        const finalPdf = originalPdf + newObjects + newXref;
        return Buffer.from(finalPdf, 'latin1');
    }
    
    /**
     * Escape PDF string to handle special characters
     */
    escapePDFString(str) {
        if (!str) return '';
        return str.toString()
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }
    
    /**
     * Format date for PDF
     */
    formatPDFDate(date) {
        const pad = (n) => String(n).padStart(2, '0');
        const offset = -date.getTimezoneOffset();
        const sign = offset >= 0 ? '+' : '-';
        const hours = pad(Math.floor(Math.abs(offset) / 60));
        const mins = pad(Math.abs(offset) % 60);
        
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
               `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
               `${sign}${hours}'${mins}'`;
    }
    
    /**
     * Sign PDF with certificate and PKCS#11 signer
     * @param {Buffer} pdfBytes - Original PDF bytes
     * @param {Buffer} certificate - Certificate in DER format
     * @param {Function} signerFunction - Async function that signs a hash and returns signature Buffer
     * @param {Object} options - Signing options (pageIndex, x, y, width, height)
     * @returns {Buffer} - Signed PDF bytes
     */
    async signPDF(pdfBytes, certificate, signerFunction, options = {}) {
        try {
            // Convert certificate to PEM format
            const certPem = '-----BEGIN CERTIFICATE-----\n' +
                certificate.toString('base64').match(/.{1,64}/g).join('\n') +
                '\n-----END CERTIFICATE-----';
            
            const cert = forge.pki.certificateFromPem(certPem);
            const cn = cert.subject.getField('CN')?.value || 'Digital Signature';
            
            // Load PDF
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pageIndex = options.pageIndex || 0;
            
            // Add visible signature appearance with certificate details
            const sigBounds = await this.addVisibleSignature(pdfDoc, cert, options);
            
            // Save PDF with visible signature
            const pdfWithField = Buffer.from(
                await pdfDoc.save({ useObjectStreams: false })
            );
            
            // Calculate widget rect to match visible signature position
            // This makes the signature clickable and shows options on right-click
            const widgetRect = [
                sigBounds.boxX,
                sigBounds.boxY,
                sigBounds.boxX + sigBounds.boxWidth,
                sigBounds.boxY + sigBounds.boxHeight
            ];
            
            // (debug) widget rect/bounds logs removed
                        
            // Add placeholder with widget positioned at visible signature
            // Using our custom method that creates proper signature field structure
            const pdfWithPlaceholder = this.addPlaceholderWithRect(pdfWithField, {
                reason: 'Digital Signature',
                location: 'DSC Token',
                name: cn,
                contactInfo: 'DSC Certificate',
                widgetRect: widgetRect,
                pageIndex: pageIndex
            });
            
            // Extract byte ranges and sign with proper CMS
            const signedPdf = await this.signWithCustomCMS(pdfWithPlaceholder, certPem, certificate, signerFunction, cn);
            
            return signedPdf;
        } catch (error) {
            console.error('PDF signing error:', error);
            throw error;
        }
    }
    
    /**
     * Sign PDF with custom CMS creation (for Adobe Reader compatibility)
     */
    async signWithCustomCMS(pdfWithPlaceholder, certPem, certDer, signerFunction, signerName) {
        const pdfBuffer = Buffer.isBuffer(pdfWithPlaceholder) ? pdfWithPlaceholder : Buffer.from(pdfWithPlaceholder);
        let pdf = pdfBuffer;
        
        // Find ByteRange placeholder
        const pdfString = pdf.toString('latin1');
        
        // Match ByteRange with placeholder values
        const byteRangeMatch = pdfString.match(/\/ByteRange\s*\[\s*0\s+\/\*{10}\s+\/\*{10}\s+\/\*{10}\s*\]/);
        
        if (!byteRangeMatch) {
            throw new Error('Could not find ByteRange placeholder in PDF');
        }
        
        const byteRangePos = pdfString.indexOf(byteRangeMatch[0]);
        const byteRangeEnd = byteRangePos + byteRangeMatch[0].length;
        
        // Find Contents field
        const contentsMatch = pdfString.match(/\/Contents\s*<([0-9a-fA-F\s]*)>/);
        if (!contentsMatch) {
            throw new Error('Could not find Contents field in PDF');
        }
        
        const contentsTagStart = pdfString.indexOf(contentsMatch[0]);
        const contentsValueStart = pdfString.indexOf('<', contentsTagStart) + 1;
        const contentsValueEnd = pdfString.indexOf('>', contentsValueStart);
        
        // Calculate actual ByteRange values
        // ByteRange: [start1, length1, start2, length2]
        // start1 = 0, length1 = position of '<' in Contents
        // start2 = position after '>' in Contents, length2 = remaining bytes
        const byteRange = [
            0,
            contentsValueStart - 1,  // Up to but not including '<'
            contentsValueEnd + 1,    // After '>'
            pdf.length - contentsValueEnd - 1
        ];
        
        // Create the new ByteRange string with same length as original
        const originalByteRangeStr = byteRangeMatch[0];
        const newByteRangeValues = `[${byteRange[0]} ${byteRange[1]} ${byteRange[2]} ${byteRange[3]}]`;
        
        // Calculate exact spacing needed to match original length
        const spacingNeeded = originalByteRangeStr.length - `/ByteRange ${newByteRangeValues}`.length;
        const newByteRangeStr = spacingNeeded > 0 
            ? `/ByteRange ${newByteRangeValues}` + ' '.repeat(spacingNeeded)
            : `/ByteRange ${newByteRangeValues}`;
        
        // Verify lengths match exactly
        if (newByteRangeStr.length !== originalByteRangeStr.length) {
            console.error('ByteRange length mismatch:', newByteRangeStr.length, 'vs', originalByteRangeStr.length);
            console.error('Original:', JSON.stringify(originalByteRangeStr));
            console.error('New:', JSON.stringify(newByteRangeStr));
            throw new Error('ByteRange replacement would change PDF structure');
        }
        
        // (debug) ByteRange logs removed
        
        // Replace ByteRange in PDF
        pdf = Buffer.concat([
            pdf.slice(0, byteRangePos),
            Buffer.from(newByteRangeStr, 'latin1'),
            pdf.slice(byteRangeEnd)
        ]);
        
        // Calculate document hash (excluding signature contents)
        // ByteRange: [start1, length1, start2, length2]
        // We hash: bytes start1 to start1+length1, then bytes start2 to start2+length2
        const range1 = pdf.slice(byteRange[0], byteRange[0] + byteRange[1]);
        const range2 = pdf.slice(byteRange[2], byteRange[2] + byteRange[3]);
        const hashData = Buffer.concat([range1, range2]);
        
        const documentHash = crypto.createHash('sha256').update(hashData).digest();
        // (debug) hash logs removed
        
        // Prepare signed attributes and get the hash of attributes to sign
        const { signedAttrsForCMS, signedAttrsHash } = this.prepareSignedAttributes(certPem, documentHash);
        
        // Sign the hash of signed attributes using PKCS#11 token
        const signatureBuffer = await signerFunction(signedAttrsHash);
        
        // Create CMS/PKCS#7 signature structure
        const cert = forge.pki.certificateFromPem(certPem);
        const cmsSignature = this.createCMSWithSignedAttrs(cert, signedAttrsForCMS, signatureBuffer);
        
        // Convert CMS to hex
        const sigHex = cmsSignature.toString('hex').toUpperCase();
        
        // Get the placeholder length (excluding < and >)
        const placeholderLength = contentsValueEnd - contentsValueStart;
        
        // Pad signature to match placeholder length
        if (sigHex.length > placeholderLength) {
            throw new Error(`Signature too large: ${sigHex.length} > ${placeholderLength}`);
        }
        
        const paddedSigHex = sigHex.padEnd(placeholderLength, '0');
        
        // (debug) signature embedding size logs removed
        
        // Replace signature placeholder with actual signature
        const signedPdf = Buffer.concat([
            pdf.slice(0, contentsValueStart),
            Buffer.from(paddedSigHex, 'latin1'),
            pdf.slice(contentsValueEnd)
        ]);
        
        // Verify signature was embedded correctly
        const signedPdfString = signedPdf.toString('latin1');
        const hasActualSignature = signedPdfString.includes(paddedSigHex.substring(0, 100)); // Check first 100 chars
        const hasNonZeroSignature = !paddedSigHex.match(/^0+$/); // Signature should not be all zeros
        
        // Verify ByteRange is still correct after embedding
        const finalByteRangeMatch = signedPdfString.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
        const finalByteRange = finalByteRangeMatch ? [
            parseInt(finalByteRangeMatch[1]),
            parseInt(finalByteRangeMatch[2]),
            parseInt(finalByteRangeMatch[3]),
            parseInt(finalByteRangeMatch[4])
        ] : null;
        
        // Verify signature dictionary has Contents
        const sigDictMatch = signedPdfString.match(/(\d+)\s+0\s+obj[\s\S]*?\/Type\s*\/Sig[\s\S]*?\/Contents\s*<([^>]+)>/);
        const hasSigDictWithContents = !!sigDictMatch;
        
        // (debug) signature embedding verification logs removed
        
        if (!hasActualSignature || !hasNonZeroSignature) {
            console.error('WARNING: Signature may not be embedded correctly!');
        }
        if (!finalByteRange || JSON.stringify(finalByteRange) !== JSON.stringify(byteRange)) {
            console.error('WARNING: ByteRange mismatch after embedding!');
        }
        if (!hasSigDictWithContents) {
            console.error('WARNING: Signature dictionary may not have Contents field!');
        }
        
        return signedPdf;
    }
    
    /**
     * Prepare signed attributes for CMS signature
     */
    prepareSignedAttributes(certPem, documentHash) {
        const asn1 = forge.asn1;
        const oids = forge.pki.oids;
        
        // Current signing time
        const signingTime = new Date();
        
        // Build SignedAttributes SET
        // 1. Content Type (OID 1.2.840.113549.1.9.3)
        // 2. Signing Time (OID 1.2.840.113549.1.9.5)
        // 3. Message Digest (OID 1.2.840.113549.1.9.4)
        
        const signedAttrs = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            // Content Type attribute
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer('1.2.840.113549.1.9.3').getBytes()),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                        asn1.oidToDer(oids.data).getBytes())
                ])
            ]),
            // Signing Time attribute
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer('1.2.840.113549.1.9.5').getBytes()),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false,
                        this.formatUTCTime(signingTime))
                ])
            ]),
            // Message Digest attribute
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer('1.2.840.113549.1.9.4').getBytes()),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false,
                        documentHash.toString('binary'))
                ])
            ])
        ]);
        
        // For signing, we need to hash the DER encoding of signed attributes as SET (not CONTEXT_SPECIFIC)
        const signedAttrsForHash = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, signedAttrs.value);
        const signedAttrsDer = Buffer.from(asn1.toDer(signedAttrsForHash).getBytes(), 'binary');
        const signedAttrsHash = crypto.createHash('sha256').update(signedAttrsDer).digest();
        
        return {
            signedAttrsForCMS: signedAttrs,
            signedAttrsHash: signedAttrsHash
        };
    }
    
    /**
     * Format date as UTCTime for ASN.1
     */
    formatUTCTime(date) {
        const pad = (n) => String(n).padStart(2, '0');
        const year = date.getUTCFullYear() % 100;
        const month = pad(date.getUTCMonth() + 1);
        const day = pad(date.getUTCDate());
        const hours = pad(date.getUTCHours());
        const minutes = pad(date.getUTCMinutes());
        const seconds = pad(date.getUTCSeconds());
        
        return `${pad(year)}${month}${day}${hours}${minutes}${seconds}Z`;
    }
    
    /**
     * Create CMS/PKCS#7 SignedData structure with signed attributes
     */
    createCMSWithSignedAttrs(cert, signedAttrs, signatureBuffer) {
            const asn1 = forge.asn1;
            const oids = forge.pki.oids;
            
            // Serial number from certificate
            const serialNumber = cert.serialNumber;
            let serialBytes;
            try {
                if (serialNumber.match(/^[0-9a-fA-F]+$/)) {
                    const hex = serialNumber.length % 2 === 0 ? serialNumber : '0' + serialNumber;
                    serialBytes = Buffer.from(hex, 'hex');
                } else {
                    const bigInt = BigInt(serialNumber);
                    const hex = bigInt.toString(16);
                    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
                    serialBytes = Buffer.from(paddedHex, 'hex');
                }
            } catch (e) {
                serialBytes = Buffer.from(serialNumber);
            }
            
            // Issuer from certificate
            const issuerAsn1 = forge.pki.distinguishedNameToAsn1(cert.issuer);
            
            // Build SignerInfo
            const signerInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                // version
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, 
                    forge.util.hexToBytes('01')),
                // sid (IssuerAndSerialNumber)
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                    issuerAsn1,
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false,
                        serialBytes.toString('binary'))
                ]),
            // digestAlgorithm (SHA-256)
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer(oids.sha256).getBytes()),
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
                ]),
            // signedAttrs [0] IMPLICIT
            signedAttrs,
            // signatureAlgorithm (SHA256withRSA)
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer('1.2.840.113549.1.1.11').getBytes()), // sha256WithRSAEncryption
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
                ]),
                // signature
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 
                signatureBuffer.toString('binary'))
            ]);
            
            // Build SignedData
            const signedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                // version
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false,
                    forge.util.hexToBytes('01')),
                // digestAlgorithms
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                        asn1.oidToDer(oids.sha256).getBytes()),
                        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
                    ])
                ]),
            // encapContentInfo (detached signature - no content)
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                    asn1.oidToDer(oids.data).getBytes())
                // No content for detached signature
            ]),
            // certificates [0] IMPLICIT
                asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
                        forge.pki.certificateToAsn1(cert)
                ]),
                // signerInfos
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
                    signerInfo
                ])
            ]);
        
        // Wrap in ContentInfo
        const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            // contentType (signedData)
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
                asn1.oidToDer('1.2.840.113549.1.7.2').getBytes()),
            // content [0] EXPLICIT
            asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
                signedData
                ])
            ]);
            
            // Convert to DER
        const cmsDer = asn1.toDer(contentInfo).getBytes();
            return Buffer.from(cmsDer, 'binary');
    }
}

module.exports = new PDFSignerPKCS11();
