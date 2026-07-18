import "server-only";

import { generateAIJson, AIServiceError } from "@/lib/ai";

import {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
  type CareerRecommendation,
} from "./schemas";
import { CAREERLENS_SYSTEM_PROMPT } from "./system-prompt";

const DISCLAIMER =
  "Kết quả này là gợi ý tham khảo, không thay thế quyết định của em hoặc tư vấn trực tiếp từ counselor.";
const AUTONOMY_NOTE =
  "Em có thể chấp nhận, từ chối, xem lại hoặc đổi hướng; nên kiểm chứng lựa chọn với counselor và người đang làm nghề.";

const OUTPUT_CONTRACT = {
  disclaimer: "string",
  profile_summary: {
    strengths: ["string"],
    interests: ["string"],
    personal_signals: ["string"],
    constraints: ["string"],
    data_confidence: "low | medium | high",
  },
  market_summary: {
    rising_careers: [
      {
        career: "string",
        region: "string",
        evidence: ["string"],
        confidence: "low | medium | high",
      },
    ],
    short_supply_skills: [
      { skill: "string", region: "string", related_roles: ["string"] },
    ],
  },
  recommendations: [
    {
      path_title: "string",
      path_category:
        "university | college | vocational | certificate | apprenticeship | self_learning",
      fit_score: 0,
      fit_explanation: "string",
      market_evidence: ["string"],
      matched_profile_signals: ["string"],
      skill_gaps: [
        {
          skill: "string",
          current_level: "unknown | beginner | basic | intermediate | advanced",
          target_level: "basic | intermediate | advanced",
          why_needed: "string",
        },
      ],
      roadmap: [
        {
          stage_order: 1,
          stage_name: "string",
          time_limit: "string",
          modules: [
            {
              module_name: "string",
              goal: "string",
              tasks: [
                {
                  task_type:
                    "Learn | Contest | Project | CV | Interview | CounselorReview",
                  description: "string",
                  evidence_of_completion: "string",
                },
              ],
              evaluation_test: {
                test_format:
                  "portfolio | interview_mock | practical_task | quiz | counselor_review",
                pass_criteria: "string",
              },
            },
          ],
        },
      ],
      related_jobs: [
        {
          job_title: "string",
          region: "string",
          salary_band: "string",
          required_skills: ["string"],
          education_requirement: "string",
          why_relevant: "string",
        },
      ],
      autonomy_note: "string",
    },
  ],
  questions_to_improve_recommendation: ["string"],
  memory_update: {
    stable_interests: ["string"],
    stable_abilities: ["string"],
    new_constraints: ["string"],
    student_decision_to_save: "string | null",
  },
};

export interface GenerateCareerGuidanceOptions {
  model?: string;
  userId?: string;
}

export function sanitizeCareerGuidanceInput(input: unknown): CareerGuidanceInput {
  // Zod objects strip unknown keys recursively. Sensitive fields such as gender,
  // hometown, ethnicity and religion therefore cannot reach the model.
  return careerGuidanceInputSchema.parse(input);
}

export function buildCareerGuidanceUserPrompt(input: CareerGuidanceInput): string {
  return [
    "Hãy tạo kết quả hướng nghiệp từ dữ liệu đã được xác thực dưới đây.",
    "Trả đúng JSON contract, không thêm markdown hoặc giải thích ngoài JSON.",
    "Nếu dữ liệu đủ, recommendations phải có đúng 3 phần tử theo thứ tự: an toàn, tăng trưởng cao, khám phá.",
    "",
    "<output_contract>",
    JSON.stringify(OUTPUT_CONTRACT, null, 2),
    "</output_contract>",
    "",
    "<career_guidance_input>",
    JSON.stringify(input, null, 2),
    "</career_guidance_input>",
  ].join("\n");
}

