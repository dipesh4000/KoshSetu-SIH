// Notification inbox.
//
// Categories separate what needs an action from what is informational. A read
// notice stays findable, and acknowledging the notice is explicitly not the
// same as completing the work it describes.

import { useState } from "react";
import { Link } from "react-router-dom";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "../components/ui/primitives";
import { useAcknowledgeNotification, useNotifications } from "../lib/api/hooks";
import { useSession } from "../lib/auth/session";
import { dateTime, longDate } from "../lib/format";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "ACTION_REQUIRED", label: "Action required" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "INFORMATION", label: "Information" },
  { value: "SECURITY", label: "Security" },
];

const CATEGORY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  ACTION_REQUIRED: "danger",
  DEADLINE: "warning",
  INFORMATION: "info",
  SECURITY: "danger",
};

export function NotificationsPage() {
  const { session } = useSession();
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useNotifications({
    category: category || undefined,
    unread_only: unreadOnly || undefined,
  });
  const acknowledge = useAcknowledgeNotification();
  const basePath = session?.workspace === "institution" ? "/institution/fdrs" : "/official/fdrs";

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Deadline and case notices for your scope. Marking a notice read does not record that the underlying action is done."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Notification category" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={category === option.value}
              onClick={() => setCategory(option.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                category === option.value
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-muted hover:bg-subtle"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
            className="size-4"
          />
          Unread only
        </label>
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Loading notifications" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No notices in this view"
          description="Deadline reminders appear here as instruments approach maturity, along with officer requests on your cases."
        />
      ) : (
        <ul className="space-y-3">
          {query.data!.map((notice) => (
            <li key={notice.id}>
              <Card
                bodyClassName="p-4"
                className={notice.read_at ? "" : "border-l-4 border-l-brand"}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={CATEGORY_TONE[notice.category] ?? "neutral"}>
                        {notice.category.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                      {!notice.read_at && <Badge tone="info">Unread</Badge>}
                      {notice.acknowledged_at && <Badge tone="success">Acknowledged</Badge>}
                    </div>
                    <h2 className="mt-1.5 font-semibold text-ink">{notice.title}</h2>
                    <p className="mt-1 text-sm text-ink">{notice.body}</p>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {dateTime(notice.created_at)}
                      {notice.due_date ? ` · due ${longDate(notice.due_date)}` : ""}
                      {` · ${notice.event_type.replace(/_/g, " ").toLowerCase()}`}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {notice.fdr_id && (
                      <Link
                        to={`${basePath}/${notice.fdr_id}`}
                        className="text-sm font-semibold text-brand underline"
                      >
                        Open the instrument
                      </Link>
                    )}
                    {!notice.read_at && (
                      <Button
                        variant="secondary"
                        loading={acknowledge.isPending}
                        onClick={() => acknowledge.mutate({ id: notice.id, mode: "read" })}
                      >
                        Mark read
                      </Button>
                    )}
                    {!notice.acknowledged_at && (
                      <Button
                        variant="ghost"
                        loading={acknowledge.isPending}
                        onClick={() => acknowledge.mutate({ id: notice.id, mode: "ack" })}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Email in a deployment carries only a non-sensitive summary and a link to sign in — never a
        document, a full instrument number or a direct storage URL.
      </p>
    </>
  );
}
