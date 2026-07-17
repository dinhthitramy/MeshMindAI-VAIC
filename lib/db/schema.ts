import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    birthYear: smallint("birth_year").notNull(),
    birthMonth: smallint("birth_month").notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(lower(table.email)),
    check("users_birth_year_positive", sql`${table.birthYear} > 0`),
    check(
      "users_birth_month_valid",
      sql`${table.birthMonth} between 1 and 12`,
    ),
  ],
);

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}
