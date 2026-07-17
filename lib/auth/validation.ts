import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 256,
    "Password is too long.",
  );

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    birthMonth: z.coerce.number().int().min(1).max(12),
    birthYear: z.coerce
      .number()
      .int()
      .min(1900, "Enter a valid birth year.")
      .max(new Date().getFullYear(), "Birth year cannot be in the future."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(512),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const superadminCredentialsSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
});

export const superadminTotpSchema = z.object({
  challengeToken: z.string().min(32).max(512),
  token: z.string().regex(/^\d{6}$/, "Enter the six-digit authentication code."),
});

export const roleSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, "Use 2-32 uppercase letters, numbers, or underscores."),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  permissionKeys: z.array(z.string().min(1)).max(100),
});

export const roleAssignmentSchema = z.object({
  userId: z.string().uuid(),
  roleKeys: z.array(z.string().min(1)).max(20),
});

export type SignupInput = z.infer<typeof signupSchema>;
