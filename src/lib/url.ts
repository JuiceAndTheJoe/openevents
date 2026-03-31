/**
 * Returns the public-facing base URL of the application at runtime.
 *
 * OSC's entrypoint script (osc-entrypoint.sh) sets PUBLIC_URL from
 * OSC_HOSTNAME at container start. This function must be called inside
 * request handlers (not at module level) so the value is read at runtime,
 * not baked in at build time.
 */
export function getAppUrl(): string {
  return process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}
