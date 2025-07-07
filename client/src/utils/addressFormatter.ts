/**
 * Formats an address for display by removing state, postcode, and country
 * Returns only street address and suburb
 * 
 * @param address - Full address string
 * @returns Formatted address with only street address and suburb
 * 
 * @example
 * formatAddress("40-42 Mills Road, Braeside VIC 3195 Australia")
 * // Returns: "40-42 Mills Road, Braeside"
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';

  // Remove country (with or without preceding comma)
  let cleaned = address.replace(/,?\s*Australia\s*$/i, '');

  // Remove state and postcode (e.g., VIC 3195, NSW 2000, etc.)
  cleaned = cleaned.replace(/,?\s*(VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\s*\d{4}\s*$/i, '');

  // Remove state only if present at the end (e.g., ... , VIC)
  cleaned = cleaned.replace(/,?\s*(VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\s*$/i, '');

  // Remove postcode only if present at the end (e.g., ... , 3195)
  cleaned = cleaned.replace(/,?\s*\d{4}\s*$/i, '');

  // Split into parts and return only street and suburb
  const parts = cleaned.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return cleaned;
}; 