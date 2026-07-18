"use client";

import { useActionState, useEffect, useRef } from "react";
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
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import {
  generateCareerPlanAction,
  type CareerLensActionState,
} from "../actions";
import { CareerPlanResults } from "./career-plan-results";

const initialState: CareerLensActionState = { status: "idle" };

const regions = ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng"] as const;

const intentOptions = [
  { value: "initial_guidance", label: "Khám phá hướng nghề ban đầu" },
  { value: "switch_major", label: "Cân nhắc đổi ngành" },
  { value: "find_jobs", label: "Tìm role và việc làm liên quan" },
  { value: "compare_paths", label: "So sánh các hướng nghề" },
  { value: "roadmap_detail", label: "Tạo roadmap chi tiết" },
] as const;

const workEnvironmentOptions = [
  { value: "hybrid", label: "Kết hợp online và tại chỗ" },
  { value: "team_based", label: "Làm việc theo nhóm" },
  { value: "independent", label: "Làm việc độc lập" },
  { value: "hands_on", label: "Thực hành, thao tác trực tiếp" },
  { value: "fieldwork", label: "Di chuyển và làm việc hiện trường" },
  { value: "office", label: "Văn phòng" },
  { value: "remote", label: "Từ xa" },
] as const;

const learningStyleOptions = [
  { value: "project_based", label: "Học qua dự án" },
  { value: "mentor_guided", label: "Có mentor hướng dẫn" },
  { value: "self_paced", label: "Tự học theo nhịp riêng" },
  { value: "classroom", label: "Lớp học có cấu trúc" },
  { value: "apprenticeship", label: "Học việc tại môi trường thật" },
] as const;

function PlanSkeleton() {
  return (
    <section aria-label="Đang tạo lộ trình" className="flex flex-col gap-6">
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
    sourceDate: string;
  };
};

