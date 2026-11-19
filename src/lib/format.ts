const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
