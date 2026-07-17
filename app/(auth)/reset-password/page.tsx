import type { Metadata } from "next";

import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "../_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose and confirm the password you want to use next."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
