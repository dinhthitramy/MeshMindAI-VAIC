"use client";

import {
  useEffect,
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { AuthCard } from "./auth-card";
import { PasswordField } from "./password-field";
import { PresencePanel } from "./presence-panel";
import { signupAction, type AuthActionState } from "../actions";

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

const initialActionState: AuthActionState = { status: "idle" };

const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -8 }),
};

function SignupFlow() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [passwordError, setPasswordError] = useState("");
  const [actionState, action, pending] = useActionState(
    signupAction,
    initialActionState,
  );
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
    if (step < steps.length - 1) {
      event.preventDefault();
      setDirection(1);
      setStep((current) => current + 1);
      return;
    }

    if (values.password !== values.passwordConfirmation) {
      event.preventDefault();
      setPasswordError("Passwords do not match.");
    }
  }

  function goBack() {
    setPasswordError("");
    setDirection(-1);
    setStep((current) => Math.max(0, current - 1));
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
              className="relative h-1 overflow-hidden rounded-full bg-muted"
            >
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-foreground"
                initial={false}
                animate={{ scaleX: index <= step ? 1 : 0 }}
                transition={{ duration: 0.18 }}
              />
            </span>
          ))}
        </div>
      </div>

      <form action={action} onSubmit={handleSubmit} className="space-y-5">
        {step === steps.length - 1 && (
          <>
            <input type="hidden" name="email" value={values.email} />
            <input type="hidden" name="fullName" value={values.fullName} />
            <input type="hidden" name="birthMonth" value={values.birthMonth} />
            <input type="hidden" name="birthYear" value={values.birthYear} />
          </>
        )}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          {stepTitles[step]}
        </h2>

        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <PresencePanel
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
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
                  aria-invalid={Boolean(actionState.fieldErrors?.email)}
                  required
                  autoFocus
                />
                <AnimatePresence initial={false}>
                  {actionState.fieldErrors?.email?.[0] && (
                    <motion.p
                      key={actionState.fieldErrors.email[0]}
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.14 }}
                      className="text-sm text-destructive"
                    >
                      {actionState.fieldErrors.email[0]}
                    </motion.p>
                  )}
                </AnimatePresence>
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
                    aria-invalid={Boolean(actionState.fieldErrors?.fullName)}
                    required
                  />
                  <AnimatePresence initial={false}>
                    {actionState.fieldErrors?.fullName?.[0] && (
                      <motion.p
                        key={actionState.fieldErrors.fullName[0]}
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{ duration: 0.14 }}
                        className="text-sm text-destructive"
                      >
                        {actionState.fieldErrors.fullName[0]}
                      </motion.p>
                    )}
                  </AnimatePresence>
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
                        aria-invalid={Boolean(actionState.fieldErrors?.birthMonth)}
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
                        aria-invalid={Boolean(actionState.fieldErrors?.birthYear)}
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
                  minLength={12}
                  value={values.password}
                  onChange={updateValue}
                  aria-invalid={
                    passwordError || actionState.fieldErrors?.password ? true : undefined
                  }
                  aria-describedby={passwordError ? "signup-password-error" : undefined}
                  required
                />
                <PasswordField
                  id="signup-password-confirmation"
                  name="passwordConfirmation"
                  label="Confirm password"
                  autoComplete="new-password"
                  minLength={12}
                  value={values.passwordConfirmation}
                  onChange={updateValue}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? "signup-password-error" : undefined}
                  required
                />
                <AnimatePresence initial={false}>
                  {(passwordError ||
                    actionState.fieldErrors?.password?.[0] ||
                    actionState.fieldErrors?.passwordConfirmation?.[0]) && (
                    <motion.p
                      key={
                        passwordError ||
                        actionState.fieldErrors?.password?.[0] ||
                        actionState.fieldErrors?.passwordConfirmation?.[0]
                      }
                      id="signup-password-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.14 }}
                      className="text-sm text-destructive"
                    >
                      {passwordError ||
                        actionState.fieldErrors?.password?.[0] ||
                        actionState.fieldErrors?.passwordConfirmation?.[0]}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="text-xs leading-5 text-muted-foreground">
                  Use at least 12 characters.
                </p>
              </>
            )}
          </PresencePanel>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {actionState.message && (
            <motion.p
              key={`${actionState.status}:${actionState.message}`}
              role={actionState.status === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.14 }}
              className={cn(
                "text-sm",
                actionState.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {actionState.message}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {actionState.status === "error" && actionState.fieldErrors && (
            <motion.ul
              key="signup-field-errors"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.14 }}
              className="space-y-1 text-sm text-destructive"
            >
              {Array.from(new Set(Object.values(actionState.fieldErrors).flat())).map(
                (message) => (
                  <li key={message}>{message}</li>
                ),
              )}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="flex gap-3 pt-1">
          <AnimatePresence initial={false} mode="popLayout">
            {step > 0 && (
              <motion.div
                key="signup-back"
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={goBack}
                >
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div layout transition={{ duration: 0.16 }} className="flex-1">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending
                ? "Creating account..."
                : step === steps.length - 1
                  ? (
                    <>
                      <UserPlus data-icon="inline-start" aria-hidden="true" />
                      Create account
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight data-icon="inline-end" aria-hidden="true" />
                    </>
                  )}
            </Button>
          </motion.div>
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
