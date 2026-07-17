import type { Metadata } from "next";

import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Enter your details to continue to MeshMind."
    >
      <LoginForm />
    </AuthCard>
  );
}
