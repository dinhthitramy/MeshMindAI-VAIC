import { describe, expect, it } from "vitest";

import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { signupSchema } from "@/lib/auth/validation";

describe("signup validation", () => {
  it("normalizes email and strips a client-supplied role", () => {
    const result = signupSchema.parse({
      email: "  USER@Example.COM ",
      fullName: "Example User",
      birthMonth: "7",
      birthYear: "2000",
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
      role: "BUILTIN_SUPERADMIN",
    });

    expect(result.email).toBe("user@example.com");
    expect(result).not.toHaveProperty("role");
  });

  it("rejects short passwords and mismatched confirmation", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      fullName: "Example User",
      birthMonth: 7,
      birthYear: 2000,
      password: "short",
      passwordConfirmation: "different",
    });

    expect(result.success).toBe(false);
  });
});

describe("permission catalog", () => {
  it("contains unique permission keys", () => {
    const keys = PERMISSION_CATALOG.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
