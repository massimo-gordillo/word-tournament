// --- EST / Wordle calendar day (submission dates, cutoff) ---

export const EST_OFFSET = -5;
export const EDT_OFFSET = -4;

export function getESTOffset(date: Date): number {
  const year = date.getFullYear();

  const marchSecondSunday = new Date(year, 2, 1);
  marchSecondSunday.setDate(1 + ((7 - marchSecondSunday.getDay()) % 7) + 7);

  const novemberFirstSunday = new Date(year, 10, 1);
  novemberFirstSunday.setDate(1 + ((7 - novemberFirstSunday.getDay()) % 7));

  if (date >= marchSecondSunday && date < novemberFirstSunday) {
    return EDT_OFFSET;
  }
  return EST_OFFSET;
}

export function getDateInEST(date: Date = new Date()): Date {
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const estOffset = getESTOffset(date);
  const estTime = new Date(utcTime + 3600000 * estOffset);
  return estTime;
}

export function getTodayDateEST(): string {
  const estDate = getDateInEST();
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateEST(): string {
  const estDate = getDateInEST();
  estDate.setDate(estDate.getDate() - 1);
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimeUntilCutoff(cutoffHourEst: number = 23): {
  hours: number;
  minutes: number;
  seconds: number;
  isPastCutoff: boolean;
} {
  const estNow = getDateInEST();
  const hours = estNow.getHours();
  const minutes = estNow.getMinutes();
  const seconds = estNow.getSeconds();

  if (hours >= cutoffHourEst) {
    return { hours: 0, minutes: 0, seconds: 0, isPastCutoff: true };
  }

  const secondsUntilCutoff = (cutoffHourEst - hours) * 3600 - minutes * 60 - seconds;
  const hoursLeft = Math.floor(secondsUntilCutoff / 3600);
  const minutesLeft = Math.floor((secondsUntilCutoff % 3600) / 60);
  const secondsLeft = secondsUntilCutoff % 60;

  return { hours: hoursLeft, minutes: minutesLeft, seconds: secondsLeft, isPastCutoff: false };
}

// --- Display formatting (UI labels) ---

export type DateInput = Date | string;

const pad2 = (n: number) => n.toString().padStart(2, '0');
const monthShortNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
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

/** Normalize DB / ISO strings to a calendar date (YYYY-MM-DD). */
function toYyyyMmDd(dateStr: string): string | null {
  const m = dateStr.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

/**
 * Renders a submission date label, using "Today" when it matches the app's Wordle day (EST),
 * same as `getTodayDateEST`. Pass either `YYYY-MM-DD`, a literal `"Today"`, or any string
 * `formatDateShort` accepts.
 */
export function formatDateOrToday(dateStr: string): string {
  if (dateStr === 'Today') return 'Today';
  const ymd = toYyyyMmDd(dateStr);
  if (ymd && ymd === getTodayDateEST()) {
    return 'Today';
  }
  return formatDateShort(dateStr);
}
