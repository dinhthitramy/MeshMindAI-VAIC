import "server-only";

import { z } from "zod";

import { selectCareerLensMarketSignals } from "./market-seed";
import type { CareerGuidanceInput } from "./schemas";
import { VIETNAM_PROVINCES } from "./vietnam-provinces";

export const careerLensFormSchema = z.object({
  educationLevel: z.enum(["THPT", "college", "university", "graduate", "other"]),
  currentRegion: z.enum(VIETNAM_PROVINCES),
  targetRegion: z.enum(VIETNAM_PROVINCES),
  languages: z.string().trim().min(2).max(300),
  strongSubject: z.string().trim().min(1).max(120),
  subjectScore: z.coerce.number().min(0).max(10),
  interests: z.string().trim().min(2).max(500),
  activity: z.string().trim().min(10).max(2_000),
  weeklyHours: z.coerce.number().int().min(1).max(80),
  targetBudget: z.string().trim().max(300),
  workEnvironment: z.enum([
    "remote",
    "office",
    "fieldwork",
    "hybrid",
    "hands_on",
    "team_based",
    "independent",
  ]),
  learningStyle: z.enum([
    "project_based",
    "mentor_guided",
    "self_paced",
    "classroom",
    "apprenticeship",
  ]),
  familyConstraints: z.string().trim().max(1_000),
  intent: z.enum([
    "initial_guidance",
    "switch_major",
    "find_jobs",
    "compare_paths",
    "roadmap_detail",
  ]),
  targetCareer: z.string().trim().max(200),
  question: z.string().trim().min(10).max(2_000),
  model: z.string().trim().min(1).max(120),
  consent: z.string().refine((value) => value === "on" || value === "true"),
});

export type CareerLensFormValues = z.infer<typeof careerLensFormSchema>;

function splitList(value: string, limit: number): string[] {
  return [...new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))].slice(
    0,
    limit,
  );
}

function interestCategory(interest: string): "sport" | "technology" | "business" | "other" {
  const normalized = interest.toLocaleLowerCase("vi");
  if (/thể thao|bóng|chạy|bơi|cầu lông/.test(normalized)) return "sport";
  if (/công nghệ|lập trình|dữ liệu|máy tính|robot/.test(normalized)) return "technology";
  if (/kinh doanh|marketing|bán hàng|tài chính/.test(normalized)) return "business";
  return "other";
}

export function buildCareerGuidanceInput(
  values: CareerLensFormValues,
  profileId: string,
  preferredOutputLanguage: "vi" | "en" = "vi",
): CareerGuidanceInput {
  const interests = splitList(values.interests, 12);

  return {
    student_profile: {
      profile_id: profileId,
      consent_data_usage: true,
      bias_exclusion_flag: true,
      education_level: values.educationLevel,
      current_region: values.currentRegion,
      target_regions: [values.targetRegion],
      languages: splitList(values.languages, 8),
      academic_records: [
        {
          subject: values.strongSubject,
          score: values.subjectScore,
          evidence: "self_reported",
        },
      ],
      self_reported_activities: [
        {
          type: "project",
          name: "Trải nghiệm người học tự chia sẻ",
          description: values.activity,
          duration: "Chưa xác định",
          evidence: null,
        },
      ],
      personal_interests: interests.map((interest) => ({
        name: interest,
        category: interestCategory(interest),
        intensity: 4,
        why_it_matters: "Người học chủ động đưa vào hồ sơ hướng nghiệp.",
      })),
      preferences: {
        target_budget: values.targetBudget || null,
        time_commitment_hours_per_week: values.weeklyHours,
        work_env_pref: [values.workEnvironment],
        learning_style: [values.learningStyle],
        health_constraints_opt_in: null,
        family_constraints: values.familyConstraints || null,
      },
      simulated_experiences: [],
      conversation_memory: {
        stable_interests: interests,
        stable_abilities: [values.strongSubject],
        avoid_paths: [],
        previous_recommendations: [],
        student_decisions: [],
      },
    },
    labor_market_signals: selectCareerLensMarketSignals({
      currentRegion: values.currentRegion,
      targetRegions: [values.targetRegion],
      keywords: [
        values.strongSubject,
        values.interests,
        values.targetCareer,
        values.question,
      ],
    }),
    user_request: {
      intent: values.intent,
      question: values.question,
      target_career_or_major: values.targetCareer || null,
      preferred_output_language: preferredOutputLanguage,
    },
  };
}
