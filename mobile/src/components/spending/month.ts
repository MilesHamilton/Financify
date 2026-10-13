/** Month helpers on "YYYY-MM" strings (local calendar). */
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const currentMonth = () => fmt(new Date());

export function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number);
  return fmt(new Date(y, mo - 1 + delta, 1));
}

export function daysInMonth(m: string): number {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}
