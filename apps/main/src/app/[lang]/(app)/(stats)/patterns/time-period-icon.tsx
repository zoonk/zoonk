import { type LucideProps, MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "lucide-react";

/** In core's period order: night, morning, afternoon, evening. */
const TIME_PERIOD_ICONS = [MoonIcon, SunriseIcon, SunIcon, SunsetIcon] as const;

export function TimePeriodIcon({ period, ...props }: LucideProps & { period: number }) {
  const Icon = TIME_PERIOD_ICONS[period];
  return Icon ? <Icon {...props} /> : null;
}
