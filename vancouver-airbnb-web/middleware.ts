import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Add CORP headers to Next.js static chunks so they work with COEP
  // This is required when COEP is enabled on the HTML page
  if (pathname.startsWith('/_next/static/')) {
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return response;
  }

  // Only apply COOP/COEP headers to HTML pages (not to Next.js internal routes or static assets)
  // This prevents 500 errors on Next.js chunks while still enabling SharedArrayBuffer support
  if (
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/api/') &&
    !pathname.match(/\.(js|mjs|wasm|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)
  ) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  // Add CORP headers to .mjs and .wasm files in public directory
  // These are needed for ONNX Runtime to work with COEP
  if (pathname.match(/\.(mjs|wasm)$/i) && !pathname.startsWith('/_next/')) {
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

