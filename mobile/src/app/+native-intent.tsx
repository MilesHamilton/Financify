import * as WebBrowser from 'expo-web-browser';

/**
 * financify://linked from Safari (Link finished there after a bank's own app)
 * only brings the app forward: close the now-stale Plaid sheet, don't navigate.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!path.includes('linked')) return path;
  WebBrowser.dismissAuthSession();
  return initial ? '/' : null;
}
