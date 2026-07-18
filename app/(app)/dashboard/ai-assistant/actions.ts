"use server";

import { requireViewer } from "@/lib/auth/dal";
import { generateAIResponse } from "@/lib/ai";

const SYSTEM_PROMPT = `You are MeshMind AI, a career guidance assistant for Vietnamese students.
Your role is to help students understand career paths, required skills, salary expectations, and job market trends in Vietnam.

Guidelines:
- Be concise, direct, and practical
- Ground advice in real Vietnamese labor market context
- Present multiple options rather than a single answer
- Never reinforce gender or regional bias
- Always frame suggestions as references, not definitive answers
- If asked about topics unrelated to career guidance, politely redirect

Respond in the same language the user writes in (Vietnamese or English).`;

export async function getAvailableModelsAction() {
  const { AVAILABLE_MODELS } = await import("@/lib/ai");
  return AVAILABLE_MODELS;
}

export async function askAIAction(message: string, model?: string) {
  const viewer = await requireViewer();

  const { text, rawResponse } = await generateAIResponse({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: message,
    model,
    traceName: "system",
    userId: viewer.actor.kind === "user" ? viewer.actor.userId : undefined,
  });

  return { text, rawResponse };
}
