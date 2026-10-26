import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This address does not exist, or the record is not in your scope.
      </p>
      <Link to="/" className="mt-5 font-semibold text-brand underline">
        Return to your workspace
      </Link>
    </main>
  );
}
