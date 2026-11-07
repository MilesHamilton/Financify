/**
 * financify://oauth-return only brings the app forward after a bank's app
 * finishes OAuth; the still-open Plaid sheet resumes on its own, so don't navigate.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.includes('oauth-return')) return initial ? '/' : null;
  return path;
}
