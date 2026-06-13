/**
 * Get the API URL based on environment
 * - Localhost: uses local backend
 * - Production: uses HTTPS backend
 */
export function getApiUrl(): string {
  // Allow explicit override from environment when available.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Check for common local development hostnames.
  if (typeof window !== 'undefined') {
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (localHosts.includes(window.location.hostname)) {
      return 'http://localhost:5002/api';
    }
  }

  return 'https://api.luxbae.in/api';
}
