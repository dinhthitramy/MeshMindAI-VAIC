"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { forgotPasswordAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = { status: "idle" };

function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
        >
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">{state.message}</p>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          autoFocus
        />
      </div>
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
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

export { ForgotPasswordForm };
