// Display formatting.
//
// Amounts use Indian digit grouping with the rupee sign, and dates are written
// as "26 Oct 2026" so a DD/MM reading is never ambiguous. The API keeps ISO
// 8601 and decimal strings; nothing is parsed into a float for display.

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_COMPACT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function money(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(value) ? INR.format(value) : "—";
}

export function moneyCompact(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return INR_COMPACT.format(value);
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: iso.length <= 10 ? "UTC" : undefined,
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`;
}

export function relativeDays(days: number): string {
  if (days === 0) return "matures today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} remaining`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
}

export function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    fdr_number: "FDR number",
    principal_amount: "Principal amount",
    issue_date: "Issue date",
    maturity_date: "Maturity date",
    issuer_bank: "Issuer bank",
    lien_beneficiary: "Lien beneficiary",
    interest_rate: "Interest rate",
    ifsc: "IFSC",
    branch: "Branch",
  };
  return labels[field] ?? field.replace(/_/g, " ");
}

export function fieldValue(field: string, value: string | null): string {
  if (value === null || value === "") return "Not found";
  if (field === "principal_amount") return money(value);
  if (field.endsWith("_date")) return longDate(value);
  return value;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_.]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
