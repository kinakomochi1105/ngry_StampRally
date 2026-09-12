/**
 * Serving a stored map picture.
 *
 * The picture is kept as the data URL the organiser's browser produced, which
 * is what both the participant route and the console route hand back — decoded
 * to bytes, so a phone downloads the picture itself rather than a base64 blob
 * inside JSON, and can cache it.
 */
const pattern = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;

export function imageResponse(dataUrl: string | null, cacheSeconds: number) {
  const match = dataUrl?.match(pattern);
  if (!match)
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const [, type, encoded] = match;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(bytes.byteLength),
      // Private: a venue map is only for people who may see the site at all.
      // The id changes whenever a new picture is uploaded, so a stale copy in
      // a browser cache cannot outlive the map it belongs to.
      'Cache-Control': `private, max-age=${cacheSeconds}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
