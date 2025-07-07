export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format as 0000 000 000
  if (digits.length <= 4) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
};

export const unformatPhoneNumber = (value: string): string => {
  return value.replace(/\D/g, '');
}; 