import "server-only";
import argon2 from "argon2";

/** Single-user credential check shared by the web login and the mobile token endpoint. */
export async function verifyCredentials(
  username: unknown,
  password: unknown,
): Promise<boolean> {
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username ||
    !password ||
    username !== process.env.AUTH_USERNAME ||
    !process.env.AUTH_PASSWORD_HASH
  ) {
    return false;
  }
  return argon2.verify(process.env.AUTH_PASSWORD_HASH, password);
}