export function CareerWorkspace({ models, marketOverview }: CareerWorkspaceProps) {
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

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <Card>
          <form action={formAction}>
            <CardHeader>
              <CardTitle>Hồ sơ cho lần phân tích này</CardTitle>
              <CardDescription>
                Càng cụ thể về trải nghiệm và điều kiện thực tế, lộ trình càng hữu ích.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Nền tảng hiện tại</FieldLegend>
                  <FieldDescription>
                    Region chỉ được dùng để đối chiếu cơ hội việc làm và mức lương mẫu.
                  </FieldDescription>
                  <FieldGroup className="grid gap-5 md:grid-cols-2">
                    <Field data-invalid={Boolean(fieldError("educationLevel")) || undefined}>
                      <FieldLabel htmlFor="careerlens-education">Bậc học hiện tại</FieldLabel>
                      <Select
                        id="careerlens-education"
                        name="educationLevel"
                        defaultValue="THPT"
                        aria-invalid={Boolean(fieldError("educationLevel")) || undefined}
                        required
                      >
                        <option value="THPT">THPT</option>
                        <option value="college">Cao đẳng</option>
                        <option value="university">Đại học</option>
                        <option value="graduate">Sau đại học</option>
                        <option value="other">Khác</option>
                      </Select>
                      <FieldError>{fieldError("educationLevel")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("languages")) || undefined}>
                      <FieldLabel htmlFor="careerlens-languages">Ngôn ngữ sử dụng</FieldLabel>
                      <Input
                        id="careerlens-languages"
                        name="languages"
                        defaultValue="Tiếng Việt, English"
                        placeholder="Tiếng Việt, English"
                        aria-invalid={Boolean(fieldError("languages")) || undefined}
                        required
                      />
                      <FieldDescription>Phân tách bằng dấu phẩy.</FieldDescription>
                      <FieldError>{fieldError("languages")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("currentRegion")) || undefined}>
                      <FieldLabel htmlFor="careerlens-current-region">Khu vực hiện tại</FieldLabel>
                      <Select
                        id="careerlens-current-region"
                        name="currentRegion"
                        defaultValue="TP. Hồ Chí Minh"
                        aria-invalid={Boolean(fieldError("currentRegion")) || undefined}
                        required
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </Select>
                      <FieldError>{fieldError("currentRegion")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("targetRegion")) || undefined}>
                      <FieldLabel htmlFor="careerlens-target-region">Khu vực muốn học hoặc làm</FieldLabel>
                      <Select
                        id="careerlens-target-region"
                        name="targetRegion"
                        defaultValue="TP. Hồ Chí Minh"
                        aria-invalid={Boolean(fieldError("targetRegion")) || undefined}
                        required
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </Select>
                      <FieldError>{fieldError("targetRegion")}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                <FieldSet>
                  <FieldLegend>Điểm mạnh và điều em quan tâm</FieldLegend>
                  <FieldDescription>
                    Hãy dùng trải nghiệm thật, không cần viết theo cách của hồ sơ xin việc.
                  </FieldDescription>
                  <FieldGroup>
                    <FieldGroup className="grid gap-5 md:grid-cols-[minmax(0,1fr)_9rem]">
                      <Field data-invalid={Boolean(fieldError("strongSubject")) || undefined}>
                        <FieldLabel htmlFor="careerlens-subject">Môn hoặc kỹ năng nổi bật</FieldLabel>
                        <Input
                          id="careerlens-subject"
                          name="strongSubject"
                          placeholder="Ví dụ: Toán, viết nội dung, sửa điện"
                          aria-invalid={Boolean(fieldError("strongSubject")) || undefined}
                          required
                        />
                        <FieldError>{fieldError("strongSubject")}</FieldError>
                      </Field>

                      <Field data-invalid={Boolean(fieldError("subjectScore")) || undefined}>
                        <FieldLabel htmlFor="careerlens-score">Điểm tự đánh giá</FieldLabel>
                        <Input
                          id="careerlens-score"
                          name="subjectScore"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="10"
                          step="0.1"
                          defaultValue="8"
                          aria-invalid={Boolean(fieldError("subjectScore")) || undefined}
                          required
                        />
                        <FieldError>{fieldError("subjectScore")}</FieldError>
                      </Field>
                    </FieldGroup>

                    <Field data-invalid={Boolean(fieldError("interests")) || undefined}>
                      <FieldLabel htmlFor="careerlens-interests">Sở thích và chủ đề quan tâm</FieldLabel>
                      <Input
                        id="careerlens-interests"
                        name="interests"
                        placeholder="Công nghệ, bóng đá, thiết kế, kinh doanh"
                        aria-invalid={Boolean(fieldError("interests")) || undefined}
                        required
                      />
                      <FieldDescription>Nhập 2-5 mục, phân tách bằng dấu phẩy.</FieldDescription>
                      <FieldError>{fieldError("interests")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("activity")) || undefined}>
                      <FieldLabel htmlFor="careerlens-activity">Hoạt động hoặc dự án em từng làm</FieldLabel>
                      <Textarea
                        id="careerlens-activity"
                        name="activity"
                        rows={4}
                        placeholder="Mô tả vai trò, việc em đã làm và phần khiến em thấy hứng thú hoặc gặp khó khăn."
                        aria-invalid={Boolean(fieldError("activity")) || undefined}
                        required
                      />
                      <FieldError>{fieldError("activity")}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                <FieldSet>
                  <FieldLegend>Điều kiện học tập và làm việc</FieldLegend>
                  <FieldGroup className="grid gap-5 md:grid-cols-2">
                    <Field data-invalid={Boolean(fieldError("weeklyHours")) || undefined}>
                      <FieldLabel htmlFor="careerlens-hours">Giờ có thể học mỗi tuần</FieldLabel>
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
                      <FieldLabel htmlFor="careerlens-budget">Ngân sách dự kiến</FieldLabel>
                      <Input
                        id="careerlens-budget"
                        name="targetBudget"
                        placeholder="Ví dụ: dưới 20 triệu đồng/năm"
                        aria-invalid={Boolean(fieldError("targetBudget")) || undefined}
                      />
                      <FieldError>{fieldError("targetBudget")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("workEnvironment")) || undefined}>
                      <FieldLabel htmlFor="careerlens-work-env">Môi trường làm việc mong muốn</FieldLabel>
                      <Select
                        id="careerlens-work-env"
                        name="workEnvironment"
                        defaultValue="team_based"
                        aria-invalid={Boolean(fieldError("workEnvironment")) || undefined}
                        required
                      >
                        {workEnvironmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <FieldError>{fieldError("workEnvironment")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("learningStyle")) || undefined}>
                      <FieldLabel htmlFor="careerlens-learning-style">Cách học phù hợp</FieldLabel>
                      <Select
                        id="careerlens-learning-style"
                        name="learningStyle"
                        defaultValue="project_based"
                        aria-invalid={Boolean(fieldError("learningStyle")) || undefined}
                        required
                      >
                        {learningStyleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <FieldError>{fieldError("learningStyle")}</FieldError>
                    </Field>
                  </FieldGroup>

                  <Field data-invalid={Boolean(fieldError("familyConstraints")) || undefined}>
                    <FieldLabel htmlFor="careerlens-constraints">Ràng buộc cần cân nhắc</FieldLabel>
                    <Textarea
                      id="careerlens-constraints"
                      name="familyConstraints"
                      rows={3}
                      placeholder="Ví dụ: cần học gần nhà, cần vừa học vừa làm. Có thể để trống."
                      aria-invalid={Boolean(fieldError("familyConstraints")) || undefined}
                    />
                    <FieldDescription>
                      Không nhập giới tính, tôn giáo, dân tộc hoặc thông tin nhận dạng không cần thiết.
                    </FieldDescription>
                    <FieldError>{fieldError("familyConstraints")}</FieldError>
                  </Field>
                </FieldSet>

                <FieldSeparator />

                <FieldSet>
                  <FieldLegend>Mục tiêu của lần tư vấn</FieldLegend>
                  <FieldGroup>
                    <Field data-invalid={Boolean(fieldError("intent")) || undefined}>
                      <FieldLabel htmlFor="careerlens-intent">Em muốn giải quyết điều gì?</FieldLabel>
                      <Select
                        id="careerlens-intent"
                        name="intent"
                        defaultValue="initial_guidance"
                        aria-invalid={Boolean(fieldError("intent")) || undefined}
                        required
                      >
                        {intentOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <FieldError>{fieldError("intent")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("targetCareer")) || undefined}>
                      <FieldLabel htmlFor="careerlens-target-career">Ngành hoặc nghề đang cân nhắc</FieldLabel>
                      <Input
                        id="careerlens-target-career"
                        name="targetCareer"
                        placeholder="Ví dụ: thiết kế sản phẩm, an toàn thông tin. Có thể để trống."
                        aria-invalid={Boolean(fieldError("targetCareer")) || undefined}
                      />
                      <FieldError>{fieldError("targetCareer")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("question")) || undefined}>
                      <FieldLabel htmlFor="careerlens-question">Câu hỏi quan trọng nhất của em</FieldLabel>
                      <Textarea
                        id="careerlens-question"
                        name="question"
                        rows={4}
                        placeholder="Ví dụ: Em muốn biết hướng nào phù hợp với điểm mạnh hiện tại nhưng vẫn có lộ trình học trong ngân sách."
                        aria-invalid={Boolean(fieldError("question")) || undefined}
                        required
                      />
                      <FieldError>{fieldError("question")}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldError("model")) || undefined}>
                      <FieldLabel htmlFor="careerlens-model">Model phân tích</FieldLabel>
                      <Select
                        id="careerlens-model"
                        name="model"
                        defaultValue={models[0]}
                        aria-invalid={Boolean(fieldError("model")) || undefined}
                        required
                      >
                        {models.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </Select>
                      <FieldDescription>Model được gọi qua FPT Cloud AI.</FieldDescription>
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
                          Tôi đồng ý dùng dữ liệu trong form để tạo lộ trình hướng nghiệp.
                        </FieldLabel>
                        <FieldDescription>
                          AI chỉ đưa gợi ý tham khảo và không quyết định thay người học.
                        </FieldDescription>
                        <FieldError>{fieldError("consent")}</FieldError>
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-6" aria-live="polite">
                {state.status === "error" ? (
                  <p className="text-sm text-destructive">{state.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Mỗi lần tạo sẽ sinh ba lựa chọn có giải thích.
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" disabled={pending || models.length === 0}>
                {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                {pending ? "Đang tạo lộ trình" : "Tạo lộ trình"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-6">
          <Card>
            <CardHeader>
              <Database aria-hidden="true" className="size-5 text-primary" strokeWidth={1.8} />
              <CardTitle>Dữ liệu thị trường mẫu</CardTitle>
              <CardDescription>
                POC chưa dùng crawler production. Các con số dưới đây chỉ mô tả bộ seed hiện tại.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-5">
              <div>
                <p className="font-mono text-3xl font-semibold">{marketOverview.postingCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">job postings</p>
              </div>
              <div>
                <p className="font-mono text-3xl font-semibold">{marketOverview.regionCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">khu vực</p>
              </div>
              <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <FileSearch aria-hidden="true" className="size-4" strokeWidth={1.8} />
                Nguồn mẫu ngày {marketOverview.sourceDate}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <LockKeyhole aria-hidden="true" />
            <AlertTitle>Quyền riêng tư được lọc trước</AlertTitle>
            <AlertDescription>
              Gender, hometown, ethnicity và religion không nằm trong payload gửi tới model.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <BrainCircuit aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>AI kết hợp học lực, sở thích, cách học và tín hiệu thị trường.</p>
            </div>
            <div className="flex items-start gap-3">
              <Route aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>Mỗi hướng có skill gap và các chặng thực hành kiểm chứng được.</p>
            </div>
            <div className="flex items-start gap-3">
              <BriefcaseBusiness aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>Role và salary chỉ lấy từ market seed được cung cấp cho lần chạy.</p>
            </div>
          </div>
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
