import type { Metadata } from "next";

import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "../_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthCard
      title="Set a new password"
      description="Choose and confirm the password you want to use next."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
