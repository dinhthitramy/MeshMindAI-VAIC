import type { Metadata } from "next";

import { AVAILABLE_MODELS } from "@/lib/ai";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  CAREERLENS_MARKET_SEED,
  MARKET_INDUSTRY_COUNT,
  MARKET_ROLE_COUNT_PER_REGION,
} from "@/lib/careerlens/market-seed";

import { CareerWorkspace } from "./_components/career-workspace";

export const metadata: Metadata = {
  title: "Lộ trình AI",
};

export default async function CareerLensPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);

  const regionCount = new Set(
    CAREERLENS_MARKET_SEED.postings.map((posting) => posting.region),
  ).size;
  const sourceDate = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(CAREERLENS_MARKET_SEED.source_timestamp));

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 max-w-3xl">
        <p className="text-sm font-medium text-primary">CareerLens Guidance AI</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Tạo lộ trình từ điều em đã biết về mình
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Kết nối sở thích, trải nghiệm và điều kiện thực tế với tín hiệu tuyển dụng mẫu tại Việt Nam.
        </p>
      </header>

      <CareerWorkspace
        models={AVAILABLE_MODELS}
        marketOverview={{
          postingCount: CAREERLENS_MARKET_SEED.postings.length,
          regionCount,
          roleCountPerRegion: MARKET_ROLE_COUNT_PER_REGION,
          industryCount: MARKET_INDUSTRY_COUNT,
          sourceDate,
        }}
      />
    </section>
  );
}
