"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { AuthCard } from "./auth-card";
import { PasswordField } from "./password-field";

const steps = ["Account", "About you", "Security"];
const stepTitles = ["Start with your email", "Tell us about you", "Choose a password"];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type SignupValues = {
  email: string;
  fullName: string;
  birthMonth: string;
  birthYear: string;
  password: string;
  passwordConfirmation: string;
};

const initialValues: SignupValues = {
  email: "",
  fullName: "",
  birthMonth: "",
  birthYear: "",
  password: "",
  passwordConfirmation: "",
};

function SignupFlow() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [passwordError, setPasswordError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      stepHeadingRef.current?.focus();
      previousStepRef.current = step;
    }
  }, [step]);

  function updateValue(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "password" || name === "passwordConfirmation") {
      setPasswordError("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    if (values.password !== values.passwordConfirmation) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsComplete(true);
  }

  function goBack() {
    setPasswordError("");
    setStep((current) => Math.max(0, current - 1));
  }

  if (isComplete) {
    return (
      <AuthCard
        title="Signup screen complete"
        description="Your details stayed in this browser only. No account was created because authentication is not connected yet."
      >
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Continue to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Complete the three short steps below to set up your profile."
    >
      <div className="mb-7 space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span className="text-muted-foreground">
            Step {step + 1} of {steps.length}
          </span>
          <span>{steps[step]}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Signup progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          className="grid grid-cols-3 gap-2"
        >
          {steps.map((stepLabel, index) => (
            <span
              key={stepLabel}
              aria-hidden="true"
              className={cn(
                "h-1 rounded-full transition-colors",
                index <= step ? "bg-foreground" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          {stepTitles[step]}
        </h2>

        {step === 0 && (
          <div className="grid gap-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={updateValue}
              required
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="signup-name">Full name</Label>
              <Input
                id="signup-name"
                name="fullName"
                autoComplete="name"
                placeholder="Your full name"
                value={values.fullName}
                onChange={updateValue}
                required
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Date of birth</legend>
              <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="signup-birth-month" className="sr-only">
                    Birth month
                  </Label>
                  <Select
                    id="signup-birth-month"
                    name="birthMonth"
                    autoComplete="bday-month"
                    value={values.birthMonth}
                    onChange={updateValue}
                    required
                  >
                    <option value="" disabled>
                      Month
                    </option>
                    {months.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-birth-year" className="sr-only">
                    Birth year
                  </Label>
                  <Input
                    id="signup-birth-year"
                    name="birthYear"
                    type="number"
                    inputMode="numeric"
                    autoComplete="bday-year"
                    min={1}
                    max={new Date().getFullYear()}
                    placeholder="Year"
                    value={values.birthYear}
                    onChange={updateValue}
                    required
                  />
                </div>
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <PasswordField
              id="signup-password"
              name="password"
              label="Password"
              autoComplete="new-password"
              value={values.password}
              onChange={updateValue}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "signup-password-error" : undefined}
              required
            />
            <PasswordField
              id="signup-password-confirmation"
              name="passwordConfirmation"
              label="Confirm password"
              autoComplete="new-password"
              value={values.passwordConfirmation}
              onChange={updateValue}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "signup-password-error" : undefined}
              required
            />
            {passwordError && (
              <p
                id="signup-password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {passwordError}
              </p>
            )}
          </>
        )}

        <div className="flex gap-3 pt-1">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={goBack}
            >
              Back
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1">
            {step === steps.length - 1 ? "Create account" : "Continue"}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

export { SignupFlow };
