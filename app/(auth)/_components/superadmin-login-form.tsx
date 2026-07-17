"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  superadminLoginAction,
  type AuthActionState,
} from "../actions";
import { PasswordField } from "./password-field";

const initialState: AuthActionState = { status: "idle" };

function SuperadminLoginForm() {
  const [state, action, pending] = useActionState(
    superadminLoginAction,
    initialState,
  );
  const isMfaStep = state.status === "mfa";

  return (
    <form action={action} className="space-y-5">
      {isMfaStep ? (
        <>
          <input
            type="hidden"
            name="challengeToken"
            value={state.challengeToken}
          />
          <div className="grid gap-2">
            <Label htmlFor="superadmin-totp">Authentication code</Label>
            <Input
              id="superadmin-totp"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="superadmin-identifier">Operations identifier</Label>
            <Input
              id="superadmin-identifier"
              name="identifier"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <PasswordField
            id="superadmin-password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
          />
        </>
      )}

      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending
          ? "Verifying..."
          : isMfaStep
            ? "Verify and continue"
            : "Continue"}
      </Button>
    </form>
  );
}

export { SuperadminLoginForm };
