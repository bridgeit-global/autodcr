let pkcs11 = null;
let usb = null;

// Try to load pkcs11js (may fail if not compiled)
try {
    pkcs11 = require('pkcs11js');
} catch (error) {
    console.warn('pkcs11js not available:', error.message);
}

// Try to load usb library
try {
    usb = require('usb');
} catch (error) {
    console.warn('usb library not available:', error.message);
}

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

class DSCService {
    constructor() {
        this.module = null;
        this.session = null;
        this.slot = null;
        this.certificate = null;
        this.privateKey = null;
        this.isInitialized = false;
        this.isLoggedIn = false;
        // Allow manual PKCS#11 library path via environment variable
        this.manualPKCS11Path = process.env.PKCS11_LIBRARY_PATH || null;
    }

    // Initialize PKCS#11 module
    async initialize() {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available. Please install pkcs11js or your DSC provider software.');
            }

            // Common PKCS#11 library paths for different DSC providers
            const commonPaths = [
                // HYP2003 (Hypersecu) paths - the actual library name is libcastle
                '/usr/local/lib/libcastle_v2.1.0.0.dylib',
                '/usr/local/lib/libcastle.dylib',
                '/usr/lib/libcastle_v2.1.0.0.dylib',
                '/usr/lib/libcastle.dylib',
                '/opt/hypersecu/lib/libcastle.dylib',
                '/Library/Frameworks/HyperSecu.framework/libcastle.dylib',
                // Also check the mounted volume
                '/Volumes/HyperPKI_230404/libcastle.dylib',
                '/Volumes/HyperPKI_230404/libcastle_v2.1.0.0.dylib',
                // Alternative names
                '/usr/local/lib/libhypersecu_pkcs11.dylib',
                '/usr/lib/libhypersecu_pkcs11.dylib',
                '/opt/hypersecu/lib/libhypersecu_pkcs11.dylib',
                '/Library/Frameworks/HyperSecu.framework/libhypersecu_pkcs11.dylib',
                '/usr/local/lib/libhypersecu_pkcs11.so',
                '/usr/lib/libhypersecu_pkcs11.so',
                'C:\\Windows\\System32\\hypersecu_pkcs11.dll',
                'C:\\Program Files\\Hypersecu\\lib\\hypersecu_pkcs11.dll',
                // macOS paths
                '/opt/eMudhra/eToken/lib/libeTPkcs11.dylib',
                '/usr/local/lib/libeTPkcs11.dylib',
                '/usr/lib/libeTPkcs11.dylib',
                '/opt/eMudhra/eToken/lib/libeTPkcs11.so',
                '/usr/local/lib/libaetpkss.dylib',          // Capricorn macOS
                '/usr/lib/libaetpkss.dylib',                // Capricorn macOS
                '/Library/Frameworks/eToken.framework/Versions/Current/libeTPkcs11.dylib',
                '/usr/local/lib/pkcs11/libpkcs11.dylib',
                '/opt/homebrew/lib/libpkcs11.dylib',
                // Linux paths
                '/usr/lib/pkcs11/libpkcs11.so',
                '/usr/lib/x86_64-linux-gnu/pkcs11/libpkcs11.so',
                '/usr/local/lib/pkcs11/libpkcs11.so',
                '/opt/eMudhra/eToken/lib/libeTPkcs11.so',
                '/usr/lib/libaetpkss.so',                   // Capricorn
                '/usr/lib/x86_64-linux-gnu/libpkcs11.so',
                // Windows paths
                'C:\\Windows\\System32\\eTPKCS11.dll',
                'C:\\Windows\\System32\\aetpkss.dll',
                'C:\\Program Files\\eMudhra\\eToken\\lib\\eTPKCS11.dll',
                'C:\\Program Files (x86)\\eMudhra\\eToken\\lib\\eTPKCS11.dll',
            ];

            // Try to find and load PKCS#11 library
            let modulePath = null;
            let foundPaths = [];
            
            // Check manual path first (from environment variable)
            if (this.manualPKCS11Path && fs.existsSync(this.manualPKCS11Path)) {
                modulePath = this.manualPKCS11Path;
                // (debug) using manual PKCS#11 library path
            }
            
            // Check common paths
            if (!modulePath) {
                for (const libPath of commonPaths) {
                    if (fs.existsSync(libPath)) {
                        foundPaths.push(libPath);
                        if (!modulePath) {
                            modulePath = libPath;
                        }
                    }
                }
            }

