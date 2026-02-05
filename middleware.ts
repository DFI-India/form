import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  console.log('[Middleware]', pathname, 'User:', user ? user.id : 'none')

  // Public routes - no auth required
  const publicRoutes = ['/sign-in', '/unauthorized']
  if (publicRoutes.includes(pathname)) {
    console.log('[Middleware] Public route, allowing')
    return response
  }

  // Protect all other routes - must be authenticated
  if (!user) {
    console.log('[Middleware] No user, redirecting to /sign-in')
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // All authenticated users can access dashboard (it handles routing)
  if (pathname === '/dashboard' || pathname === '/') {
    return response
  }

  // For role-based routes, verify access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const roleRoutes: Record<string, string[]> = {
    field_volunteer: ['/field-volunteer'],
    dfi_field_staff: ['/dfi-field-staff'],
    dfi_staff: ['/dfi-staff'],
    admin: ['/admin', '/EAC_details'],
    tech_support: ['/tech-support'],
  }

  const userRole = profile?.role as string | undefined
  const allowedRoutes = userRole ? roleRoutes[userRole] || [] : []

  // Check if user can access this route
  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route))

  if (!hasAccess && !pathname.startsWith('/api')) {
    // Redirect to dashboard if accessing unauthorized route
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
