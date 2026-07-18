import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AI model configuration", () => {
  it("uses Qwen3.6-27B as the default when it is configured", async () => {
    vi.stubEnv(
      "FPT_AI_MODEL",
      "DeepSeek-V4-Flash,Qwen3.6-27B,SaoLa3.1-medium",
    );

    const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import("@/lib/ai/client");

    expect(DEFAULT_MODEL).toBe("Qwen3.6-27B");
    expect(AVAILABLE_MODELS[0]).toBe("Qwen3.6-27B");
  });

  it("falls back to Qwen3.6-27B without model configuration", async () => {
    vi.stubEnv("FPT_AI_MODEL", "");

    const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import("@/lib/ai/client");

    expect(DEFAULT_MODEL).toBe("Qwen3.6-27B");
    expect(AVAILABLE_MODELS).toEqual(["Qwen3.6-27B"]);
  });

  it("keeps Qwen3.6-27B first even when the environment omits it", async () => {
    vi.stubEnv("FPT_AI_MODEL", "DeepSeek-V4-Flash,SaoLa3.1-medium");

    const { AVAILABLE_MODELS, DEFAULT_MODEL, resolveAIModel } = await import(
      "@/lib/ai/client"
    );

    expect(DEFAULT_MODEL).toBe("Qwen3.6-27B");
    expect(AVAILABLE_MODELS).toEqual([
      "Qwen3.6-27B",
      "DeepSeek-V4-Flash",
      "SaoLa3.1-medium",
    ]);
    expect(resolveAIModel("unknown-model")).toBe("Qwen3.6-27B");
  });
});
