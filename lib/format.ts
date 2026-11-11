export function starDisplay(rating: number): string {
  return rating === 0 ? "0 stars" : `${rating} ${rating === 1 ? "star" : "stars"}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not provided";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const day = 86400000;
  if (elapsed < day) return "Today";
  if (elapsed < 2 * day) return "Yesterday";
  if (elapsed < 30 * day) return `${Math.floor(elapsed / day)} days ago`;
  return formatDate(value);
}