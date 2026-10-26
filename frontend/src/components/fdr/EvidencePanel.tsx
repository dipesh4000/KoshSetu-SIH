// Evidence comparison.
//
// Four readings stay visually separate: what the institution declared, what
// the document says, what a bank source reported (simulated here) and what
// scrutiny decided. A difference is described as a difference — the copy never
// calls it forgery.

import { FileSearch } from "lucide-react";

import type { EvidenceField, FieldDifference } from "../../lib/api/types";
import { fieldLabel, fieldValue, percent } from "../../lib/format";
import { Badge } from "../ui/primitives";

const DIFFERENCE_PRESENTATION: Record<
  FieldDifference,
  { label: string; tone: "success" | "danger" | "warning" | "neutral" }
> = {
  MATCH: { label: "Matches document", tone: "success" },
  DIFFERS: { label: "Value differs", tone: "danger" },
  NOT_FOUND: { label: "Not found in document", tone: "warning" },
  NOT_COMPARABLE: { label: "Not compared", tone: "neutral" },
};

export function EvidencePanel({
  fields,
  onSelectField,
  selectedField,
}: {
  fields: EvidenceField[];
  onSelectField?: (field: EvidenceField) => void;
  selectedField?: string | null;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-ink-muted">
        Declared values come from the institution. Document values are extracted by the parser —
        extraction identifies text, it does not authenticate the issuer.
      </p>

      <ul className="space-y-2.5">
        {fields.map((field) => {
          const difference = DIFFERENCE_PRESENTATION[field.difference];
          const isSelected = selectedField === field.field;
          const canLocate = field.page_index !== null && onSelectField;

          return (
            <li
              key={field.field}
              className={`rounded-lg border p-3 ${
                field.difference === "DIFFERS"
                  ? "border-danger/40 bg-danger-soft/50"
                  : isSelected
                    ? "border-brand/50 bg-brand/5"
                    : "border-line bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-ink">{fieldLabel(field.field)}</p>
                <Badge tone={difference.tone}>{difference.label}</Badge>
              </div>

              <dl className="mt-2.5 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Submitted claim
                  </dt>
                  <dd className="tabular text-sm text-ink">
                    {fieldValue(field.field, field.declared_value)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Extracted from document
                  </dt>
                  <dd className="tabular text-sm text-ink">
                    {field.field === "fdr_number"
                      ? "Masked — full reference is never displayed"
                      : fieldValue(field.field, field.extracted_value)}
                  </dd>
                </div>
              </dl>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                {field.confidence > 0 && (
                  <span>
                    Extraction confidence {percent(field.confidence)}
                    {field.confidence < 0.85 ? " — confirm manually" : ""}
                  </span>
                )}
                {field.page_index !== null && <span>Page {field.page_index + 1}</span>}
                {field.extracted_raw && field.field !== "fdr_number" && (
                  <span className="truncate">Source text: “{field.extracted_raw}”</span>
                )}
              </div>

              {canLocate && (
                <button
                  type="button"
                  onClick={() => onSelectField?.(field)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline"
                >
                  <FileSearch aria-hidden="true" className="size-4" />
                  Show in document
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
