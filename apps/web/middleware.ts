import { type NextRequest, NextResponse } from "next/server";

// Admin routes are handled by the AdminGuard component client-side
// This middleware can be extended for other protected routes if needed

export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // No protected routes at the moment - admin protection is handled client-side
  matcher: [],
};
