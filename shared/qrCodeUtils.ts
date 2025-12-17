import crypto from 'crypto';

// Secret key for hash generation (should be stored in environment variables in production)
const QR_CODE_SECRET = process.env.QR_CODE_SECRET || 'default_secret_key_change_in_production';

/**
 * Generates a secure hash for QR code validation
 * @param restaurantId - The restaurant ID
 * @param tableNumber - The table number
 * @param timestamp - Optional timestamp (for backward compatibility, but not used in new deterministic approach)
 * @returns A secure hash string
 */
export function generateQRCodeHash(restaurantId: string, tableNumber: string, timestamp?: number): string {
  // Use deterministic hash based only on restaurant ID and table number
  // This ensures the same table always gets the same QR code
  const data = `${restaurantId}:${tableNumber}`;
  
  // Create HMAC hash using SHA-256
  const hash = crypto.createHmac('sha256', QR_CODE_SECRET)
    .update(data)
    .digest('hex');
  
  // Return a shorter, more manageable hash (first 16 characters)
  return hash.substring(0, 16);
}

/**
 * Validates a QR code hash
 * @param restaurantId - The restaurant ID
 * @param tableNumber - The table number
 * @param hash - The hash to validate
 * @param maxAge - Maximum age of the hash in milliseconds (not used in deterministic approach, kept for backward compatibility)
 * @returns Object with validation result
 */
export function validateQRCodeHash(
  restaurantId: string, 
  tableNumber: string, 
  hash: string, 
  maxAge: number = 365 * 24 * 60 * 60 * 1000 // 1 year (kept for backward compatibility)
): { isValid: boolean; timestamp?: number; error?: string } {
  try {
    // Check if hash is the correct length
    if (hash.length !== 16) {
      return { isValid: false, error: 'Invalid hash format' };
    }

    // Generate the expected hash using the deterministic approach
    const expectedHash = generateQRCodeHash(restaurantId, tableNumber);
    
    if (expectedHash === hash) {
      return { isValid: true, timestamp: Date.now() };
    }

    return { isValid: false, error: 'Invalid hash' };
  } catch (error) {
    return { isValid: false, error: 'Hash validation failed' };
  }
}

/**
 * Generates a complete QR code URL
 * @param baseUrl - The base URL of the application
 * @param restaurantId - The restaurant ID
 * @param tableNumber - The table number
 * @returns Complete QR code URL with hash
 */
export function generateQRCodeUrl(baseUrl: string, restaurantId: string, tableNumber: string): string {
  const hash = generateQRCodeHash(restaurantId, tableNumber);
  return `${baseUrl}/table/${restaurantId}/${tableNumber}/${hash}`;
}

/**
 * Parses a QR code URL to extract components
 * @param url - The QR code URL
 * @returns Object with parsed components or null if invalid
 */
export function parseQRCodeUrl(url: string): { restaurantId: string; tableNumber: string; hash: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part);
    
    if (pathParts.length === 4 && pathParts[0] === 'table') {
      return {
        restaurantId: pathParts[1],
        tableNumber: pathParts[2],
        hash: pathParts[3]
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generates a secure hash for organization QR code validation
 * @param organizationId - The organization ID
 * @param address - The address where QR is scanned
 * @returns A secure hash string
 */
export function generateOrganizationQRCodeHash(organizationId: string, address: string): string {
  const data = `${organizationId}:${address}`;
  const hash = crypto.createHmac('sha256', QR_CODE_SECRET)
    .update(data)
    .digest('hex');
  return hash.substring(0, 16);
}

/**
 * Validates an organization QR code hash
 * @param organizationId - The organization ID
 * @param address - The address
 * @param hash - The hash to validate
 * @returns Object with validation result
 */
export function validateOrganizationQRCodeHash(
  organizationId: string,
  address: string,
  hash: string
): { isValid: boolean; error?: string } {
  try {
    if (hash.length !== 16) {
      return { isValid: false, error: 'Invalid hash format' };
    }

    const expectedHash = generateOrganizationQRCodeHash(organizationId, address);
    
    if (expectedHash === hash) {
      return { isValid: true };
    }

    return { isValid: false, error: 'Invalid hash' };
  } catch (error) {
    return { isValid: false, error: 'Hash validation failed' };
  }
}

/**
 * Generates a complete organization QR code URL
 * @param baseUrl - The base URL of the application
 * @param organizationId - The organization ID
 * @param address - The address (URL encoded)
 * @returns Complete QR code URL with hash
 */
export function generateOrganizationQRCodeUrl(baseUrl: string, organizationId: string, address: string): string {
  const hash = generateOrganizationQRCodeHash(organizationId, address);
  const encodedAddress = encodeURIComponent(address);
  return `${baseUrl}/org-qr/${organizationId}/${encodedAddress}/${hash}`;
}

/**
 * Parses an organization QR code URL to extract components
 * @param url - The QR code URL
 * @returns Object with parsed components or null if invalid
 */
export function parseOrganizationQRCodeUrl(url: string): { organizationId: string; address: string; hash: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part);
    
    if (pathParts.length === 4 && pathParts[0] === 'org-qr') {
      return {
        organizationId: pathParts[1],
        address: decodeURIComponent(pathParts[2]),
        hash: pathParts[3]
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}