import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - /login
     *  - /api/auth/* (Auth.js internals)
     *  - /api/plaid/webhook (verified by Plaid ES256 JWT instead — FR-004)
     *  - /manifest.webmanifest
     *  - /sw.js
     *  - /icons/*
     *  - /apple-touch-icon* (covers apple-touch-icon.png and variants)
     *  - /apple-touch-startup-image/*
     *  - /~offline
     *  - /_next/* (Next.js internals, static assets, image opt)
     *  - /favicon.ico
     */
    "/((?!login|api/auth|api/plaid/webhook|manifest\\.webmanifest|sw\\.js|icons/|apple-touch-icon|apple-touch-startup-image/|~offline|_next/|favicon\\.ico).*)",
  ],
};
