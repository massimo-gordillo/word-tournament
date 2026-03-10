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
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const estOffset = getESTOffset(date);
  const estTime = new Date(utcTime + (3600000 * estOffset));
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

export function getTimeUntilCutoff(cutoffHourEst: number = 23): { hours: number; minutes: number; seconds: number; isPastCutoff: boolean } {
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
