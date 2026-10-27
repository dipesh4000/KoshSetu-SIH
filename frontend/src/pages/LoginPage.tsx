// Sign-in.
//
// Demo credentials are listed deliberately: this build has no identity
// provider, and the specification requires that it not pretend otherwise.

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Alert, Button, Field, TextInput } from "../components/ui/primitives";
import { ApiError } from "../lib/api/client";
import { useSession } from "../lib/auth/session";

const DEMO_ACCOUNTS = [
  { email: "submitter@coastal.demo", role: "Institution submitter — Coastal Institute" },
  { email: "submitter@highland.demo", role: "Institution submitter — Highland School" },
  { email: "scrutiny@aicte.demo", role: "AICTE scrutiny officer (South & West)" },
  { email: "supervisor@aicte.demo", role: "Competent authority / release approver" },
  { email: "pgrc@aicte.demo", role: "PGRC clearance officer" },
  { email: "vigilance@aicte.demo", role: "Vigilance clearance officer" },
  { email: "finance@aicte.demo", role: "Finance Bureau clearance officer" },
  { email: "auditor@aicte.demo", role: "Read-only auditor" },
  { email: "admin@aicte.demo", role: "Security administrator" },
];

const DEMO_PASSWORD = "Demo@12345";

export function LoginPage() {
  const { session, signIn, meta } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("scrutiny@aicte.demo");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/"} replace />;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const next = await signIn(email.trim(), password);
      navigate(
        next.workspace === "institution"
          ? "/institution/overview"
          : next.workspace === "admin"
            ? "/admin/overview"
            : "/official/overview",
        { replace: true },
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Sign-in could not be completed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-between bg-sidebar px-6 py-10 text-white sm:px-10 lg:px-14">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className="size-8" />
            <div>
              <p className="text-lg font-semibold">KoshSetu</p>
              <p className="text-sm text-white/65">Security deposit &amp; FDR portal</p>
            </div>
          </div>

          <h1 className="mt-10 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
            One auditable record for every institution-wise security deposit and FDR.
          </h1>
          <p className="mt-4 max-w-xl text-white/75">
            Institutions submit deposit evidence; authorised AICTE officials scrutinise it,
            monitor maturity, record replacements and process release cases — with the source of
            every value on screen and a full history behind each decision.
          </p>

          <ul className="mt-8 space-y-2.5 text-sm text-white/75">
            <li>• Declared values, document extraction and bank-source results stay separate.</li>
            <li>• Release approval needs its prescribed documents, clearances and two people.</li>
            <li>• Every action is written to an append-only, digest-chained audit trail.</li>
          </ul>
        </div>

        <div className="mt-10 rounded-lg border border-white/15 bg-white/5 p-4 text-[13px] text-white/70">
          <p className="font-semibold text-white/85">Prototype disclaimer</p>
          <p className="mt-1">
            {meta?.disclaimer ??
              "Demonstration build. All institutions, instruments, clearances and bank responses are synthetic, and bank verification is simulated."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Local demonstration sign-in. A deployment would use an AICTE-approved identity
              provider with multi-factor authentication for officials.
              MFA and government SSO are not implemented in this demo.
            </p>

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              <Field label="Work email" required>
                {(props) => (
                  <TextInput
                    {...props}
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                )}
              </Field>

              <Field label="Password" required>
                {(props) => (
                  <TextInput
                    {...props}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                )}
              </Field>

              {error && <Alert tone="danger">{error}</Alert>}

              <Button type="submit" variant="primary" loading={submitting} className="w-full">
                Sign in
              </Button>
            </form>
          </div>

          <div className="card mt-4 p-5">
            <h3 className="text-sm font-semibold text-ink">Demonstration accounts</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Every account uses the password <code className="font-semibold">{DEMO_PASSWORD}</code>.
              Select one to load it into the form.
            </p>
            <ul className="mt-3 divide-y divide-line text-sm">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email} className="py-1.5">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                  >
                    <span className="font-medium text-brand-dark">{account.email}</span>
                    <span className="block text-xs text-ink-muted">{account.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
