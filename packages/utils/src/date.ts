export const MS_PER_DAY = 86_400_000;
export const EPOCH_YEAR = 1970;
export const FIRST_SUNDAY_OFFSET = 4;

export function toUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseLocalDate(dateString: string): Date {
  const parts = dateString.split("-").map(Number);
  return new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1));
}

export function serializeDate(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}
