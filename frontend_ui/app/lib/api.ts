/**
 * Single source of truth for the backend base URL.
 *
 * Set NEXT_PUBLIC_API_URL in the environment (.env.local locally, the Vercel
 * project settings in production). The localhost fallback only exists so a
 * fresh clone runs without configuration.
 */
export function apiUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
