"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PasswordField } from "./password-field";
import { resetPasswordAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = { status: "idle" };

function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");

    if (password !== confirmation) {
      event.preventDefault();
      setError("Passwords do not match.");
    }
  }

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
        >
          <p className="font-medium">Password reset complete</p>
          <p className="mt-1 text-muted-foreground">{state.message}</p>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Continue to login
        </Link>
      </div>
    );
  }

  return (
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
      {(error || state.message) && (
        <p id="reset-password-error" role="alert" className="text-sm text-destructive">
          {error || state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Resetting..." : "Reset password"}
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to login
      </Link>
    </form>
  );
}

export { ResetPasswordForm };
