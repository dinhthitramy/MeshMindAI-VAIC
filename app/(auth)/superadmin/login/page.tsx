import type { Metadata } from "next";

import { AuthCard } from "../../_components/auth-card";
import { SuperadminLoginForm } from "../../_components/superadmin-login-form";

export const metadata: Metadata = {
  title: "Operations access",
  robots: { index: false, follow: false },
};

export default function SuperadminLoginPage() {
  return (
    <AuthCard
      title="Operations access"
      description="This restricted sign-in requires the built-in credentials and a current authentication code."
    >
      <SuperadminLoginForm />
    </AuthCard>
  );
}
