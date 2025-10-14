// Utility functions for URL parameter extraction

/**
 * Extract business name and scan ID from URL
 * Expected URL pattern: http://localhost:3000/businessname/scanId
 * @returns {Object} { businessName: string, scanId: string }
 */
export const getUrlParameters = () => {
  if (typeof window === 'undefined') {
    return { businessName: null, scanId: null };
  }

  try {
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/').filter(segment => segment);
    
    // Expected format: /businessname/scanId
    if (pathSegments.length >= 2) {
      const businessName = pathSegments[0];
      const scanId = pathSegments[1];
      
      console.log('🔍 URL Parameters extracted:', { businessName, scanId });
      return { businessName, scanId };
    }
    
    console.log('⚠️ URL parameters not found in expected format');
    return { businessName: null, scanId: null };
  } catch (error) {
    console.error('❌ Error extracting URL parameters:', error);
    return { businessName: null, scanId: null };
  }
};

/**
 * Validate if a string is a valid scan ID (accepts any format)
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid scan ID format
 */
export const isValidScanId = (id) => {
  if (!id || typeof id !== 'string') return false;
  
  // Accept any non-empty string with alphanumeric characters, hyphens, and underscores
  // Minimum length of 3 characters to ensure it's not just empty or whitespace
  const scanIdRegex = /^[a-zA-Z0-9_-]{3,}$/;
  return scanIdRegex.test(id.trim());
};