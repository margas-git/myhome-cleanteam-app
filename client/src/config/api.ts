// API Configuration
// This handles different environments (development vs production)

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Check if we're in development (localhost) or production
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    // In development, use relative URLs (Vite proxy handles this)
    return endpoint;
  } else {
    // In production (Railway), the backend and frontend are served from the same domain
    // but the backend handles /api routes directly
    // For SSE connections, we need to ensure we're connecting to the right endpoint
    
    // For Railway, the backend serves both the API and the frontend static files
    // So we can use relative URLs, but we need to ensure the SSE connection works
    
    // Try relative URL first (most common case for Railway)
    return endpoint;
  }
};

// Special function for SSE connections that handles CORS and connection issues
export const buildSSEUrl = (endpoint: string): string => {
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  console.log('🌐 buildSSEUrl called:', {
    endpoint,
    hostname: window.location.hostname,
    port: window.location.port,
    protocol: window.location.protocol,
    isDevelopment
  });
  
  if (isDevelopment) {
    console.log('🔧 Development mode - using relative URL:', endpoint);
    return endpoint;
  } else {
    // For production, try to use the same domain but ensure it works
    // If this doesn't work, we can add fallback logic
    console.log('🚀 Production mode - using relative URL:', endpoint);
    return endpoint;
  }
}; 