"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getInterestSuggestions } from "@/lib/careerlens/interest-suggestions";

type InterestProfileFieldsProps = {
  subjectError?: string;
  scoreError?: string;
  interestsError?: string;
};

function splitInterests(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function InterestProfileFields({
  subjectError,
  scoreError,
  interestsError,
}: InterestProfileFieldsProps) {
  const [subject, setSubject] = useState("");
  const [interests, setInterests] = useState("");
  const suggestions = useMemo(() => getInterestSuggestions(subject), [subject]);

  function addSuggestion(suggestion: string) {
    const current = splitInterests(interests);
    const exists = current.some(
      (item) => item.toLocaleLowerCase("vi") === suggestion.toLocaleLowerCase("vi"),
    );

    if (!exists) setInterests([...current, suggestion].join(", "));
  }

  return (
    <>
      <FieldGroup className="grid gap-5 md:grid-cols-[minmax(0,1fr)_9rem]">
        <Field data-invalid={Boolean(subjectError) || undefined}>
          <FieldLabel htmlFor="careerlens-subject">Môn hoặc kỹ năng nổi bật</FieldLabel>
          <Input
            id="careerlens-subject"
            name="strongSubject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Ví dụ: Toán, viết nội dung, sửa điện"
            aria-invalid={Boolean(subjectError) || undefined}
            required
          />
          <FieldError>{subjectError}</FieldError>
        </Field>

        <Field data-invalid={Boolean(scoreError) || undefined}>
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
            aria-invalid={Boolean(scoreError) || undefined}
            required
          />
          <FieldError>{scoreError}</FieldError>
        </Field>
      </FieldGroup>

      <Field data-invalid={Boolean(interestsError) || undefined}>
        <FieldLabel htmlFor="careerlens-interests">Sở thích và chủ đề quan tâm</FieldLabel>
        <Input
          id="careerlens-interests"
          name="interests"
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          placeholder="Công nghệ, bóng đá, thiết kế, kinh doanh"
          aria-invalid={Boolean(interestsError) || undefined}
          required
        />
        <FieldDescription>
          Nhập các mục cách nhau bằng dấu phẩy, hoặc thêm nhanh từ gợi ý theo môn/kỹ năng.
        </FieldDescription>
        <div className="flex flex-wrap gap-2" aria-label="Gợi ý chủ đề quan tâm">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSuggestion(suggestion)}
            >
              <Plus aria-hidden="true" />
              {suggestion}
            </Button>
          ))}
        </div>
        <FieldError>{interestsError}</FieldError>
      </Field>
    </>
  );
}

