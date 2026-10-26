// Shared accessible primitives. Status meaning is always carried by words and
// an icon as well as colour, so a colour-blind reader loses nothing.

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { present, type Dimension, type Tone } from "../../lib/format/status";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-muted border-line",
  info: "bg-brand/8 text-brand-dark border-brand/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  simulated: "bg-warning-soft text-warning border-warning/40",
};

const TONE_ICONS: Record<Tone, typeof Info> = {
  neutral: CircleDashed,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  simulated: FlaskConical,
};

export function Badge({
  tone = "neutral",
  children,
  title,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** A status badge for one named dimension; never a single merged "FDR status". */
export function StatusBadge({
  dimension,
  value,
  className,
}: {
  dimension: Dimension;
  value: string | null | undefined;
  className?: string;
}) {
  const presentation = present(dimension, value);
  return (
    <Badge tone={presentation.tone} title={presentation.help} className={className}>
      {presentation.label}
    </Badge>
  );
}

export function SimulationBadge({ state }: { state: string }) {
  const presentation = present("bank", state);
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-1 text-[13px] font-medium text-warning"
      title={presentation.help}
    >
      <span aria-hidden="true" className="rounded bg-warning/15 px-1 text-[11px] font-bold tracking-wide">
        SIM
      </span>
      <span>{presentation.label}</span>
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark border-brand",
  secondary: "bg-surface text-ink hover:bg-subtle border-line",
  ghost: "bg-transparent text-brand-dark hover:bg-brand/8 border-transparent",
  danger: "bg-danger text-white hover:bg-[#8f1c13] border-danger",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    loading?: boolean;
    icon?: ReactNode;
  }
>(function Button(
  { variant = "secondary", loading = false, icon, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_CLASSES[variant]} ${className}`}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex gap-3 rounded-lg border p-3.5 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-subtle ${className}`} />;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-1">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-subtle/60 p-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong loading this view.";
  const requestId =
    typeof error === "object" && error !== null && "requestId" in error
      ? (error as { requestId?: string }).requestId
      : undefined;
  return (
    <Alert tone="danger" title="This view could not be loaded">
      <p>{message}</p>
      {requestId && <p className="mt-1 text-xs">Reference: {requestId}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

let fieldCounter = 0;

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean }) => ReactNode;
}) {
  const id = `field-${(fieldCounter += 1)}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_CLASSES =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 aria-invalid:border-danger";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...rest }, ref) {
    return <input ref={ref} {...rest} className={`${CONTROL_CLASSES} ${className}`} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = "", rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} {...rest} className={`${CONTROL_CLASSES} ${className}`} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} {...rest} className={`${CONTROL_CLASSES} ${className}`}>
        {children}
      </select>
    );
  },
);

export function DefinitionList({
  items,
  columns = 2,
}: {
  items: { label: string; value: ReactNode; help?: string }[];
  columns?: 1 | 2 | 3;
}) {
  const gridClass =
    columns === 1 ? "sm:grid-cols-1" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3.5 ${gridClass}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink">{item.value}</dd>
          {item.help && <p className="mt-0.5 text-xs text-ink-muted">{item.help}</p>}
        </div>
      ))}
    </dl>
  );
}
