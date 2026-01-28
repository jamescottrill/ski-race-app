/**
 * Utility functions for hashing sensitive data like service numbers.
 * Uses SHA-256 for one-way hashing.
 */

/**
 * Hash a service number using SHA-256.
 * Returns null if the input is null/undefined/empty.
 * @param {string} serviceNumber - The service number to hash
 * @returns {string|null} - The SHA-256 hash in hex format, or null if no input
 */
const hashServiceNumber = async (serviceNumber) => {
  if (!serviceNumber || serviceNumber.trim() === '') {
    return null;
  }

  // Normalise the service number (trim whitespace, convert to uppercase)
  const normalised = serviceNumber.trim().toUpperCase();

  // Use the Web Crypto API (available in Electron renderer)
  const encoder = new TextEncoder();
  const data = encoder.encode(normalised);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
};

/**
 * Synchronous version of hashServiceNumber for use in contexts where async isn't convenient.
 * Uses a simple hash function - for display/UI purposes only, not security-critical.
 * @param {string} serviceNumber - The service number to hash
 * @returns {string|null} - A hash string, or null if no input
 */
const hashServiceNumberSync = (serviceNumber) => {
  if (!serviceNumber || serviceNumber.trim() === '') {
    return null;
  }

  // Normalise the service number
  const normalised = serviceNumber.trim().toUpperCase();

  // Simple hash using djb2 algorithm - fast but not cryptographic
  // This is only for non-security-critical operations
  let hash = 5381;
  for (let i = 0; i < normalised.length; i++) {
    hash = ((hash << 5) + hash) + normalised.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
};

export { hashServiceNumber, hashServiceNumberSync };
