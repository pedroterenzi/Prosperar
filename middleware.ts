import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * ── Roteamento por papel ───────────────────────────────────────────────────
 * owner / receptionist → /app/admin/dashboard
 * barber               → /app/barber/agenda
 * client               → /app/client/history
 * (sem organização)    → /auth/signup-barbershop
 */
const HOME: Record<string, string> = {
  owner: '/app/admin/dashboard',
  receptionist: '/app/admin/dashboard',
  barber: '/app/barber/agenda',
  client: '/app/client/history',
};

/** Prefixo de rota → papéis autorizados (admin aceita dono e recepção). */
const GUARDS: { prefix: string; roles: string[] }[] = [
  { prefix: '/app/admin', roles: ['owner', 'receptionist'] },
  { prefix: '/app/barber', roles: ['barber'] },
  { prefix: '/app/client', roles: ['client', 'owner', 'barber', 'receptionist'] },
];

const LOGIN_ROUTES = ['/auth/login', '/auth/sign-in', '/auth/sign-up'];

const homeFor = (role: string | null | undefined) => HOME[role ?? ''] ?? '/app/client/history';

/**
 * Middleware de multi-tenancy: valida a sessão e a role em public.profiles.
 * Espelha o RLS do banco — aqui é UX (redirecionar em vez de vazar 403).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida o JWT no servidor (getSession não é confiável no edge).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  /* Sem sessão: só as rotas públicas seguem; /app cai no login. */
  if (!user) {
    if (pathname.startsWith('/app')) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  /* Com sessão: carrega o papel uma única vez. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role as string | null) ?? 'client';
  const hasOrg = Boolean(profile?.org_id);

  /* Logado abrindo a tela de login → direciona pelo papel. */
  if (LOGIN_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = hasOrg ? homeFor(role) : '/auth/signup-barbershop';
    url.search = '';
    return NextResponse.redirect(url);
  }

  /* Onboarding já concluído → não faz sentido repetir. */
  if (pathname === '/auth/signup-barbershop' && hasOrg) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/app')) {
    // Owner recém-cadastrado (sem barbearia) conclui o onboarding antes.
    if (!hasOrg && pathname !== '/app') {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/signup-barbershop';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // /app é só um despachante: manda cada papel para a sua casa.
    if (pathname === '/app' || pathname === '/app/') {
      const url = request.nextUrl.clone();
      url.pathname = hasOrg ? homeFor(role) : '/auth/signup-barbershop';
      url.search = '';
      return NextResponse.redirect(url);
    }

    const guard = GUARDS.find((g) => pathname.startsWith(g.prefix));
    if (guard && !guard.roles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = homeFor(role);
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/app/:path*',
    '/app',
    '/auth/login',
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/signup-barbershop',
  ],
};