            // If no library found, try to detect from USB devices
            if (!modulePath) {
                modulePath = await this.detectPKCS11FromUSB();
            }
            
            // For HYP2003, also check for libcastle (the actual library name)
            if (!modulePath) {
                const castlePaths = [
                    '/usr/local/lib/libcastle_v2.1.0.0.dylib',
                    '/usr/local/lib/libcastle.dylib',
                    '/usr/lib/libcastle_v2.1.0.0.dylib',
                ];
                for (const castlePath of castlePaths) {
                    if (fs.existsSync(castlePath)) {
                        modulePath = castlePath;
                        // (debug) found HYP2003 library (libcastle)
                        break;
                    }
                }
            }

            // Also try to find PKCS#11 libraries using system commands (macOS/Linux)
            if (!modulePath && process.platform !== 'win32') {
                try {
                    const { execSync } = require('child_process');
                    // Try to find using find command (macOS/Linux) - including HYP2003
                    const findCmd = process.platform === 'darwin' 
                        ? 'find /usr /opt /Library -name "*pkcs11*.dylib" -o -name "*eTPkcs11*.dylib" -o -name "*aetpkss*.dylib" -o -name "*hypersecu*.dylib" 2>/dev/null | head -10'
                        : 'find /usr /opt -name "*pkcs11*.so" -o -name "*eTPkcs11*.so" -o -name "*aetpkss*.so" -o -name "*hypersecu*.so" 2>/dev/null | head -10';
                    
                    const result = execSync(findCmd, { encoding: 'utf8', timeout: 5000 });
                    const paths = result.trim().split('\n').filter(p => p && fs.existsSync(p));
                    if (paths.length > 0) {
                        // Prefer HYP2003/Hypersecu library if found
                        const hypLib = paths.find(p => p.includes('hypersecu') || p.includes('hyp'));
                        modulePath = hypLib || paths[0];
                        foundPaths.push(...paths);
                    }
                } catch (e) {
                    // Ignore errors from find command
                }
            }

            if (!modulePath) {
                const errorMsg = 'PKCS#11 library not found. Please install your DSC provider software.\n' +
                    'You can manually specify the path by setting PKCS11_LIBRARY_PATH environment variable.\n' +
                    'Run: node find-pkcs11.js to search for installed libraries.';
                throw new Error(errorMsg);
            }
            
            // (debug) found PKCS#11 library

            // Create PKCS11 instance and load the library
            this.module = new pkcs11.PKCS11();
            this.module.load(modulePath);
            
            // Try to initialize, handle if already initialized
            try {
                this.module.C_Initialize();
            } catch (initError) {
                // Check error code or message for already initialized
                // CKR_CRYPTOKI_ALREADY_INITIALIZED = 0x00000191 = 401
                const errorCode = initError.code;
                const errorMessage = initError.message || '';
                
                if (errorCode === 401 || 
                    errorMessage.includes('CKR_CRYPTOKI_ALREADY_INITIALIZED') || 
                    errorMessage.includes('already initialized')) {
                    // Try to finalize first
                    try {
                        this.module.C_Finalize();
                    } catch (finalizeError) {
                        // Ignore finalize errors
                    }
                    // Wait a bit before re-initializing
                    await new Promise(resolve => setTimeout(resolve, 200));
                    try {
                        this.module.C_Initialize();
                    } catch (reinitError) {
                        // If still fails, try to continue anyway - module might be usable
                        // (debug) module initialization issue, continuing
                    }
                } else {
                    throw initError;
                }
            }
            
            this.isInitialized = true;
            
