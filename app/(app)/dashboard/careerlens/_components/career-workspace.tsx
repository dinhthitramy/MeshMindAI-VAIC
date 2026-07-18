"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  BrainCircuit,
  BriefcaseBusiness,
  Database,
  FileSearch,
  LockKeyhole,
  Route,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import {
  generateCareerPlanAction,
  type CareerLensActionState,
} from "../actions";
import { CareerPlanResults } from "./career-plan-results";
import { InterestProfileFields } from "./interest-profile-fields";
import { ProvinceCombobox } from "./province-combobox";

const initialState: CareerLensActionState = { status: "idle" };

const intentOptions = [
  "initial_guidance",
  "switch_major",
  "find_jobs",
  "compare_paths",
  "roadmap_detail",
] as const;

const workEnvironmentOptions = [
  "hybrid",
  "team_based",
  "independent",
  "hands_on",
  "fieldwork",
  "office",
  "remote",
] as const;

const learningStyleOptions = [
  "project_based",
  "mentor_guided",
  "self_paced",
  "classroom",
  "apprenticeship",
] as const;

function PlanSkeleton() {
  const t = useTranslations("Roadmap");

  return (
    <section aria-label={t("loading")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

type CareerWorkspaceProps = {
  models: string[];
  marketOverview: {
    postingCount: number;
    regionCount: number;
    roleCountPerRegion: number;
    industryCount: number;
    sourceDate: string;
  };
};

export function CareerWorkspace({ models, marketOverview }: CareerWorkspaceProps) {
  const format = useFormatter();
  const t = useTranslations("Roadmap");
  const educationItems = [
    { value: "THPT", label: t("form.educationOptions.THPT") },
    { value: "college", label: t("form.educationOptions.college") },
    { value: "university", label: t("form.educationOptions.university") },
    { value: "graduate", label: t("form.educationOptions.graduate") },
    { value: "other", label: t("form.educationOptions.other") },
  ];
  const workEnvironmentItems = workEnvironmentOptions.map((value) => ({
    value,
    label: t(`form.options.workEnvironment.${value}`),
  }));
  const learningStyleItems = learningStyleOptions.map((value) => ({
    value,
    label: t(`form.options.learningStyle.${value}`),
  }));
  const intentItems = intentOptions.map((value) => ({
    value,
    label: t(`form.options.intent.${value}`),
  }));
  const modelItems = models.map((value) => ({ value, label: value }));
  const [state, formAction, pending] = useActionState(
    generateCareerPlanAction,
    initialState,
  );
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.status]);

  function fieldError(field: string) {
    return state.fieldErrors?.[field]?.[0];
  }

  const principles = [
    { Icon: BrainCircuit, copy: t("principles.profile") },
    { Icon: Route, copy: t("principles.roadmap") },
    { Icon: BriefcaseBusiness, copy: t("principles.market") },
  ];

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="rounded-[2.25rem] bg-foreground/[0.035] p-1.5 ring-1 ring-foreground/5">
          <Card className="overflow-clip rounded-[calc(2.25rem-0.375rem)] border-0 shadow-none">
            <form action={formAction}>
              <CardHeader className="gap-4 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-2xl sm:text-3xl">{t("form.title")}</CardTitle>
                <Badge variant="secondary">{t("form.badge")}</Badge>
              </div>
              <CardDescription className="max-w-2xl text-base">{t("form.description")}</CardDescription>
              </CardHeader>

              <CardContent className="px-3 pb-3 sm:px-5 sm:pb-5">
              <FieldGroup className="gap-3">
                <FieldSet className="grid gap-5 rounded-[1.75rem] bg-muted/45 p-5 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8">
                  <FieldLegend className="mb-0 text-lg">{t("form.foundation")}</FieldLegend>
                  <FieldDescription className="lg:col-start-1">{t("form.foundationDescription")}</FieldDescription>
                  <FieldGroup className="grid gap-5 md:grid-cols-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <Field data-invalid={Boolean(fieldError("educationLevel")) || undefined}>
                      <FieldLabel htmlFor="careerlens-education">{t("form.educationLevel")}</FieldLabel>
                      <Select
                        items={educationItems}
                        name="educationLevel"
                        defaultValue="THPT"
                        required
                      >
                        <SelectTrigger
                          id="careerlens-education"
                          className="w-full"
                          aria-invalid={Boolean(fieldError("educationLevel")) || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {educationItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{fieldError("educationLevel")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("languages")) || undefined}>
                      <FieldLabel htmlFor="careerlens-languages">{t("form.languages")}</FieldLabel>
                      <Input
                        id="careerlens-languages"
                        name="languages"
                        defaultValue={t("form.languagesPlaceholder")}
                        placeholder={t("form.languagesPlaceholder")}
                        aria-invalid={Boolean(fieldError("languages")) || undefined}
                        required
                      />
                      <FieldDescription>{t("form.languagesHint")}</FieldDescription>
                      <FieldError>{fieldError("languages")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("currentRegion")) || undefined}>
                      <FieldLabel htmlFor="careerlens-current-region">{t("form.currentRegion")}</FieldLabel>
                      <ProvinceCombobox
                        id="careerlens-current-region"
                        name="currentRegion"
                        invalid={Boolean(fieldError("currentRegion"))}
                      />
                      <FieldDescription>{t("form.regionHint")}</FieldDescription>
                      <FieldError>{fieldError("currentRegion")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("targetRegion")) || undefined}>
                      <FieldLabel htmlFor="careerlens-target-region">{t("form.targetRegion")}</FieldLabel>
                      <ProvinceCombobox
                        id="careerlens-target-region"
                        name="targetRegion"
                        invalid={Boolean(fieldError("targetRegion"))}
                      />
                      <FieldError>{fieldError("targetRegion")}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSet className="grid gap-5 rounded-[1.75rem] bg-muted/45 p-5 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8">
                  <FieldLegend className="mb-0 text-lg">{t("form.strengths")}</FieldLegend>
                  <FieldDescription className="lg:col-start-1">{t("form.strengthsDescription")}</FieldDescription>
                  <FieldGroup className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <InterestProfileFields
                      subjectError={fieldError("strongSubject")}
                      scoreError={fieldError("subjectScore")}
                      interestsError={fieldError("interests")}
                    />

                    <Field data-invalid={Boolean(fieldError("activity")) || undefined}>
                      <FieldLabel htmlFor="careerlens-activity">{t("form.activity")}</FieldLabel>
                      <Textarea
                        id="careerlens-activity"
                        name="activity"
                        rows={4}
                        placeholder={t("form.activityPlaceholder")}
                        aria-invalid={Boolean(fieldError("activity")) || undefined}
                        required
                      />
                      <FieldError>{fieldError("activity")}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSet className="grid gap-5 rounded-[1.75rem] bg-muted/45 p-5 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8">
                  <FieldLegend className="mb-0 text-lg">{t("form.conditions")}</FieldLegend>
                  <FieldDescription className="lg:col-start-1">{t("form.conditionsDescription")}</FieldDescription>
                  <FieldGroup className="grid gap-5 md:grid-cols-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <Field data-invalid={Boolean(fieldError("weeklyHours")) || undefined}>
                      <FieldLabel htmlFor="careerlens-hours">{t("form.weeklyHours")}</FieldLabel>
                      <Input
                        id="careerlens-hours"
                        name="weeklyHours"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="80"
                        defaultValue="10"
                        aria-invalid={Boolean(fieldError("weeklyHours")) || undefined}
                        required
                      />
                      <FieldError>{fieldError("weeklyHours")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("targetBudget")) || undefined}>
                      <FieldLabel htmlFor="careerlens-budget">{t("form.budget")}</FieldLabel>
                      <Input
                        id="careerlens-budget"
                        name="targetBudget"
                        placeholder={t("form.budgetPlaceholder")}
                        aria-invalid={Boolean(fieldError("targetBudget")) || undefined}
                      />
                      <FieldError>{fieldError("targetBudget")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("workEnvironment")) || undefined}>
                      <FieldLabel htmlFor="careerlens-work-env">{t("form.workEnvironment")}</FieldLabel>
                      <Select
                        items={workEnvironmentItems}
                        name="workEnvironment"
                        defaultValue="team_based"
                        required
                      >
                        <SelectTrigger
                          id="careerlens-work-env"
                          className="w-full"
                          aria-invalid={Boolean(fieldError("workEnvironment")) || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {workEnvironmentItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{fieldError("workEnvironment")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("learningStyle")) || undefined}>
                      <FieldLabel htmlFor="careerlens-learning-style">{t("form.learningStyle")}</FieldLabel>
                      <Select
                        items={learningStyleItems}
                        name="learningStyle"
                        defaultValue="project_based"
                        required
                      >
                        <SelectTrigger
                          id="careerlens-learning-style"
                          className="w-full"
                          aria-invalid={Boolean(fieldError("learningStyle")) || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {learningStyleItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{fieldError("learningStyle")}</FieldError>
                    </Field>
                  </FieldGroup>

                  <Field className="lg:col-start-2" data-invalid={Boolean(fieldError("familyConstraints")) || undefined}>
                    <FieldLabel htmlFor="careerlens-constraints">{t("form.constraints")}</FieldLabel>
                    <Textarea
                      id="careerlens-constraints"
                      name="familyConstraints"
                      rows={3}
                      placeholder={t("form.constraintsPlaceholder")}
                      aria-invalid={Boolean(fieldError("familyConstraints")) || undefined}
                    />
                    <FieldDescription>{t("form.constraintsHint")}</FieldDescription>
                    <FieldError>{fieldError("familyConstraints")}</FieldError>
                  </Field>
                </FieldSet>

                <FieldSet className="grid gap-5 rounded-[1.75rem] bg-muted/45 p-5 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8">
                  <FieldLegend className="mb-0 text-lg">{t("form.goal")}</FieldLegend>
                  <FieldDescription className="lg:col-start-1">{t("form.goalDescription")}</FieldDescription>
                  <FieldGroup className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <Field data-invalid={Boolean(fieldError("intent")) || undefined}>
                      <FieldLabel htmlFor="careerlens-intent">{t("form.intent")}</FieldLabel>
                      <Select
                        items={intentItems}
                        name="intent"
                        defaultValue="initial_guidance"
                        required
                      >
                        <SelectTrigger
                          id="careerlens-intent"
                          className="w-full"
                          aria-invalid={Boolean(fieldError("intent")) || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {intentItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError>{fieldError("intent")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("targetCareer")) || undefined}>
                      <FieldLabel htmlFor="careerlens-target-career">{t("form.targetCareer")}</FieldLabel>
                      <Input
                        id="careerlens-target-career"
                        name="targetCareer"
                        placeholder={t("form.targetCareerPlaceholder")}
                        aria-invalid={Boolean(fieldError("targetCareer")) || undefined}
                      />
                      <FieldError>{fieldError("targetCareer")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("question")) || undefined}>
                      <FieldLabel htmlFor="careerlens-question">{t("form.question")}</FieldLabel>
                      <Textarea
                        id="careerlens-question"
                        name="question"
                        rows={4}
                        placeholder={t("form.questionPlaceholder")}
                        aria-invalid={Boolean(fieldError("question")) || undefined}
                        required
                      />
                      <FieldError>{fieldError("question")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("model")) || undefined}>
                      <FieldLabel htmlFor="careerlens-model">{t("form.model")}</FieldLabel>
                      <Select
                        items={modelItems}
                        name="model"
                        defaultValue={models[0]}
                        required
                      >
                        <SelectTrigger
                          id="careerlens-model"
                          className="w-full"
                          aria-invalid={Boolean(fieldError("model")) || undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {modelItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>{t("form.modelHint")}</FieldDescription>
                      <FieldError>{fieldError("model")}</FieldError>
                    </Field>

                    <Field
                      orientation="horizontal"
                      data-invalid={Boolean(fieldError("consent")) || undefined}
                    >
                      <Checkbox
                        id="careerlens-consent"
                        name="consent"
                        defaultChecked
                        required
                        aria-invalid={Boolean(fieldError("consent")) || undefined}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor="careerlens-consent">
                          {t("form.consent")}
                        </FieldLabel>
                        <FieldDescription>{t("form.consentHint")}</FieldDescription>
                        <FieldError>{fieldError("consent")}</FieldError>
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
              </CardContent>

              <CardFooter className="sticky bottom-0 flex-col items-stretch gap-4 bg-card/95 px-6 py-5 shadow-[0_-18px_40px_-32px_oklch(0.145_0_0_/_0.45)] supports-[backdrop-filter]:backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="min-h-6" aria-live="polite">
                {state.status === "error" ? (
                  <p className="text-sm text-destructive">{state.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("form.footerHint")}</p>
                )}
              </div>
              <Button type="submit" size="lg" disabled={pending || models.length === 0}>
                {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                {pending ? t("form.submitting") : t("form.submit")}
              </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-8">
          <Card className="overflow-hidden border-0 bg-foreground text-background shadow-none">
            <CardHeader className="gap-4 p-6">
              <div className="flex items-center justify-between gap-4">
                <Database aria-hidden="true" className="size-5 text-background/60" strokeWidth={1.6} />
                <Badge variant="secondary">{t("market.badge")}</Badge>
              </div>
              <CardTitle className="text-xl text-background">{t("market.title")}</CardTitle>
              <CardDescription className="text-background/55">{t("market.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 px-6 pb-6">
              <div className="pb-6">
                <p className="font-mono text-5xl font-semibold tracking-[-0.05em]">
                  {format.number(marketOverview.postingCount)}
                </p>
                <p className="mt-2 text-sm text-background/55">{t("market.postings")}</p>
              </div>
              <Separator className="bg-background/10" />
              <div className="grid grid-cols-3 gap-3 py-5">
                {[
                  [marketOverview.regionCount, t("market.regions")],
                  [marketOverview.roleCountPerRegion, t("market.roles")],
                  [marketOverview.industryCount, t("market.industries")],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-xl font-semibold">{value}</p>
                    <p className="mt-1 text-xs leading-4 text-background/50">{label}</p>
                  </div>
                ))}
              </div>
              <Separator className="bg-background/10" />
              <div className="flex items-center gap-2 pt-5 text-xs text-background/50">
                <FileSearch aria-hidden="true" className="size-4" strokeWidth={1.8} />
                {t("market.sourceDate", { date: marketOverview.sourceDate })}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <LockKeyhole aria-hidden="true" />
            <AlertTitle>{t("privacy.title")}</AlertTitle>
            <AlertDescription>{t("privacy.description")}</AlertDescription>
          </Alert>

          <Card className="shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("principles.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {principles.map(({ Icon, copy }, index) => (
                <div key={copy} className="grid grid-cols-[1.75rem_1fr] gap-3 text-sm text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
                  </span>
                  <p className="leading-6">
                    <span className="mr-2 font-mono text-xs text-foreground/40">0{index + 1}</span>
                    {copy}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div ref={resultRef} className="scroll-mt-6">
        {pending ? <PlanSkeleton /> : null}
        {!pending && state.output ? (
          <CareerPlanResults output={state.output} successMessage={state.message} />
        ) : null}
      </div>
    </div>
  );
}
