import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - /login
     *  - /api/auth/* (Auth.js internals)
 *  - /api/mobile/login (iOS token exchange; rate-limited in the route)
     *  - /api/plaid/webhook (verified by Plaid ES256 JWT instead — FR-004)
     *  - /linked (Hosted Link completion redirect — reached from the iOS
     *    in-app browser, which carries no web session cookie; the page
     *    itself reveals nothing sensitive)
     *  - /manifest.webmanifest
     *  - /sw.js
     *  - /icons/*
     *  - /apple-touch-icon* (covers apple-touch-icon.png and variants)
     *  - /apple-touch-startup-image/*
     *  - /~offline
     *  - /_next/* (Next.js internals, static assets, image opt)
     *  - /favicon.ico
     */
    "/((?!login|api/auth|api/mobile/login|api/plaid/webhook|linked|manifest\\.webmanifest|sw\\.js|icons/|apple-touch-icon|apple-touch-startup-image/|~offline|_next/|favicon\\.ico).*)",
  ],
};
