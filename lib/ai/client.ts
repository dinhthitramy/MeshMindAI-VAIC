import "server-only";

const PREFERRED_DEFAULT_MODEL = "Qwen3.6-27B";

const configuredModels = (process.env.FPT_AI_MODEL?.trim() || PREFERRED_DEFAULT_MODEL)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const AVAILABLE_MODELS = configuredModels.includes(PREFERRED_DEFAULT_MODEL)
  ? [
      PREFERRED_DEFAULT_MODEL,
      ...configuredModels.filter((model) => model !== PREFERRED_DEFAULT_MODEL),
    ]
  : configuredModels;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0] ?? PREFERRED_DEFAULT_MODEL;