function createConsentRequiredOutput(): CareerGuidanceOutput {
  return {
    disclaimer: DISCLAIMER,
    profile_summary: {
      strengths: [],
      interests: [],
      personal_signals: [],
      constraints: ["Chưa có sự đồng ý xử lý dữ liệu cá nhân."],
      data_confidence: "low",
    },
    market_summary: { rising_careers: [], short_supply_skills: [] },
    recommendations: [],
    questions_to_improve_recommendation: [
      "Em có đồng ý để CareerLens xử lý dữ liệu hồ sơ nhằm cá nhân hóa gợi ý không?",
    ],
    memory_update: {
      stable_interests: [],
      stable_abilities: [],
      new_constraints: [],
      student_decision_to_save: null,
    },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function includesText(values: string[], candidate: string): boolean {
  const normalizedCandidate = candidate.toLocaleLowerCase("vi");
  return values.some((value) => value.toLocaleLowerCase("vi") === normalizedCandidate);
}

function formatSalary(min: number | null, max: number | null): string {
  const formatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
  if (min !== null && max !== null) {
    return `${formatter.format(min)}-${formatter.format(max)} VND/tháng`;
  }
  if (min !== null) return `Từ ${formatter.format(min)} VND/tháng`;
  if (max !== null) return `Đến ${formatter.format(max)} VND/tháng`;
  return "Chưa có dữ liệu lương";
}

function mapPathCategory(
  requirement: CareerGuidanceInput["labor_market_signals"]["postings"][number]["education_requirement"] | undefined,
): CareerRecommendation["path_category"] {
  if (requirement === "university") return "university";
  if (requirement === "college") return "college";
  if (requirement === "vocational") return "vocational";
  if (requirement === "certificate") return "certificate";
  return "self_learning";
}

function createRoadmap(pathTitle: string, skill: string): CareerRecommendation["roadmap"] {
  return [
    {
      stage_order: 1,
      stage_name: "Định hướng và nền tảng",
      time_limit: "4 tuần",
      modules: [
        {
          module_name: `Khám phá ${pathTitle}`,
          goal: `Hiểu công việc thực tế và nền tảng ${skill}.`,
          tasks: [
            {
              task_type: "Learn",
              description: `Hoàn thành một tài liệu nhập môn về ${skill}.`,
              evidence_of_completion: "Ghi chú học tập và bài tự đánh giá một trang.",
            },
            {
              task_type: "CounselorReview",
              description: "Trao đổi về mức phù hợp, ràng buộc và phương án thay thế.",
              evidence_of_completion: "Biên bản phản hồi hoặc quyết định bước tiếp theo.",
            },
          ],
          evaluation_test: {
            test_format: "counselor_review",
            pass_criteria: "Giải thích được công việc, yêu cầu đầu vào và lý do muốn tiếp tục thử.",
          },
        },
      ],
    },
    {
      stage_order: 2,
      stage_name: "Thực hành có bằng chứng",
      time_limit: "8 tuần",
      modules: [
        {
          module_name: `Dự án nhỏ về ${skill}`,
          goal: "Kiểm chứng sở thích và tạo bằng chứng năng lực ban đầu.",
          tasks: [
            {
              task_type: "Project",
              description: `Hoàn thành một dự án nhỏ dùng ${skill} để giải quyết vấn đề thực tế.`,
              evidence_of_completion: "Sản phẩm, nhật ký quá trình và phần tự đánh giá.",
            },
          ],
          evaluation_test: {
            test_format: "portfolio",
            pass_criteria: "Có sản phẩm chạy được và mô tả rõ vai trò, quyết định, bài học.",
          },
        },
      ],
    },
    {
      stage_order: 3,
      stage_name: "Hồ sơ và cơ hội đầu tiên",
      time_limit: "4 tuần",
      modules: [
        {
          module_name: "Portfolio, CV và phỏng vấn",
          goal: "Sẵn sàng xin internship, apprenticeship hoặc dự án cộng tác.",
          tasks: [
            {
              task_type: "CV",
              description: "Đưa dự án và kỹ năng đã kiểm chứng vào CV/portfolio.",
              evidence_of_completion: "Một CV và portfolio đã được người có kinh nghiệm review.",
            },
            {
              task_type: "Interview",
              description: "Thực hiện một buổi phỏng vấn thử theo role mục tiêu.",
              evidence_of_completion: "Bản ghi phản hồi và ba điểm cần cải thiện.",
            },
          ],
          evaluation_test: {
            test_format: "interview_mock",
            pass_criteria: "Trình bày rõ dự án, kỹ năng chuyển đổi được và kế hoạch bù skill gap.",
          },
        },
      ],
    },
  ];
}

function createMockCareerGuidance(input: CareerGuidanceInput): CareerGuidanceOutput {
  const { student_profile: profile, labor_market_signals: market, user_request: request } = input;
  const interests = unique([
    ...profile.personal_interests.map((interest) => interest.name),
    ...profile.conversation_memory.stable_interests,
  ]);
  const strengths = unique([
    ...profile.academic_records
      .filter((record) => record.score !== null && record.score >= 8)
      .map((record) => `${record.subject} (${record.score}/10)`),
    ...profile.conversation_memory.stable_abilities,
  ]);
  const personalSignals = unique([
    ...profile.self_reported_activities.map((activity) => activity.name),
    ...profile.simulated_experiences.flatMap((experience) => experience.observed_signal),
  ]);
  const constraints = unique(
    [
      profile.preferences.target_budget,
      profile.preferences.family_constraints,
      profile.preferences.health_constraints_opt_in,
      profile.preferences.time_commitment_hours_per_week === null
        ? null
        : `${profile.preferences.time_commitment_hours_per_week} giờ học mỗi tuần`,
    ].filter((value): value is string => Boolean(value)),
  );
  const avoidPaths = profile.conversation_memory.avoid_paths;
  const requestedTarget = request.target_career_or_major?.trim();
  const postingTitles = market.postings.map((posting) => posting.job_title);
  const candidateTitles = unique([
    ...(requestedTarget ? [requestedTarget] : []),
    ...postingTitles,
    "Phân tích dữ liệu ứng dụng",
    "Vận hành kỹ thuật số",
    "Thiết kế trải nghiệm dịch vụ",
    "Kỹ thuật thực hành và tự động hóa",
  ]).filter((candidate) => !includesText(avoidPaths, candidate));

  while (candidateTitles.length < 3) {
    candidateTitles.push(`Hướng khám phá ${candidateTitles.length + 1}`);
  }

  const labels = ["an toàn", "tăng trưởng cao", "khám phá"] as const;
  const scores = [78, 84, 70];
  const recommendations = candidateTitles.slice(0, 3).map((title, index) => {
    const posting = market.postings.find((item) => item.job_title === title) ?? market.postings[index];
    const firstSkill = posting?.required_skills[0]?.skill_name ?? "kỹ năng nền tảng theo role";
    const matchedSignals = unique([...strengths, ...interests, ...personalSignals]).slice(0, 5);
    const memoryEvidence = profile.conversation_memory.stable_abilities[0];
    const switchContext =
      request.intent === "switch_major"
        ? ` Lộ trình mới tái sử dụng kỹ năng chuyển đổi${memoryEvidence ? ` “${memoryEvidence}”` : " đã lưu"} và tránh các lý do từng khiến em từ chối hướng cũ.`
        : "";

    return {
      path_title: `Lộ trình ${labels[index]}: ${title}`,
      path_category:
        index === 2 ? "self_learning" : mapPathCategory(posting?.education_requirement),
      fit_score: scores[index],
      fit_explanation: `Đây là giả lập POC dựa trên các tín hiệu hồ sơ đã cung cấp và dữ liệu thị trường hiện có.${switchContext}`,
      market_evidence: posting
        ? [
            `${posting.job_title} có posting tại ${posting.region}.`,
            `Mức lương ghi nhận: ${formatSalary(posting.avg_salary.min, posting.avg_salary.max)}.`,
          ]
        : ["Chưa có posting trực tiếp; cần bổ sung dữ liệu thị trường trước khi quyết định."],
      matched_profile_signals: matchedSignals.length > 0 ? matchedSignals : ["Chưa đủ tín hiệu hồ sơ"],
      skill_gaps: (posting?.required_skills.slice(0, 3) ?? [{ skill_name: firstSkill }]).map(
        (skill) => ({
          skill: skill.skill_name,
          current_level: "unknown" as const,
          target_level: "intermediate" as const,
          why_needed: `Cần kiểm chứng mức độ thành thạo ${skill.skill_name} qua bài thực hành hoặc project.`,
        }),
      ),
      roadmap: createRoadmap(title, firstSkill),
      related_jobs: posting
        ? [
            {
              job_title: posting.job_title,
              region: posting.region,
              salary_band: formatSalary(posting.avg_salary.min, posting.avg_salary.max),
              required_skills: posting.required_skills.map((skill) => skill.skill_name),
              education_requirement: posting.education_requirement,
              why_relevant: "Role xuất hiện trực tiếp trong bộ labor market signals được cung cấp.",
            },
          ]
        : [],
      autonomy_note: AUTONOMY_NOTE,
    } satisfies CareerRecommendation;
  });

  const risingCareers = market.trend_summary.slice(0, 5).map((trend) => ({
    career: trend.career_family,
    region: trend.region,
    evidence: [
      `Tăng trưởng posting: ${trend.posting_growth_rate}%.`,
      `Tăng trưởng lương: ${trend.salary_growth_rate}%.`,
    ],
    confidence: trend.confidence >= 0.75 ? "high" as const : trend.confidence >= 0.45 ? "medium" as const : "low" as const,
  }));
  const shortSupplySkills = unique(
    market.postings.flatMap((posting) =>
      posting.required_skills
        .filter((skill) => skill.is_short_supply)
        .map((skill) => skill.skill_name),
    ),
  ).map((skill) => ({
    skill,
    region: profile.target_regions[0] ?? profile.current_region,
    related_roles: unique(
      market.postings
        .filter((posting) => posting.required_skills.some((item) => item.skill_name === skill))
        .map((posting) => posting.job_title),
    ),
  }));

  return careerGuidanceOutputSchema.parse({
    disclaimer: `${DISCLAIMER} Đây là dữ liệu mock deterministic vì dịch vụ LLM chưa được cấu hình.`,
    profile_summary: {
      strengths,
      interests,
      personal_signals: personalSignals,
      constraints,
      data_confidence:
        profile.academic_records.length > 0 && profile.personal_interests.length > 0
          ? "high"
          : interests.length > 0 || personalSignals.length > 0
            ? "medium"
            : "low",
    },
    market_summary: {
      rising_careers: risingCareers,
      short_supply_skills: shortSupplySkills,
    },
    recommendations,
    questions_to_improve_recommendation: [
      "Em muốn ưu tiên thời gian học, chi phí hay cơ hội việc làm gần nơi ở?",
      "Em đã có project hoặc trải nghiệm thực tế nào liên quan đến ba hướng trên chưa?",
    ],
    memory_update: {
      stable_interests: interests,
      stable_abilities: strengths,
      new_constraints: constraints,
      student_decision_to_save:
        request.intent === "switch_major" && requestedTarget
          ? `switch_major:${requestedTarget}`
          : null,
    },
  });
}

function applyMandatoryGuardrails(output: CareerGuidanceOutput): CareerGuidanceOutput {
  return careerGuidanceOutputSchema.parse({
    ...output,
    disclaimer: DISCLAIMER,
    recommendations: output.recommendations.map((recommendation) => ({
      ...recommendation,
      autonomy_note: AUTONOMY_NOTE,
    })),
  });
}

/**
 * Generates validated, explainable CareerLens guidance through the configured
 * FPT Cloud LLM. Local development remains usable through a deterministic mock.
 */
export async function generateCareerGuidance(
  rawInput: unknown,
  options: GenerateCareerGuidanceOptions = {},
): Promise<CareerGuidanceOutput> {
  const input = sanitizeCareerGuidanceInput(rawInput);

  if (!input.student_profile.consent_data_usage) {
    return createConsentRequiredOutput();
  }

  if (!process.env.FPT_AI_API_KEY) {
    return createMockCareerGuidance(input);
  }

  const { data } = await generateAIJson<unknown>({
    systemPrompt: CAREERLENS_SYSTEM_PROMPT,
    userPrompt: buildCareerGuidanceUserPrompt(input),
    model: options.model,
    traceName: "careerlens-guidance",
    userId: options.userId,
  });

  const parsedOutput = careerGuidanceOutputSchema.safeParse(data);
  if (!parsedOutput.success) {
    throw new AIServiceError(
      `CareerLens LLM output failed validation: ${parsedOutput.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  if (parsedOutput.data.recommendations.length !== 3) {
    throw new AIServiceError(
      `CareerLens LLM output must contain exactly 3 recommendations; received ${parsedOutput.data.recommendations.length}`,
    );
  }

  return applyMandatoryGuardrails(parsedOutput.data);
}

export { CAREERLENS_SYSTEM_PROMPT } from "./system-prompt";
export {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
} from "./schemas";
