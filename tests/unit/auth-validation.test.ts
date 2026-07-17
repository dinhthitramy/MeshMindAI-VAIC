import { describe, expect, it } from "vitest";

import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { profileSchema, signupSchema } from "@/lib/auth/validation";

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

describe("profile validation", () => {
  it("normalizes editable profile values", () => {
    const result = profileSchema.parse({
      email: "  LEARNER@Example.COM ",
      fullName: "  Nguyen Minh Anh  ",
      birthMonth: "4",
      birthYear: "2001",
    });

    expect(result).toEqual({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthMonth: 4,
      birthYear: 2001,
    });
  });

  it("rejects invalid birth details", () => {
    const result = profileSchema.safeParse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthMonth: 13,
      birthYear: new Date().getFullYear() + 1,
    });

    expect(result.success).toBe(false);
  });
});
