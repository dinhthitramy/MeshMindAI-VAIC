"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PasswordField } from "./password-field";
import { PresencePanel } from "./presence-panel";
import { resetPasswordAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = { status: "idle" };

function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [state.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");

    if (password !== confirmation) {
      event.preventDefault();
      setError("Passwords do not match.");
    }
  }

  return (
    <div className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {state.status === "success" ? (
          <PresencePanel
            key="success"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.16 }}
            className="space-y-5"
          >
            <div
              role="status"
              className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
            >
              <h2
                ref={successHeadingRef}
                tabIndex={-1}
                className="font-medium outline-none"
              >
                Password reset complete
              </h2>
              <p className="mt-1 text-muted-foreground">{state.message}</p>
            </div>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              <LogIn data-icon="inline-start" aria-hidden="true" />
              Continue to login
            </Link>
          </PresencePanel>
        ) : (
          <PresencePanel
            key="form"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
          >
            <form
              action={action}
              onSubmit={handleSubmit}
              onChange={() => setError("")}
              className="space-y-5"
            >
              <input type="hidden" name="token" value={token} />
              <PasswordField
                id="reset-password"
                name="password"
                label="New password"
                autoComplete="new-password"
                minLength={12}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "reset-password-error" : undefined}
                required
                autoFocus
              />
              <PasswordField
                id="reset-password-confirmation"
                name="passwordConfirmation"
                label="Confirm new password"
                autoComplete="new-password"
                minLength={12}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "reset-password-error" : undefined}
                required
              />
              <AnimatePresence initial={false}>
                {(error || state.message) && (
                  <motion.p
                    key={error || state.message}
                    id="reset-password-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                    className="text-sm text-destructive"
                  >
                    {error || state.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                <KeyRound data-icon="inline-start" aria-hidden="true" />
                {pending ? "Resetting..." : "Reset password"}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <ArrowLeft
                  aria-hidden="true"
                  className="mr-1 inline size-3.5 align-[-0.15em]"
                />
                Back to login
              </Link>
            </form>
          </PresencePanel>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ResetPasswordForm };
