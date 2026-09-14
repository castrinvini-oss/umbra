const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR");

export function money(cents: number, currency = "BRL") {
  if (currency === "BRL") return brl.format(cents / 100);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function moneyCompact(cents: number) {
  const v = cents / 100;
  return v >= 10000 ? `R$ ${compact.format(v)}` : brl.format(v);
}

export function num(n: number) {
  return integer.format(n);
}

export function numCompact(n: number) {
  return n >= 10000 ? compact.format(n) : integer.format(n);
}

export function pct(ratio: number, digits = 1) {
  if (!Number.isFinite(ratio)) return "0%";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

export function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relative(d: Date | string | null | undefined) {
  if (!d) return "—";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const sign = diff > 0 ? -1 : 1;
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(sign * Math.round(abs / 60), "minute");
  if (abs < 86400) return rtf.format(sign * Math.round(abs / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(sign * Math.round(abs / 86400), "day");
  return date(d);
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!u || !d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}