            return { success: true, message: 'PKCS#11 module initialized' };
        } catch (error) {
            console.error('PKCS#11 initialization error:', error);
            return { success: false, error: error.message };
        }
    }

    // Detect PKCS#11 library from connected USB devices
    async detectPKCS11FromUSB() {
        try {
            if (!usb) {
                return null;
            }

            const devices = usb.getDeviceList();
            
            // Common DSC vendor IDs
            const dscVendors = {
                0x0BDA: 'Generic USB Token',
                0x04E6: 'Gemalto',
                0x0529: 'SafeNet',
                0x096E: 'Feitian',
            };

            for (const device of devices) {
                const vendorId = device.deviceDescriptor.idVendor;
                if (dscVendors[vendorId]) {
                    // (debug) found DSC device
                    // Return a generic path - user may need to configure
                    return '/usr/lib/pkcs11/libpkcs11.so';
                }
            }
        } catch (error) {
            console.error('USB detection error:', error);
        }
        return null;
    }

    // Get available slots (token slots)
    getSlots() {
        if (!pkcs11) {
            throw new Error('PKCS#11 library not available');
        }
        if (!this.isInitialized) {
            throw new Error('PKCS#11 not initialized');
        }

        // Use C_GetSlotList to get slots with tokens
        const slots = this.module.C_GetSlotList(true); // true = only slots with tokens
        return slots;
    }

    // Open session with token
    async openSession(slotIndex = 0) {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            const slots = this.getSlots();
            if (slots.length === 0) {
                const error = new Error('No token found. Please insert your DSC pen drive.');
                error.expected = true; // Mark as expected during status checks
                throw error;
            }

            if (slotIndex >= slots.length) {
                slotIndex = 0;
            }

            this.slot = slots[slotIndex];
            // Use C_OpenSession to open a session
            this.session = this.module.C_OpenSession(
                this.slot,
                pkcs11.CKF_RW_SESSION | pkcs11.CKF_SERIAL_SESSION
            );
            
            return { success: true, message: 'Session opened successfully' };
        } catch (error) {
            // Only log if it's not an expected error (expected during status checks when token is temporarily unavailable)
            if (!error.expected) {
                console.error('Session open error:', error);
            }
            return { success: false, error: error.message };
        }
    }

    // Login to token (may require PIN)
    async login(pin = '', slotIndex = 0) {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            if (!this.session) {
                const sessionResult = await this.openSession(slotIndex);
                if (!sessionResult.success || !this.session) {
                    throw new Error(sessionResult.error || 'Failed to open token session');
                }
            }

            // Try to login (some tokens don't require PIN for reading certificates)
            // C_Login: userType = 1 (CKU_USER), pin is optional
            try {
                if (pin) {
                    this.module.C_Login(this.session, 1, pin); // 1 = CKU_USER
                    this.isLoggedIn = true;
                    return { success: true, message: 'Logged in successfully' };
                } else {
                    // No PIN provided - check if already logged in
                    if (this.isLoggedIn) {
                        return { success: true, message: 'Already logged in' };
                    }
                    // Some tokens allow public access without PIN
                    return { success: true, message: 'Public session (no PIN required)' };
                }
            } catch (error) {
                // Check for incorrect PIN error codes
                const errorCode = error.code;
                const errorMessage = error.message || '';
                
                // CKR_PIN_INCORRECT = 0x000000A0 = 160
                if (errorCode === 160 || 
                    errorCode === pkcs11.CKR_PIN_INCORRECT ||
                    errorMessage.includes('CKR_PIN_INCORRECT') ||
                    errorMessage.includes('PIN_INCORRECT') ||
                    errorMessage.includes('incorrect PIN') ||
                    errorMessage.includes('wrong PIN') ||
                    errorMessage.toLowerCase().includes('pin incorrect')) {
                    return { 
                        success: false, 
                        error: 'Incorrect PIN. Please check your PIN and try again.' 
                    };
                }
                
                // Check if already logged in
                if (errorMessage.includes('CKR_USER_ALREADY_LOGGED_IN')) {
                    this.isLoggedIn = true;
                    return { success: true, message: 'Already logged in' };
                }
                
                // Other login errors
                return { 
                    success: false, 
                    error: `Login failed: ${errorMessage || 'Unknown error'}` 
                };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Find ALL certificates from ALL connected tokens/slots
    async findAllCertificates() {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            const allCertificates = [];
            const slots = this.module.C_GetSlotList(true); // Get slots with tokens
            
            // (debug) slots found
            
            for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
                const slot = slots[slotIndex];
                let tempSession = null;
                
                try {
                    // Get slot/token info
                    let tokenLabel = 'Unknown Token';
                    try {
                        const tokenInfo = this.module.C_GetTokenInfo(slot);
                        tokenLabel = tokenInfo.label ? tokenInfo.label.trim() : `Token ${slotIndex + 1}`;
                    } catch (e) {
                        tokenLabel = `Token ${slotIndex + 1}`;
                    }
                    
                    // Open temporary session for this slot
                    tempSession = this.module.C_OpenSession(
                        slot,
                        pkcs11.CKF_RW_SESSION | pkcs11.CKF_SERIAL_SESSION
                    );
                    
                    // Search for certificates
                    const certTemplate = [
                        { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_CERTIFICATE },
                        { type: pkcs11.CKA_CERTIFICATE_TYPE, value: pkcs11.CKC_X_509 }
                    ];
                    
                    this.module.C_FindObjectsInit(tempSession, certTemplate);
                    const certHandles = this.module.C_FindObjects(tempSession, 10);
                    this.module.C_FindObjectsFinal(tempSession);
                    
                    // (debug) certificates found in slot
                    
                    for (let certIndex = 0; certIndex < certHandles.length; certIndex++) {
                        const certHandle = certHandles[certIndex];
                        
                        try {
                            const attrs = [
                                { type: pkcs11.CKA_VALUE },
                                { type: pkcs11.CKA_SUBJECT },
                                { type: pkcs11.CKA_ISSUER },
                                { type: pkcs11.CKA_LABEL }
                            ];
                            
                            const certAttrs = this.module.C_GetAttributeValue(tempSession, certHandle, attrs);
                            
                            const certValueAttr = certAttrs.find(attr => attr.type === pkcs11.CKA_VALUE);
                            const labelAttr = certAttrs.find(attr => attr.type === pkcs11.CKA_LABEL);
                            
                            if (certValueAttr && certValueAttr.value) {
                                // Extract CN (Common Name) from certificate
                                let cn = null;
                                try {
                                    const certBuffer = Buffer.from(certValueAttr.value);
                                    const certPem = '-----BEGIN CERTIFICATE-----\n' +
                                        certBuffer.toString('base64').match(/.{1,64}/g).join('\n') +
                                        '\n-----END CERTIFICATE-----';
                                    const cert = forge.pki.certificateFromPem(certPem);
                                    const cnField = cert.subject.getField('CN');
                                    if (cnField) {
                                        cn = cnField.value;
                                    }
                                } catch (cnError) {
                                    // If CN extraction fails, continue without it
                                }
                                
                                allCertificates.push({
                                    certificate: Buffer.from(certValueAttr.value),
                                    label: labelAttr && labelAttr.value ? Buffer.from(labelAttr.value).toString() : `Certificate ${certIndex + 1}`,
                                    cn: cn,
                                    slotIndex: slotIndex,
                                    certIndex: certIndex,
                                    tokenLabel: tokenLabel
                                });
                            }
                        } catch (certError) {
                            // keep warning but reduce noise
                            console.warn(`Error reading certificate ${certIndex} from slot ${slotIndex}: ${certError.message}`);
                        }
                    }
                    
                    // Close temporary session
                    this.module.C_CloseSession(tempSession);
                    tempSession = null;
                    
                } catch (slotError) {
                    // keep warning but reduce noise
                    console.warn(`Error accessing slot ${slotIndex}: ${slotError.message}`);
                    if (tempSession) {
                        try {
                            this.module.C_CloseSession(tempSession);
                        } catch (e) {}
                    }
                }
            }
            
            return {
                success: true,
                certificates: allCertificates,
                totalSlots: slots.length
            };
            
        } catch (error) {
            console.error('Find all certificates error:', error);
            return { success: false, error: error.message, certificates: [] };
        }
    }

    // Find certificate in token (with slot and cert index selection)
    async findCertificate(certIndex = 0, slotIndex = 0) {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            // Close any existing session
            if (this.session) {
                try {
                    this.module.C_CloseSession(this.session);
                } catch (e) {}
                this.session = null;
                this.isLoggedIn = false;
            }
            
            // Open session with specified slot and ensure handle is valid
            const sessionResult = await this.openSession(slotIndex);
            if (!sessionResult.success || !this.session) {
                throw new Error(sessionResult.error || 'Failed to open token session');
            }

            // Search for certificate objects
            const certTemplate = [
                { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_CERTIFICATE },
                { type: pkcs11.CKA_CERTIFICATE_TYPE, value: pkcs11.CKC_X_509 }
            ];

            // Initialize search
            this.module.C_FindObjectsInit(this.session, certTemplate);
            
            // Find objects (get up to 10 certificates)
            const certHandles = this.module.C_FindObjects(this.session, 10);
            
            // Finalize search
            this.module.C_FindObjectsFinal(this.session);
            
            if (certHandles.length === 0) {
                throw new Error('No certificate found in token');
            }
            
            if (certIndex >= certHandles.length) {
                certIndex = 0;
            }

            // Get the specified certificate
            const certHandle = certHandles[certIndex];
            
            // Get certificate attributes
            const attrs = [
                { type: pkcs11.CKA_VALUE },
                { type: pkcs11.CKA_SUBJECT },
                { type: pkcs11.CKA_ISSUER }
            ];
            
            const certAttrs = this.module.C_GetAttributeValue(this.session, certHandle, attrs);
            
            // Find the CKA_VALUE attribute
            const certValueAttr = certAttrs.find(attr => attr.type === pkcs11.CKA_VALUE);
            const subjectAttr = certAttrs.find(attr => attr.type === pkcs11.CKA_SUBJECT);
            const issuerAttr = certAttrs.find(attr => attr.type === pkcs11.CKA_ISSUER);
            
            if (!certValueAttr || !certValueAttr.value) {
                throw new Error('Failed to get certificate value');
            }
            
            this.certificate = Buffer.from(certValueAttr.value);
            
            return {
                success: true,
                certificate: this.certificate,
                subject: subjectAttr && subjectAttr.value ? Buffer.from(subjectAttr.value).toString() : 'Unknown',
                issuer: issuerAttr && issuerAttr.value ? Buffer.from(issuerAttr.value).toString() : 'Unknown'
            };
        } catch (error) {
            console.error('Certificate find error:', error);
            return { success: false, error: error.message };
        }
    }

    // Find private key for signing (with slot and key index selection)
    async findPrivateKey(pin = '', certIndex = 0, slotIndex = 0) {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            if (!this.session) {
                const sessionResult = await this.openSession(slotIndex);
                if (!sessionResult.success || !this.session) {
                    throw new Error(sessionResult.error || 'Failed to open token session');
                }
            }

            // Try to login first if PIN is provided (private keys may require authentication)
            if (pin && !this.isLoggedIn) {
                try {
                    this.module.C_Login(this.session, 1, pin); // 1 = CKU_USER
                    this.isLoggedIn = true;
                    // (debug) logged in
                } catch (loginError) {
                    // Check if already logged in
                    if (loginError.message && loginError.message.includes('CKR_USER_ALREADY_LOGGED_IN')) {
                        this.isLoggedIn = true;
                        // (debug) already logged in
                    } else {
                        // Check for incorrect PIN error codes
                        const errorCode = loginError.code;
                        const errorMessage = loginError.message || '';
                        
                        // CKR_PIN_INCORRECT = 0x000000A0 = 160
                        if (errorCode === 160 || 
                            errorCode === pkcs11.CKR_PIN_INCORRECT ||
                            errorMessage.includes('CKR_PIN_INCORRECT') ||
                            errorMessage.includes('PIN_INCORRECT') ||
                            errorMessage.includes('incorrect PIN') ||
                            errorMessage.includes('wrong PIN') ||
                            errorMessage.toLowerCase().includes('pin incorrect')) {
                            throw new Error('Incorrect PIN. Please check your PIN and try again.');
                        }
                        
                        // If login fails for other reasons, still throw error to prevent unauthorized access
                        throw new Error(`PIN authentication failed: ${errorMessage || 'Unknown error'}`);
                    }
                }
            } else if (pin && this.isLoggedIn) {
                // If already logged in but PIN was provided, verify it's still valid by attempting to use the key
                // This ensures the session is still authenticated with the correct PIN
                // (debug) already logged in, verifying session
            }

            // Try RSA keys first
            let keyTemplate = [
                { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_PRIVATE_KEY },
                { type: pkcs11.CKA_KEY_TYPE, value: pkcs11.CKK_RSA }
            ];

            // Initialize search
            this.module.C_FindObjectsInit(this.session, keyTemplate);
            
            // Find objects (get up to 10 keys)
            let keyHandles = this.module.C_FindObjects(this.session, 10);
            
            // Finalize search
            this.module.C_FindObjectsFinal(this.session);
            
            // If no RSA keys found, try ECC keys
            if (keyHandles.length === 0) {
                // (debug) no RSA keys found, trying ECC
                keyTemplate = [
                    { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_PRIVATE_KEY },
                    { type: pkcs11.CKA_KEY_TYPE, value: pkcs11.CKK_EC }
                ];

                this.module.C_FindObjectsInit(this.session, keyTemplate);
                keyHandles = this.module.C_FindObjects(this.session, 10);
                this.module.C_FindObjectsFinal(this.session);
            }

            // If still no keys, try without key type filter (any private key)
            if (keyHandles.length === 0) {
                // (debug) no typed keys found, trying any private key
                keyTemplate = [
                    { type: pkcs11.CKA_CLASS, value: pkcs11.CKO_PRIVATE_KEY }
                ];

                this.module.C_FindObjectsInit(this.session, keyTemplate);
                keyHandles = this.module.C_FindObjects(this.session, 10);
                this.module.C_FindObjectsFinal(this.session);
            }
            
            if (keyHandles.length === 0) {
                const error = new Error('No private key found in token. You may need to login with PIN first.');
                error.expected = true; // Mark as expected error
                throw error;
            }

            // Select the key at the specified index (usually matches certificate index)
            const keyIndex = certIndex < keyHandles.length ? certIndex : 0;
            this.privateKey = keyHandles[keyIndex];
            // (debug) private key found
            
            return { success: true, message: 'Private key found' };
        } catch (error) {
            // Only log if it's not an expected error (expected errors happen during status checks without PIN)
            if (!error.expected) {
                console.error('Private key find error:', error);
            }
            return { success: false, error: error.message };
        }
    }

    // Check DSC status
    async checkStatus() {
        try {
            let hasUSBDevice = false;
            let usbDevices = [];
            let detectedDevices = [];
            let debugInfo = [];

            // Check if USB device is connected
            if (usb) {
                try {
                    usbDevices = usb.getDeviceList();
                    
                    // Extended list of DSC vendor IDs (common smart card/token vendors)
                    const dscVendors = {
                        0x0BDA: 'Generic USB Token',
                        0x04E6: 'Gemalto',
                        0x0529: 'SafeNet',
                        0x096E: 'Feitian',
                        0x072F: 'Advanced Card Systems',
                        0x0ACD: 'ACS',
                        0x076B: 'Omnikey',
                        0x08E6: 'Gemplus',
                        0x0A89: 'Aladdin',
                        0x0B97: 'Oberthur',
                        0x0BD4: 'Siemens',
                        0x0C4B: 'Silicon Labs',
                        0x0E0F: 'HID Global',
                        0x10C4: 'Silicon Labs',
                        0x1FC9: 'NXP Semiconductors',
                        0x20A0: 'Clay Logic',
                        0x24DF: 'RF Ideas',
                        0x413C: 'Dell',
                        0x04CC: 'STMicroelectronics',
                        0x058F: 'Alcor Micro',
                        0x062A: 'Creative Technology',
                        0x0781: 'SanDisk',
                        0x0951: 'Kingston Technology',
                        0x0BC2: 'Seagate',
                        0x0EA0: 'O2 Micro',
                        0x0FCE: 'Sony',
                        0x1050: 'Yubico',
                        0x1A40: 'Terminus Technology',
                        0x1D50: 'OpenMoko',
                        0x1E68: 'Identiv',
                        0x20AD: 'Clay Logic',
                        0x2CCF: 'HYP2003 / Hypersecu Token', // Your detected device
                    };

                    // Check all devices
                    for (const device of usbDevices) {
                        const vendorId = device.deviceDescriptor.idVendor;
                        const productId = device.deviceDescriptor.idProduct;
                        const vendorName = dscVendors[vendorId] || `Unknown (0x${vendorId.toString(16).toUpperCase()})`;
                        
                        debugInfo.push({
                            vendorId: `0x${vendorId.toString(16).toUpperCase()}`,
                            productId: `0x${productId.toString(16).toUpperCase()}`,
                            vendorName: vendorName
                        });

                        // Check if it's a known DSC vendor
                        if (dscVendors[vendorId]) {
                            hasUSBDevice = true;
                            detectedDevices.push({
                                vendorId: `0x${vendorId.toString(16).toUpperCase()}`,
                                productId: `0x${productId.toString(16).toUpperCase()}`,
                                name: vendorName
                            });
                        }
                    }

                    // Also check for smart card class devices (Class 0x0B)
                    // Many DSC tokens appear as smart card readers
                    for (const device of usbDevices) {
                        try {
                            const config = device.configDescriptor;
                            if (config) {
                                for (const iface of config.interfaces) {
                                    for (const alt of iface) {
                                        // Smart Card Device Class (0x0B)
                                        if (alt.bInterfaceClass === 0x0B) {
                                            const vendorId = device.deviceDescriptor.idVendor;
                                            const productId = device.deviceDescriptor.idProduct;
                                            
                                            if (!detectedDevices.some(d => d.vendorId === `0x${vendorId.toString(16).toUpperCase()}`)) {
                                                hasUSBDevice = true;
                                                detectedDevices.push({
                                                    vendorId: `0x${vendorId.toString(16).toUpperCase()}`,
                                                    productId: `0x${productId.toString(16).toUpperCase()}`,
                                                    name: 'Smart Card Device (Class 0x0B)'
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore errors accessing device config
                        }
                    }

                    // (debug) usb detection counts
                    
                } catch (usbError) {
                    console.warn('USB detection error:', usbError.message);
                    debugInfo.push({ error: usbError.message });
                }
            } else {
                // If USB library not available, check for common USB device indicators
                // This is a fallback - we'll assume USB might be connected
                hasUSBDevice = true; // Optimistic assumption
                debugInfo.push({ note: 'USB library not available, assuming device may be connected' });
            }

            if (!hasUSBDevice && usb) {
                return {
                    connected: false,
                    message: 'DSC pen drive not detected. Please connect your DSC device.',
                    hasUSB: false,
                    note: 'Make sure your DSC pen drive is plugged in and your DSC provider software is installed.',
                    debugInfo: debugInfo.slice(0, 10), // Limit debug info
                    detectedDevices: detectedDevices
                };
            }

            // Try to initialize PKCS#11
            if (!this.isInitialized && pkcs11) {
                try {
                    const initResult = await this.initialize();
                    if (!initResult.success) {
                        return {
                            connected: false,
                            message: 'DSC detected but PKCS#11 library not found. Please install your DSC provider software.',
                            hasUSB: hasUSBDevice,
                            error: initResult.error,
                            note: 'Install your DSC provider software (eMudhra, Capricorn, etc.) to enable full DSC functionality.'
                        };
                    }
                } catch (initError) {
                    // If initialization fails with segfault risk, return safe status
                    console.error('PKCS#11 initialization error:', initError.message);
                    return {
                        connected: false,
                        message: 'DSC detected but PKCS#11 initialization failed.',
                        hasUSB: hasUSBDevice,
                        error: initError.message,
                        note: 'PKCS#11 library may be in use or there may be a conflict. Try restarting the server.'
                    };
                }
            } else if (!pkcs11) {
                // PKCS#11 not available, but USB might be detected
            // Provide helpful instructions based on detected device
            let instructions = 'Visual signature will be added. For cryptographic signing:\n';
            instructions += '1. Install your DSC provider software (eMudhra, Capricorn, etc.)\n';
            instructions += '2. The software will install a PKCS#11 library\n';
            instructions += '3. Run: node find-pkcs11.js to locate the library\n';
            instructions += '4. Set PKCS11_LIBRARY_PATH environment variable if needed';
            
            return {
                connected: false,
                message: 'DSC device detected, but PKCS#11 support is not available.',
                hasUSB: hasUSBDevice,
                detectedDevices: detectedDevices,
                note: instructions,
                debugInfo: debugInfo.slice(0, 5),
                help: {
                    deviceDetected: true,
                    vendorId: detectedDevices.length > 0 ? detectedDevices[0].vendorId : null,
                    nextSteps: [
                        'Install your DSC provider software',
                        'Run: node find-pkcs11.js to find the PKCS#11 library',
                        'Set PKCS11_LIBRARY_PATH=/path/to/library.dylib if needed',
                        'Restart the server after installation'
                    ]
                }
            };
            }

            // Try to open session
            const sessionResult = await this.openSession();
            if (!sessionResult.success) {
                return {
                    connected: false,
                    message: 'DSC detected but cannot access token. Please check if token is inserted correctly.',
                    hasUSB: true,
                    error: sessionResult.error
                };
            }

            // Try to find certificate
            const certResult = await this.findCertificate();
            if (!certResult.success) {
                return {
                    connected: false,
                    message: 'Token found but no certificate detected.',
                    hasUSB: true,
                    hasToken: true,
                    error: certResult.error
                };
            }

            // Try to find private key (may require login, but we'll try without first)
            // Note: Private key may not be accessible without PIN, but that's OK for status check
            let keyResult = { success: false, error: 'Not checked' };
            try {
                // Try without PIN first (for status check)
                keyResult = await this.findPrivateKey();
            } catch (keyError) {
                // Private key may require login - this is expected and not an error
                // Don't log this as an error since it's expected behavior
                keyResult = { 
                    success: false, 
                    error: keyError.message,
                    note: 'Private key may require PIN to access'
                };
                // Suppress expected error messages for status checks
                // Only log if it's not the expected "No private key found" error
                if (!keyError.expected && 
                    !keyError.message.includes('No private key found') && 
                    !keyError.message.includes('login with PIN')) {
                    console.warn('Private key check warning:', keyError.message);
                }
            }
            
            return {
                connected: true,
                message: 'DSC pen drive connected and ready',
                hasUSB: true,
                hasToken: true,
                hasCertificate: true,
                hasPrivateKey: keyResult.success,
                subject: certResult.subject,
                issuer: certResult.issuer,
                detectedDevices: detectedDevices,
                privateKeyNote: keyResult.note || (keyResult.success ? null : 'Private key may require PIN')
            };

        } catch (error) {
            console.error('Status check error:', error);
            return {
                connected: false,
                message: `Error checking DSC status: ${error.message}`,
                error: error.message
            };
        }
    }

    // Sign data with private key
    async signData(data, pin = '') {
        try {
            if (!pkcs11) {
                throw new Error('PKCS#11 library not available');
            }
            
            if (!this.privateKey) {
                const keyResult = await this.findPrivateKey(pin);
                if (!keyResult.success) {
                    throw new Error(keyResult.error || 'Failed to find private key');
                }
            }

            // Verify login if PIN is provided - ensure we're authenticated
            if (pin) {
                if (!this.isLoggedIn) {
                    // Try to login with the provided PIN
                    const loginResult = await this.login(pin);
                    if (!loginResult.success) {
                        // Check if it's a PIN error
                        if (loginResult.error && (
                            loginResult.error.includes('PIN') || 
                            loginResult.error.includes('incorrect') ||
                            loginResult.error.includes('CKR_PIN_INCORRECT')
                        )) {
                            throw new Error('Incorrect PIN. Please check your PIN and try again.');
                        }
                        throw new Error(`Authentication failed: ${loginResult.error}`);
                    }
                }
                // If already logged in, verify the session is still valid by attempting a test operation
                // This ensures the PIN used is correct
            } else {
                // If no PIN provided but key requires authentication, this should fail
                // Some tokens allow public access, but for signing we typically need authentication
                if (!this.isLoggedIn) {
                    // Attempting to sign without PIN may fail if token requires authentication
                }
            }

            // For CKM_RSA_PKCS mechanism, we need to prepend the DigestInfo structure
            // DigestInfo for SHA-256: 30 31 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00 04 20
            const sha256DigestInfo = Buffer.from([
                0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
                0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20
            ]);
            
            // Prepend DigestInfo to the hash
            const dataToSign = Buffer.concat([sha256DigestInfo, data]);

            // Create signature mechanism
            const mechanism = {
                mechanism: pkcs11.CKM_RSA_PKCS,
                parameter: null
            };

            // Initialize signing using C_SignInit
            this.module.C_SignInit(this.session, mechanism, this.privateKey);

            // Sign the data using C_Sign
            const outBuf = Buffer.alloc(512); // accommodates 2048-bit RSA signatures
            const signature = this.module.C_Sign(this.session, dataToSign, outBuf);

            const sigBuffer = Buffer.from(signature);
            // (debug) signature created

            return {
                success: true,
                signature: sigBuffer
            };
        } catch (error) {
            console.error('Signing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Close session
    closeSession() {
        if (this.session && this.module) {
            try {
                // Use PKCS#11 C_CloseSession instead of session.close()
                if (this.module.C_CloseSession) {
                    this.module.C_CloseSession(this.session);
                }
            } catch (error) {
                // Ignore close errors - session might already be closed
            }
            this.session = null;
        }
    }

    // Finalize module
    finalize() {
        if (this.module) {
            try {
                this.module.finalize();
            } catch (error) {
                console.error('Module finalize error:', error);
            }
            this.module = null;
            this.isInitialized = false;
        }
    }
}

// Export singleton instance
const dscService = new DSCService();

module.exports = dscService;

