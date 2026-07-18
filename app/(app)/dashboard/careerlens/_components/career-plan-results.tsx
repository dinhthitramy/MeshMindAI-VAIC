"use client";

import {
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  Compass,
  Gauge,
  Lightbulb,
  MapPin,
  Target,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CareerGuidanceOutput } from "@/lib/careerlens/schemas";

const categoryLabels: Record<CareerGuidanceOutput["recommendations"][number]["path_category"], string> = {
  university: "Đại học",
  college: "Cao đẳng",
  vocational: "Học nghề",
  certificate: "Chứng chỉ",
  apprenticeship: "Học việc",
  self_learning: "Tự học có hướng dẫn",
};

function cleanText(value: string) {
  return value.replace(/[–—]/g, "-");
}

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          {cleanText(item)}
        </li>
      ))}
    </ul>
  );
}

type CareerPlanResultsProps = {
  output: CareerGuidanceOutput;
  successMessage?: string;
};

export function CareerPlanResults({ output, successMessage }: CareerPlanResultsProps) {
  return (
    <section aria-labelledby="career-plan-results" className="flex flex-col gap-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Kết quả phân tích</p>
        <h2 id="career-plan-results" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Ba hướng để em kiểm chứng
        </h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {cleanText(successMessage ?? "So sánh mức phù hợp, skill gap và công sức cần đầu tư trước khi chọn.")}
        </p>
      </header>

      <Alert>
        <Compass aria-hidden="true" />
        <AlertTitle>Đây là gợi ý tham khảo</AlertTitle>
        <AlertDescription>{cleanText(output.disclaimer)}</AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ AI đã đọc</CardTitle>
            <CardDescription>
              Độ tin cậy dữ liệu: {output.profile_summary.data_confidence}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">Điểm mạnh</h3>
              {output.profile_summary.strengths.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                  {output.profile_summary.strengths.map((strength) => (
                    <li key={strength} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      {cleanText(strength)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Chưa đủ dữ liệu để kết luận.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">Sở thích và tín hiệu</h3>
              {output.profile_summary.interests.length + output.profile_summary.personal_signals.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                  {[...output.profile_summary.interests, ...output.profile_summary.personal_signals]
                    .slice(0, 5)
                    .map((signal) => (
                      <li key={signal} className="flex items-start gap-2">
                        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        {cleanText(signal)}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Chưa có tín hiệu cá nhân rõ ràng.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tín hiệu thị trường</CardTitle>
            <CardDescription>Các kỹ năng thiếu hụt nổi bật trong market seed.</CardDescription>
          </CardHeader>
          <CardContent>
            {output.market_summary.short_supply_skills.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {output.market_summary.short_supply_skills.slice(0, 4).map((item) => (
                  <li key={`${item.skill}-${item.region}`}>
                    <p className="font-medium">{cleanText(item.skill)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin aria-hidden="true" className="size-4" />
                      {cleanText(item.region)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa đủ dữ liệu để xác định kỹ năng thiếu hụt.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-7">
        {output.recommendations.map((recommendation, recommendationIndex) => (
          <Card key={`${recommendation.path_title}-${recommendationIndex}`}>
            <CardHeader className="gap-5 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-start">
              <div>
                <p className="text-sm font-medium text-primary">
                  {categoryLabels[recommendation.path_category]}
                </p>
                <CardTitle className="mt-1">{cleanText(recommendation.path_title)}</CardTitle>
                <CardDescription className="mt-2 max-w-3xl">
                  {cleanText(recommendation.fit_explanation)}
                </CardDescription>
              </div>
              <div className="lg:text-right">
                <p className="font-mono text-4xl font-semibold tracking-tight">
                  {recommendation.fit_score}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">điểm phù hợp tham khảo</p>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-7">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Target aria-hidden="true" className="size-4 text-primary" />
                    Vì sao hướng này đáng thử
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                    {recommendation.matched_profile_signals.slice(0, 5).map((signal) => (
                      <li key={signal} className="flex items-start gap-2">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        {cleanText(signal)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Gauge aria-hidden="true" className="size-4 text-primary" />
                    Bằng chứng thị trường
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                    {recommendation.market_evidence.slice(0, 5).map((evidence) => (
                      <li key={evidence}>{cleanText(evidence)}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-base font-semibold">Skill gap cần ưu tiên</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recommendation.skill_gaps.map((gap) => (
                    <div key={gap.skill} className="rounded-xl bg-muted/60 p-4">
                      <p className="font-medium">{cleanText(gap.skill)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gap.current_level} đến {gap.target_level}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {cleanText(gap.why_needed)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <BookOpenCheck aria-hidden="true" className="size-4 text-primary" />
                  Roadmap thực hành
                </h3>
                <Accordion>
                  {recommendation.roadmap.map((stage) => (
                    <AccordionItem key={`${stage.stage_order}-${stage.stage_name}`} value={String(stage.stage_order)}>
                      <AccordionTrigger>
                        <span>
                          {cleanText(stage.stage_name)}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {cleanText(stage.time_limit)}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {stage.stage_type === "learning" ? (
                          <div className="flex flex-col gap-6">
                            <div className="rounded-xl bg-muted/60 p-4">
                              <p className="text-sm font-medium">Ngành hoặc hướng chuyên sâu</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {cleanText(stage.major_or_track)}
                              </p>
                            </div>

                            <div>
                              <p className="font-medium">Môn và nội dung cần học</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.subjects.map((subject) => (
                                  <div key={subject.subject_name} className="rounded-xl border p-4">
                                    <p className="font-medium">{cleanText(subject.subject_name)}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                      {cleanText(subject.focus)}
                                    </p>
                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                      Bằng chứng: {cleanText(subject.evidence_of_completion)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {stage.certificates.length > 0 ? (
                              <div>
                                <p className="font-medium">Chứng chỉ nên cân nhắc</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {stage.certificates.map((certificate) => (
                                    <div key={certificate.certificate_name} className="rounded-xl bg-muted/60 p-4">
                                      <p className="font-medium">{cleanText(certificate.certificate_name)}</p>
                                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {cleanText(certificate.purpose)}
                                      </p>
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        Thời điểm: {cleanText(certificate.target_time)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <p className="font-medium">Nghiên cứu khoa học, cuộc thi và dự án CLB</p>
                              <div className="mt-3 flex flex-col gap-3">
                                {stage.research_and_competitions.map((activity) => (
                                  <div key={`${activity.activity_type}-${activity.activity_name}`} className="rounded-xl border p-4">
                                    <p className="font-medium">{cleanText(activity.activity_name)}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                      {cleanText(activity.goal)}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                      Bằng chứng: {cleanText(activity.evidence_of_completion)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="font-medium">Mốc hoàn thành</p>
                              <DetailList items={stage.milestones} />
                            </div>
                          </div>
                        ) : stage.stage_type === "internship" ? (
                          <div className="flex flex-col gap-6">
                            <div>
                              <p className="font-medium">Nên tìm cơ hội ở đâu</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.target_organizations.map((target) => (
                                  <div key={`${target.organization}-${target.region}`} className="rounded-xl border p-4">
                                    <p className="font-medium">{cleanText(target.organization)}</p>
                                    <p className="mt-1 text-sm text-primary">{cleanText(target.region)}</p>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                      {cleanText(target.opportunity_type)}. {cleanText(target.why_target)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                              <div className="rounded-xl bg-muted/60 p-4">
                                <p className="font-medium">Chuẩn bị CV và portfolio</p>
                                <DetailList items={stage.cv_preparation} />
                              </div>
                              <div className="rounded-xl bg-muted/60 p-4">
                                <p className="font-medium">Kiến thức cần áp dụng</p>
                                <DetailList items={stage.applied_knowledge} />
                              </div>
                              <div className="rounded-xl bg-muted/60 p-4">
                                <p className="font-medium">Chuẩn bị vòng phỏng vấn</p>
                                <DetailList items={stage.interview_preparation} />
                              </div>
                              <div className="rounded-xl bg-muted/60 p-4">
                                <p className="font-medium">Kết quả cần đạt sau kỳ intern</p>
                                <DetailList items={stage.success_metrics} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-6">
                            <div>
                              <p className="font-medium">Công việc và cách đánh giá offer</p>
                              <div className="mt-3 flex flex-col gap-4">
                                {stage.target_roles.map((role) => (
                                  <div key={role.role_name} className="rounded-xl border p-4">
                                    <p className="font-medium">{cleanText(role.role_name)}</p>
                                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                                      <div>
                                        <p className="text-sm font-medium">Trách nhiệm chính</p>
                                        <DetailList items={role.responsibilities} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">Lương, thưởng và phúc lợi</p>
                                        <DetailList items={role.salary_and_benefits_basis} />
                                      </div>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                      Tín hiệu sẵn sàng: {cleanText(role.readiness_signal)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-xl bg-muted/60 p-4">
                              <p className="font-medium">Kế hoạch 90 ngày đầu</p>
                              <DetailList items={stage.first_90_days} />
                            </div>

                            <div>
                              <p className="font-medium">Đường phát triển lên vị trí cao hơn</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.promotion_path.map((step) => (
                                  <div key={step.target_position} className="rounded-xl border p-4">
                                    <p className="font-medium">{cleanText(step.target_position)}</p>
                                    <p className="mt-1 text-sm text-primary">
                                      {cleanText(step.expected_timeline)}
                                    </p>
                                    <DetailList items={step.capabilities_to_build} />
                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                      Bằng chứng sẵn sàng: {cleanText(step.proof_of_readiness)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {recommendation.related_jobs.length > 0 ? (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                    <BriefcaseBusiness aria-hidden="true" className="size-4 text-primary" />
                    Việc làm liên quan
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {recommendation.related_jobs.slice(0, 4).map((job) => (
                      <div key={`${job.job_title}-${job.region}`} className="rounded-xl border p-4">
                        <p className="font-medium">{cleanText(job.job_title)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {cleanText(job.region)} | {cleanText(job.salary_band)}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {cleanText(job.why_relevant)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="gap-3">
              <CircleHelp aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-6 text-muted-foreground">
                {cleanText(recommendation.autonomy_note)}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>

      {output.questions_to_improve_recommendation.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Câu hỏi cho lần tư vấn tiếp theo</CardTitle>
            <CardDescription>Trả lời thêm các câu này để thu hẹp skill gap và chi phí.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              {output.questions_to_improve_recommendation.map((question, index) => (
                <li key={question} className="flex gap-3">
                  <span className="font-mono text-foreground">{index + 1}.</span>
                  {cleanText(question)}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
