"use server";

import { AVAILABLE_MODELS } from "@/lib/ai";
import { generateCareerGuidance, type CareerGuidanceOutput } from "@/lib/careerlens";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildCareerGuidanceInput, careerLensFormSchema } from "@/lib/careerlens/form";

export type CareerLensActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  output?: CareerGuidanceOutput;
};

export async function generateCareerPlanAction(
  _previousState: CareerLensActionState,
  formData: FormData,
): Promise<CareerLensActionState> {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);

  if (viewer.actor.kind !== "user") {
    return {
      status: "error",
      message: "Tính năng tạo lộ trình chỉ khả dụng cho tài khoản người học.",
    };
  }

  const parsed = careerLensFormSchema.safeParse({
    educationLevel: formData.get("educationLevel"),
    currentRegion: formData.get("currentRegion"),
    targetRegion: formData.get("targetRegion"),
    languages: formData.get("languages"),
    strongSubject: formData.get("strongSubject"),
    subjectScore: formData.get("subjectScore"),
    interests: formData.get("interests"),
    activity: formData.get("activity"),
    weeklyHours: formData.get("weeklyHours"),
    targetBudget: formData.get("targetBudget"),
    workEnvironment: formData.get("workEnvironment"),
    learningStyle: formData.get("learningStyle"),
    familyConstraints: formData.get("familyConstraints"),
    intent: formData.get("intent"),
    targetCareer: formData.get("targetCareer"),
    question: formData.get("question"),
    model: formData.get("model"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    const invalidFields = parsed.error.flatten().fieldErrors;
    const fieldMessages: Record<string, string> = {
      activity: "Hãy mô tả một hoạt động hoặc dự án bằng ít nhất 10 ký tự.",
      consent: "Cần có sự đồng ý trước khi phân tích dữ liệu.",
      currentRegion: "Hãy chọn khu vực hiện tại.",
      educationLevel: "Hãy chọn bậc học hiện tại.",
      familyConstraints: "Nội dung ràng buộc đang quá dài.",
      interests: "Hãy nhập ít nhất một sở thích.",
      intent: "Hãy chọn mục tiêu tư vấn.",
      languages: "Hãy nhập ít nhất một ngôn ngữ.",
      learningStyle: "Hãy chọn cách học phù hợp.",
      model: "Hãy chọn model phân tích.",
      question: "Câu hỏi cần có ít nhất 10 ký tự.",
      strongSubject: "Hãy nhập một môn hoặc kỹ năng nổi bật.",
      subjectScore: "Điểm tự đánh giá phải nằm trong khoảng 0-10.",
      targetBudget: "Nội dung ngân sách đang quá dài.",
      targetCareer: "Tên ngành hoặc nghề đang quá dài.",
      targetRegion: "Hãy chọn khu vực mục tiêu.",
      weeklyHours: "Số giờ học phải nằm trong khoảng 1-80.",
      workEnvironment: "Hãy chọn môi trường làm việc mong muốn.",
    };

    return {
      status: "error",
      message: "Hãy kiểm tra lại các trường được đánh dấu.",
      fieldErrors: Object.fromEntries(
        Object.keys(invalidFields).map((field) => [
          field,
          [fieldMessages[field] ?? "Giá trị chưa hợp lệ."],
        ]),
      ),
    };
  }

  if (!AVAILABLE_MODELS.includes(parsed.data.model)) {
    return {
      status: "error",
      message: "Model đã chọn không khả dụng.",
      fieldErrors: { model: ["Hãy chọn một model trong danh sách."] },
    };
  }

  const input = buildCareerGuidanceInput(parsed.data, viewer.actor.userId);

  try {
    const output = await generateCareerGuidance(input, {
      model: parsed.data.model,
      userId: viewer.actor.userId,
    });

    return {
      status: "success",
      message: "Lộ trình đã sẵn sàng. Em có thể so sánh và mở từng roadmap bên dưới.",
      output,
    };
  } catch (error) {
    console.error("CareerLens plan generation failed", {
      userId: viewer.actor.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      status: "error",
      message: "Chưa thể tạo lộ trình lúc này. Vui lòng thử lại sau ít phút.",
    };
  }
}
