export type DateInput = Date | string;

const pad2 = (n: number) => n.toString().padStart(2, '0');

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d); // interpret as local calendar date
  }
  return new Date(input);
}

/** Default format: yyyy/MM/dd */
export function formatDateDefault(input: DateInput): string {
  const d = toDate(input);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}/${m}/${day}`;
}

/** Short format: Mon dd (e.g. Mar 03) */
export function formatDateShort(input: DateInput): string {
  const d = toDate(input);
  const month = monthShortNames[d.getMonth()] ?? '';
  const day = pad2(d.getDate());
  return `${month} ${day}`;
}

/** If `dateStr` is calendar-today (local), returns "Today"; otherwise `formatDateShort`. Pass-through for literal "Today". */
export function formatDateOrToday(dateStr: string): string {
  if (dateStr === 'Today') return 'Today';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = toDate(dateStr);
    const t = new Date();
    if (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    ) {
      return 'Today';
    }
  }
  return formatDateShort(dateStr);
}