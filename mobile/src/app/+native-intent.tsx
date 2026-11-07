import * as WebBrowser from 'expo-web-browser';

/**
 * Plaid's return links (financify://oauth-return after a bank's app, financify://linked
 * when Link finishes in Safari) only bring the app forward; don't navigate.
 * A finished session in Safari leaves the in-app Plaid sheet stale, so close it.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.includes('linked')) WebBrowser.dismissAuthSession();
  if (/oauth-return|linked/.test(path)) return initial ? '/' : null;
  return path;
}
