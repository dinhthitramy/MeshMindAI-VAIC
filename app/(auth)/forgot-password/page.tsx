import type { Metadata } from "next";

import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export const metadata: Metadata = {
  title: "Recover password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recover your password"
      description="Enter your email and we'll prepare the reset flow."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
