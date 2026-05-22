/**
 * Get the API URL based on environment
 * - Localhost: uses local backend
 * - Production: uses HTTPS backend
 */
export function getApiUrl(): string {
  // If an environment variable is set, prefer it (works for SSR and prod/dev)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In the browser, prefer a local backend when developing on localhost/127.0.0.1
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5002/api';
    }
  }

  // Fallback production backend (update if your backend domain differs)
  return 'https://lexvaro-backend.onrender.com/api';
}
