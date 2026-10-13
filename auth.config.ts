import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      // Bearer-token API calls (iOS app, Vercel cron) are verified inside each route.
      if (
        nextUrl.pathname.startsWith("/api/") &&
        headers.get("authorization")?.startsWith("Bearer ")
      ) {
        return true;
      }
      const isLoggedIn = !!auth?.user;
      const isAuthRoute = nextUrl.pathname.startsWith("/login");
      if (isAuthRoute) {
        // Already logged in — send to home
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
  },
  providers: [],
};
