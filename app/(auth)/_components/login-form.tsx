"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PasswordField } from "./password-field";

function LoginForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setSubmitted(false)}
      className="space-y-5"
    >
      <div className="grid gap-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <PasswordField
        id="login-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        labelAction={
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        }
      />

      <Button type="submit" size="lg" className="w-full">
        <LogIn data-icon="inline-start" aria-hidden="true" />
        Log in
      </Button>

      <p
        role="status"
        aria-live="polite"
        className={submitted ? "text-center text-xs text-muted-foreground" : "sr-only"}
      >
        Authentication is not connected yet.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        New to MeshMind?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export { LoginForm };
