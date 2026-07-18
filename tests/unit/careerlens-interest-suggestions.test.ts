import { describe, expect, it } from "vitest";

import { getInterestSuggestions } from "@/lib/careerlens/interest-suggestions";
import { VIETNAM_PROVINCES } from "@/lib/careerlens/vietnam-provinces";

describe("CareerLens profile helpers", () => {
  it("provides subject-specific interest suggestions", () => {
    expect(getInterestSuggestions("Toán và lập trình")).toEqual(
      expect.arrayContaining(["Phân tích dữ liệu", "Phát triển phần mềm", "AI và học máy"]),
    );
  });

  it("localizes suggestions for English input", () => {
    expect(getInterestSuggestions("Math and programming", "en")).toEqual(
      expect.arrayContaining(["Data analysis", "Software development", "AI and machine learning"]),
    );
  });

  it("keeps the official province list complete and unique", () => {
    expect(VIETNAM_PROVINCES).toHaveLength(34);
    expect(new Set(VIETNAM_PROVINCES)).toHaveLength(34);
    expect(VIETNAM_PROVINCES).toContain("Thành phố Hồ Chí Minh");
    expect(VIETNAM_PROVINCES).toContain("Tỉnh Cà Mau");
  });
});
