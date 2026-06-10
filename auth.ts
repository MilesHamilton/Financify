import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string;
          password: string;
        };

        if (
          !username ||
          !password ||
          username !== process.env.AUTH_USERNAME ||
          !process.env.AUTH_PASSWORD_HASH
        ) {
          return null;
        }

        const valid = await argon2.verify(
          process.env.AUTH_PASSWORD_HASH,
          password,
        );

        if (!valid) return null;

        return { id: "1", name: username };
      },
    }),
  ],
});
