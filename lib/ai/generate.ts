import "server-only";

import { DEFAULT_MODEL } from "./client";
import { AIServiceError } from "./errors";
import { getLangfuse } from "./langfuse";

export type MessageRole = "system" | "user";

export interface AIMessage {
  role: MessageRole;
  content: string;
}

export interface AIGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  rawInput?: unknown;
  model?: string;
  traceName?: string;
  userId?: string;
  langfusePromptName?: string;
}

// FPT Cloud returns standard OpenAI format directly (no wrapper)
export interface FPTRawResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: { role: string; content: string | null };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIGenerateResult {
  text: string;
  messages: AIMessage[];
  rawResponse: FPTRawResponse;
}

async function resolveSystemPrompt(options: AIGenerateOptions): Promise<string> {
  if (!options.langfusePromptName) return options.systemPrompt;

  const langfuse = getLangfuse();
  if (!langfuse) return options.systemPrompt;

  try {
    const prompt = await langfuse.getPrompt(options.langfusePromptName);
    const compiled = prompt.compile();
    if (Array.isArray(compiled)) {
      const systemMsg = compiled.find((m: { role: string }) => m.role === "system");
      return systemMsg?.content ?? options.systemPrompt;
    }
    return typeof compiled === "string" ? compiled : options.systemPrompt;
  } catch {
    console.warn(`[ai] Langfuse prompt "${options.langfusePromptName}" not found, using fallback`);
    return options.systemPrompt;
  }
}

function buildMessages(systemPrompt: string, options: AIGenerateOptions): AIMessage[] {
  const userContent = options.rawInput
    ? `${options.userPrompt}\n\n<data>\n${JSON.stringify(options.rawInput, null, 2)}\n</data>`
    : options.userPrompt;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}

async function callFPT(model: string, messages: AIMessage[]): Promise<FPTRawResponse> {
  const apiKey = process.env.FPT_AI_API_KEY;
  if (!apiKey) throw new AIServiceError("Missing FPT_AI_API_KEY");

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch("https://mkp-api.fptcloud.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    if (res.ok) {
      const json = await res.json();
      console.log("[fpt] raw response:", JSON.stringify(json).slice(0, 500));
      return json as FPTRawResponse;
    }

    if ([429, 500, 503].includes(res.status) && attempt < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(`[fpt] attempt ${attempt} failed (${res.status}), retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const body = await res.text();
    throw new AIServiceError(`FPT API error ${res.status}: ${body}`);
  }

  throw new AIServiceError("FPT API unavailable after retries");
}

/**
 * Core AI generation using FPT Cloud API directly (raw fetch) with Langfuse tracing.
 */
export async function generateAIResponse(
  options: AIGenerateOptions,
): Promise<AIGenerateResult> {
  const systemPrompt = await resolveSystemPrompt(options);
  const messages = buildMessages(systemPrompt, options);
  const model = options.model ?? DEFAULT_MODEL;
  const langfuse = getLangfuse();

  const trace = langfuse?.trace({
    name: options.traceName ?? "ai-generate",
    userId: options.userId,
    input: { messages },
  });

  const generation = trace?.generation({
    name: "fpt-generate",
    model,
    input: messages,
  });

  try {
    const rawResponse = await callFPT(model, messages);

    const text = rawResponse.choices?.[0]?.message?.content ?? "";
    const usage = rawResponse.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    generation?.end({
      output: rawResponse,
      usage: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
      },
    });

    trace?.update({ output: rawResponse });
    await langfuse?.flushAsync();

    return { text, messages, rawResponse };
  } catch (err) {
    generation?.end({ level: "ERROR", statusMessage: String(err) });
    trace?.update({ output: String(err) });
    await langfuse?.flushAsync();

    throw err instanceof AIServiceError ? err : new AIServiceError("AI generation failed", err);
  }
}

/**
 * Like generateAIResponse but parses the response as JSON.
 */
export async function generateAIJson<T = unknown>(
  options: AIGenerateOptions,
): Promise<{ data: T; messages: AIMessage[] }> {
  const { text, messages } = await generateAIResponse(options);

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return { data: JSON.parse(cleaned) as T, messages };
  } catch {
    throw new AIServiceError(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}
