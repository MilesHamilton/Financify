const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** $1,234.56 — pass `whole` for $1,235. Sign is kept (−$12.00). */
export const money = (n: number, whole = false) => (whole ? usd0 : usd).format(n);

/** $3.2k / $1.1M for chart labels and calendar cells. */
export function moneyCompact(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${Math.round(a)}`;
}

/** "YYYY-MM-DD" parsed as a local calendar date (no UTC shift). */
export const parseDay = (d: string) => new Date(`${d}T00:00:00`);

export const dayLabel = (d: string) =>
  parseDay(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const shortDate = (d: string) =>
  parseDay(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const monthLabel = (m: string) =>
  parseDay(`${m}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
