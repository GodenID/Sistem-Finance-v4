/**
 * Utility to generate unique document numbers that won't conflict
 * even when multiple users submit at the same time.
 * 
 * Format: PREFIX-YYMMDD-XXXX (max 20 chars)
 * Example: PR-231223-A7B2
 * 
 * This format ensures:
 * 1. Uniqueness through date + random component (6 chars random)
 * 2. Sortability by date
 * 3. Human readable
 * 4. Fits within database varchar(20) limit
 */

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of the random string
 * @returns {string} Random alphanumeric string
 */
const generateRandomString = (length = 6) => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I,O,0,1 to avoid confusion
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

/**
 * Generate unique document number
 * @param {string} prefix - Document prefix (PR, KLM, KBN, PLN)
 * @returns {string} Unique document number (max 20 chars)
 */
export const generateUniqueNumber = (prefix) => {
    const now = new Date();

    // Format: YYMMDD (6 chars) - using 2-digit year to save space
    const dateStr = now.getFullYear().toString().slice(-2) +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');

    // Random component (6 chars for extra uniqueness)
    const randomStr = generateRandomString(6);

    // Combine: PREFIX-YYMMDD-XXXXXX
    // Examples: 
    // - PR-231223-ABC123 (16 chars)
    // - KLM-231223-ABC123 (17 chars)
    // - KBN-231223-ABC123 (17 chars)
    // - PLN-231223-ABC123 (17 chars)
    return `${prefix}-${dateStr}-${randomStr}`;
};

/**
 * Generate unique number for Payment Request
 * @returns {string} Unique PR number (16 chars max)
 */
export const generatePRNumber = () => generateUniqueNumber('PR');

/**
 * Generate unique number for Klaim
 * @returns {string} Unique Klaim number (17 chars max)
 */
export const generateKlaimNumber = () => generateUniqueNumber('KLM');

/**
 * Generate unique number for Kasbon
 * @returns {string} Unique Kasbon number (17 chars max)
 */
export const generateKasbonNumber = () => generateUniqueNumber('KBN');

/**
 * Generate unique number for Penyelesaian
 * @returns {string} Unique Penyelesaian number (17 chars max)
 */
export const generatePenyelesaianNumber = () => generateUniqueNumber('PLN');

export default {
    generateUniqueNumber,
    generatePRNumber,
    generateKlaimNumber,
    generateKasbonNumber,
    generatePenyelesaianNumber
};
