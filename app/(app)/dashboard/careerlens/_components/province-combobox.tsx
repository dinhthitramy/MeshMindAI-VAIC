"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  VIETNAM_PROVINCES,
  type VietnamProvince,
} from "@/lib/careerlens/vietnam-provinces";

type ProvinceComboboxProps = {
  id: string;
  name: string;
  defaultValue?: VietnamProvince;
  invalid?: boolean;
};

export function ProvinceCombobox({
  id,
  name,
  defaultValue = "Thành phố Hồ Chí Minh",
  invalid = false,
}: ProvinceComboboxProps) {
  const [value, setValue] = useState<string | null>(defaultValue);

  return (
    <>
      <Combobox
        items={[...VIETNAM_PROVINCES]}
        value={value}
        onValueChange={setValue}
        autoHighlight
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder="Gõ để tìm tỉnh/thành"
          aria-invalid={invalid || undefined}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>Không tìm thấy tỉnh/thành phù hợp.</ComboboxEmpty>
          <ComboboxList>
            {(province) => (
              <ComboboxItem key={province} value={province}>
                {province}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <input type="hidden" name={name} value={value ?? ""} />
    </>
  );
}
