import "server-only";

export const PREFERRED_DEFAULT_MODEL = "Qwen3.6-27B";

const configuredModels = (process.env.FPT_AI_MODEL?.trim() || PREFERRED_DEFAULT_MODEL)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const AVAILABLE_MODELS = [
  PREFERRED_DEFAULT_MODEL,
  ...configuredModels.filter((model) => model !== PREFERRED_DEFAULT_MODEL),
];

export const DEFAULT_MODEL = PREFERRED_DEFAULT_MODEL;

export function resolveAIModel(model: string | null | undefined) {
  return model && AVAILABLE_MODELS.includes(model) ? model : DEFAULT_MODEL;
}
