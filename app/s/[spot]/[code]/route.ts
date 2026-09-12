import { requestOrigin } from '@/lib/server';
/**
 * Landing point for a poster QR opened by the phone's own camera app. The
 * stamp is never granted on this navigation: the participant cookie is
 * SameSite=Strict, so it is absent whenever the link is opened from another
 * site or from an in-app browser. Forwarding to the participant screen lets
 * that page send the code as a same-origin request, which always carries the
 * cookie and passes the same CSRF check as an in-app scan.
 */
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ spot: string; code: string }> },
) {
  const { spot, code } = await params;
  const target = new URL('/', requestOrigin(request));
  target.searchParams.set('stamp', `${spot}.${code}`);
  return new Response(null, {
    status: 303,
    headers: { location: target.toString(), 'Cache-Control': 'no-store' },
  });
}
