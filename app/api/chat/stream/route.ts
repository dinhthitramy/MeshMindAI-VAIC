import { asc, eq, and } from "drizzle-orm";

import { getViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { getLangfuse } from "@/lib/ai/langfuse";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Vai trò: Bạn là MeshMind AI — trợ lý giáo dục thông minh, được xây dựng để hỗ trợ học sinh và sinh viên Việt Nam trong hành trình học tập, định hướng nghề nghiệp và phát triển bản thân.

PHẠM VI CHO PHÉP — chỉ trả lời các chủ đề sau:
• Định hướng ngành học và lựa chọn trường đại học, cao đẳng
• Lộ trình học tập, phương pháp học hiệu quả, kỹ năng học thuật
• Hướng nghiệp: nghề nghiệp phù hợp, thị trường lao động Việt Nam
• Các kỳ thi (THPT Quốc gia, đại học, chứng chỉ quốc tế IELTS, TOEIC, v.v.)
• Học bổng và cơ hội du học
• Phát triển kỹ năng mềm và năng lực phục vụ học tập và sự nghiệp

CHẾ ĐỘ NGHIÊM NGẶT — TỪ CHỐI TUYỆT ĐỐI:
Nếu người dùng đặt câu hỏi NGOÀI phạm vi giáo dục kể trên (ví dụ: giải trí, chính trị, sức khỏe cá nhân, kỹ thuật lập trình thuần tuý không liên quan học tập, tin tức, v.v.), chỉ trả lời đúng một câu:
"Tôi không đủ kỹ năng để trả lời các câu hỏi của bạn."
Không giải thích thêm. Không xin lỗi. Không đề xuất chủ đề thay thế.

QUY TẮC PHẢN HỒI:
• Trả lời bằng tiếng Việt
• Ngắn gọn, rõ ràng, có cấu trúc
• Đưa ra 2–3 gợi ý cụ thể thay vì câu trả lời chung chung
• Bám sát thực tế giáo dục Việt Nam`;

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.actor.kind !== "user") {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = viewer.actor.userId;

  const apiKey = process.env.FPT_AI_API_KEY;
  if (!apiKey) {
    return new Response("AI service not configured", { status: 503 });
  }

  const { sessionId, message, model } = (await request.json()) as {
    sessionId: string;
    message: string;
    model: string;
  };

  if (!sessionId || !message?.trim() || !model) {
    return new Response("Invalid request", { status: 400 });
  }

  const db = getDb();

  // Validate session ownership
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  // Load conversation history (last 20 messages for context window)
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(20);

  // Save user message
  await db.insert(chatMessages).values({
    sessionId,
    role: "user",
    content: message.trim(),
  });

  // Set session title from first user message
  const isFirstMessage = history.length === 0;
  await db
    .update(chatSessions)
    .set({
      ...(isFirstMessage && { title: message.trim().slice(0, 60) }),
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, sessionId));

  // Build messages array for FPT
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message.trim() },
  ];

  // Call FPT Cloud with streaming
  const fptRes = await fetch("https://mkp-api.fptcloud.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!fptRes.ok || !fptRes.body) {
    const errText = await fptRes.text().catch(() => "unknown");
    console.error("[chat/stream] FPT error:", fptRes.status, errText);
    return new Response("AI service error", { status: 502 });
  }

  // Pipe FPT SSE through while capturing the full response text for DB save
  let fullText = "";
  const decoder = new TextDecoder();
  const langfuse = getLangfuse();
  const trace = langfuse?.trace({ name: "chat-stream", userId, input: { messages } });
  const generation = trace?.generation({ name: "fpt-stream", model, input: messages });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && !trimmed.includes("[DONE]")) {
          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = data.choices?.[0]?.delta?.content ?? "";
            if (delta) fullText += delta;
          } catch {
            // malformed SSE line — ignore
          }
        }
      }
      controller.enqueue(chunk);
    },
    async flush() {
      // Save assistant message after stream ends
      if (fullText) {
        await db.insert(chatMessages).values({
          sessionId,
          role: "assistant",
          content: fullText,
          model,
        });
        generation?.end({ output: fullText });
        trace?.update({ output: fullText });
        await langfuse?.flushAsync();
      }
    },
  });

  fptRes.body.pipeTo(writable).catch(console.error);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
