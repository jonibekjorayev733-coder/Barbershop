export const UZBEKISTAN_PHONE_PREFIX = "998";
export const UZBEKISTAN_PHONE_DIGITS = 12;
export const UZBEKISTAN_PHONE_DISPLAY_MAX = 17;

function onlyDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeUzbekPhone(value: string): string {
  const digits = onlyDigits(value);

  if (!digits) {
    return UZBEKISTAN_PHONE_PREFIX;
  }

  if (digits.startsWith(UZBEKISTAN_PHONE_PREFIX)) {
    return digits.slice(0, UZBEKISTAN_PHONE_DIGITS);
  }

  if (digits.startsWith("8")) {
    return `${UZBEKISTAN_PHONE_PREFIX}${digits.slice(1)}`.slice(0, UZBEKISTAN_PHONE_DIGITS);
  }

  if (digits.length <= 9) {
    return `${UZBEKISTAN_PHONE_PREFIX}${digits}`.slice(0, UZBEKISTAN_PHONE_DIGITS);
  }

  return digits.slice(0, UZBEKISTAN_PHONE_DIGITS);
}

export function formatUzbekPhone(value: string, options?: { keepPrefixWhenEmpty?: boolean }): string {
  const keepPrefixWhenEmpty = options?.keepPrefixWhenEmpty ?? true;
  const normalized = normalizeUzbekPhone(value);
  const digits = keepPrefixWhenEmpty ? normalized : onlyDigits(value);

  if (!digits) {
    return "";
  }

  const prefix = digits.slice(0, 3);
  const rest = digits.slice(3, 12);
  const first = rest.slice(0, 2);
  const second = rest.slice(2, 5);
  const third = rest.slice(5, 7);
  const fourth = rest.slice(7, 9);

  return [
    `+${prefix}`,
    first,
    second,
    third,
    fourth,
  ].filter(Boolean).join(" ");
}

export function toUzbekPhoneApi(value: string): string {
  return normalizeUzbekPhone(value);
}

export function isCompleteUzbekPhone(value: string): boolean {
  return normalizeUzbekPhone(value).length === UZBEKISTAN_PHONE_DIGITS;
}

export function hasOnlyPrefix(value: string): boolean {
  return normalizeUzbekPhone(value).length <= UZBEKISTAN_PHONE_PREFIX.length;
}

export function getUzbekPhonePlaceholder(): string {
  return "+998 90 123 45 67";
}
