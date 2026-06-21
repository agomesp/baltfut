import type { Match } from "@/lib/espn";

/** Display timezone — the app's audience is Brazilian, so show kickoofs in BRT. */
export const TZ = "America/Sao_Paulo";

/**
 * Stable day key (YYYY-MM-DD) in a given timezone, used for grouping. Grouping
 * and labelling MUST share a timezone, or a match near midnight can split into
 * two same-labelled groups.
 */
export function dayKey(iso: string, timeZone: string = TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(d);
}

/** pt-BR day label, e.g. "sáb., 21 de jun.". */
export function fmtDayLabel(iso: string, timeZone: string = TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(d);
}

/** pt-BR 24h time, e.g. "13:00". */
export function fmtTime(iso: string, timeZone: string = TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Group matches by day (in {@link TZ}), preserving input order so a pre-sorted
 * list stays sorted both across and within days.
 */
export function groupByDay(matches: Match[], timeZone: string = TZ): DayGroup<Match>[] {
  const map = new Map<string, DayGroup<Match>>();
  for (const m of matches) {
    const key = dayKey(m.startsAt, timeZone);
    let group = map.get(key);
    if (!group) {
      group = { key, label: fmtDayLabel(m.startsAt, timeZone), items: [] };
      map.set(key, group);
    }
    group.items.push(m);
  }
  return [...map.values()];
}

/** "2 – 1" once a match has a score, else "". */
export function scoreText(m: Match): string {
  if (m.homeScore == null || m.awayScore == null) return "";
  return `${m.homeScore} – ${m.awayScore}`;
}
