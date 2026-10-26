// Confirmation dialog for consequential actions.
//
// Critical transitions show the case, its version, the prerequisites and a
// mandatory note before anything is sent. Focus is trapped only while the
// dialog is open and returns to the control that opened it.

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "./primitives";

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`card w-full ${width} my-8`}
      >
        <header className="border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-1 text-sm text-ink-muted">
              {description}
            </div>
          )}
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">
          {footer ?? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
