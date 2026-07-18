import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { BrainCircuit, Eye, RotateCcw, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { personalityTestResults, users } from "@/lib/db/schema";
import type { PersonalityType } from "@/lib/personality-test";

import { ProfileForm } from "./_components/profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("metadataTitle") };
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function ProfilePage() {
  const [viewer, t, personalityT, locale] = await Promise.all([
    requireViewer(),
    getTranslations("Profile"),
    getTranslations("PersonalityTest"),
    getLocale(),
  ]);

  if (viewer.actor.kind !== "user") {
    redirect("/dashboard");
  }

  const [profile] = await getDb()
    .select({
      birthDate: users.birthDate,
      email: users.email,
      fullName: users.fullName,
      personalityCompletedAt: personalityTestResults.completedAt,
      personalityType: personalityTestResults.resultType,
    })
    .from(users)
    .leftJoin(
      personalityTestResults,
      eq(personalityTestResults.userId, users.id),
    )
    .where(eq(users.id, viewer.actor.userId))
    .limit(1);

  if (!profile) {
    redirect("/login");
  }

  const [birthYear, birthMonth, birthDay] = profile.birthDate
    .split("-")
    .map(Number);
  const currentYear = new Date().getUTCFullYear();
  const personalityCompletedLabel = profile.personalityCompletedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        profile.personalityCompletedAt,
      )
    : undefined;
  const personalityType = profile.personalityType as PersonalityType | null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <Avatar size="lg">
              <AvatarFallback>{initialsFor(profile.fullName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="pt-2">{profile.fullName}</CardTitle>
            <CardDescription className="break-all">{profile.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("summary")}
            </p>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BrainCircuit aria-hidden="true" className="size-5" />
              </div>
              <CardTitle>
                {personalityType
                  ? t("personality.completedTitle")
                  : t("personality.emptyTitle")}
              </CardTitle>
              <CardDescription>
                {personalityType
                  ? t("personality.completedDescription")
                  : t("personality.emptyDescription")}
              </CardDescription>
            </CardHeader>

            {personalityType ? (
              <CardContent>
                <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">
                      {personalityType}
                    </p>
                    <p className="text-sm font-medium">
                      {personalityT(
                        `types.${personalityType}.title`,
                      )}
                    </p>
                  </div>
                  {personalityCompletedLabel ? (
                    <p className="text-sm text-muted-foreground">
                      {t("personality.completedOn", {
                        date: personalityCompletedLabel,
                      })}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            ) : null}

            <CardFooter className="flex-wrap justify-end gap-3">
              {personalityType ? (
                <Link
                  href="/dashboard/profile/personality-test?view=result"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <Eye data-icon="inline-start" />
                  {t("personality.viewDetails")}
                </Link>
              ) : null}
              <Link
                href="/dashboard/profile/personality-test"
                className={buttonVariants({ size: "lg" })}
              >
                {personalityType ? (
                  <RotateCcw data-icon="inline-start" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {personalityType
                  ? t("personality.retake")
                  : t("personality.takeTest")}
              </Link>
            </CardFooter>
          </Card>

          <ProfileForm
            currentYear={currentYear}
            profile={{
              birthDay,
              birthMonth,
              birthYear,
              email: profile.email,
              fullName: profile.fullName,
            }}
          />
        </div>
      </div>
    </section>
  );
}
