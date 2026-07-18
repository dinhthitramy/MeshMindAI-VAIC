import "server-only";

export const AVAILABLE_MODELS = (process.env.FPT_AI_MODEL ?? "DeepSeek-V4-Flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];
