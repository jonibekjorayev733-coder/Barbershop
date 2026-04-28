const TASHKENT_TIME_ZONE = "Asia/Tashkent";

function getDateParts(now: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TASHKENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((item) => item.type === "year")?.value ?? "1970";
  const month = parts.find((item) => item.type === "month")?.value ?? "01";
  const day = parts.find((item) => item.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function getTashkentTodayISO(now: Date = new Date()): string {
  const { year, month, day } = getDateParts(now);
  return `${year}-${month}-${day}`;
}

export function formatIsoDateInTashkent(
  isoDate: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const anchor = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: TASHKENT_TIME_ZONE }).format(anchor);
}

export function formatNowInTashkent(locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: TASHKENT_TIME_ZONE }).format(new Date());
}
