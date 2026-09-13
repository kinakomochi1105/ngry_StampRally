/**
 * Landing point for a poster QR opened by the phone's own camera app. The
 * stamp is never granted on this navigation: the participant cookie is
 * SameSite=Strict, so it is absent whenever the link is opened from another
 * site or from an in-app browser. Forwarding to the participant screen lets
 * that page send the code as a same-origin request, which always carries the
 * cookie and passes the same CSRF check as an in-app scan.
 *
 * The Location is relative, so no request header can point it at another host.
 */
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spot: string; code: string }> },
) {
  const { spot, code } = await params;
  const query = new URLSearchParams({ stamp: `${spot}.${code}` });
  return new Response(null, {
    status: 303,
    headers: { location: `/?${query}`, 'Cache-Control': 'no-store' },
  });
}
