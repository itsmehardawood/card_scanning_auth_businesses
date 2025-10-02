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
 * Validate if a string looks like a valid UUID (scan ID)
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid UUID format
 */
export const isValidScanId = (id) => {
  if (!id || typeof id !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};