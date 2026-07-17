"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setEmail(String(formData.get("email") ?? ""));
  }

  if (email) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
        >
          <p className="font-medium">Recovery screen complete</p>
          <p className="mt-1 text-muted-foreground">
            No email was sent to <span className="text-foreground">{email}</span>.
            Email delivery will be connected later.
          </p>
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
      <Button type="submit" size="lg" className="w-full">
        Send reset link
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
