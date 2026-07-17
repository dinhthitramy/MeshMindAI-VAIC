"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PasswordField } from "./password-field";
import { loginAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = { status: "idle" };

function LoginForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="login-email">{t("common.email")}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("common.emailPlaceholder")}
          required
        />
      </div>

      <PasswordField
        id="login-password"
        name="password"
        label={t("common.password")}
        autoComplete="current-password"
        required
        labelAction={
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("login.forgotPassword")}
          </Link>
        }
      />

      <AnimatePresence initial={false}>
        {state.message && (
          <motion.p
            key={state.message}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
            className="text-sm text-destructive"
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.newUser")} {" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  );
}

export { LoginForm };
