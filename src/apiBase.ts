// Base URL for the backend. On Vercel this is set via the VITE_API_URL
// environment variable (e.g. https://salon-queue-backend-msv3.onrender.com).
// Locally it's empty, so fetch('/api/...') keeps using Vite's dev proxy.
export const API_BASE: string = (import.meta as any).env?.VITE_API_URL || '';

// Use this to build any API path: apiUrl('/api/queue/overview')
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
