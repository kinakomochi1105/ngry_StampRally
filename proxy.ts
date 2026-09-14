import { env } from '@/lib/env';
import { maintenanceResponse } from '@/lib/maintenance';

/**
 * Runs in front of every participant page and API. Its only job is
 * maintenance mode (lib/maintenance.ts): with MAINTENANCE_MODE unset, every
 * request passes through untouched.
 */
export function proxy(request: Request) {
  if (env.MAINTENANCE_MODE) return maintenanceResponse(request);
}

export const config = {
  matcher: [
    // Not the organiser console (/admin, /api/admin), which has to stay usable
    // to end maintenance, nor Next's build output and files in public/, which
    // the console loads as well.
    '/((?!admin(?:/|$)|api/admin(?:/|$)|_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)',
  ],
};
