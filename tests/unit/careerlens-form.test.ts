import { afterEach, describe, expect, it, vi } from "vitest";

import { generateCareerPlanAction } from "@/app/(app)/dashboard/careerlens/actions";
import {
  buildCareerGuidanceInput,
  careerLensFormSchema,
} from "@/lib/careerlens/form";

vi.mock("@/lib/auth/dal", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    actor: { kind: "user", userId: "student-001", authVersion: 1 },
    displayName: "Minh Anh",
    email: "minh.anh@example.com",
    roles: ["USER"],
    permissions: ["dashboard.access"],
  }),
}));

function createValidFormData() {
  const formData = new FormData();
  const values = {
    educationLevel: "THPT",
    currentRegion: "TP. Hồ Chí Minh",
    targetRegion: "TP. Hồ Chí Minh",
    languages: "Tiếng Việt, English",
    strongSubject: "Toán",
    subjectScore: "8.5",
    interests: "Công nghệ, bóng đá, kinh doanh",
    activity: "Em từng làm website giới thiệu cho câu lạc bộ ở trường.",
    weeklyHours: "10",
    targetBudget: "Dưới 20 triệu đồng/năm",
    workEnvironment: "team_based",
    learningStyle: "project_based",
    familyConstraints: "Cần học gần nhà",
    intent: "initial_guidance",
    targetCareer: "Data Analyst",
    question: "Em nên bắt đầu kiểm chứng hướng nghề nào trong ba tháng tới?",
    model: "DeepSeek-V4-Flash",
    consent: "on",
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CareerLens form integration", () => {
  it("maps validated form values into the LLM input contract", () => {
    const rawValues = Object.fromEntries(createValidFormData());
    const parsed = careerLensFormSchema.parse(rawValues);

    const input = buildCareerGuidanceInput(parsed, "student-001");

    expect(input.student_profile.profile_id).toBe("student-001");
    expect(input.student_profile.personal_interests.map((item) => item.name)).toEqual([
      "Công nghệ",
      "bóng đá",
      "kinh doanh",
    ]);
    expect(input.student_profile.preferences.learning_style).toEqual(["project_based"]);
    expect(input.labor_market_signals.postings.length).toBeGreaterThanOrEqual(3);
    expect(input.user_request.target_career_or_major).toBe("Data Analyst");
  });

  it("rejects form submission without explicit consent", () => {
    const rawValues = Object.fromEntries(createValidFormData());
    delete rawValues.consent;

    const parsed = careerLensFormSchema.safeParse(rawValues);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.consent).toBeDefined();
    }
  });

  it("returns a generated plan through the authenticated Server Action", async () => {
    vi.stubEnv("FPT_AI_API_KEY", "");

    const state = await generateCareerPlanAction(
      { status: "idle" },
      createValidFormData(),
    );

    expect(state.status).toBe("success");
    expect(state.output?.recommendations).toHaveLength(3);
    expect(state.output?.recommendations[0].path_title).toContain("Data Analyst");
  });
});
