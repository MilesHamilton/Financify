import * as WebBrowser from 'expo-web-browser';

/**
 * Plaid's return links (financify://oauth-return after a bank's app, financify://linked
 * when Link finishes in Safari) only bring the app forward; don't navigate.
 * Settings reopens Link on oauth-return; a session finished in Safari leaves the sheet stale.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.includes('linked')) WebBrowser.dismissAuthSession();
  if (/oauth-return|linked/.test(path)) return initial ? '/' : null;
  return path;
}
