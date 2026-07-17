import type { Metadata } from "next";

import { SignupFlow } from "../_components/signup-flow";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return <SignupFlow />;
}
