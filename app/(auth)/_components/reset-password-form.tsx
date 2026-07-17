"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PasswordField } from "./password-field";

function ResetPasswordForm() {
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsComplete(true);
  }

  if (isComplete) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
        >
          <p className="font-medium">Password screen complete</p>
          <p className="mt-1 text-muted-foreground">
            No password was changed because authentication is not connected yet.
          </p>
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
      onSubmit={handleSubmit}
      onChange={() => setError("")}
      className="space-y-5"
    >
      <PasswordField
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "reset-password-error" : undefined}
        required
      />
      {error && (
        <p id="reset-password-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full">
        Reset password
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
