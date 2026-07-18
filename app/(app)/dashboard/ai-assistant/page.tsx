import type { Metadata } from "next";

import { AVAILABLE_MODELS } from "@/lib/ai";

import { AIChat } from "./_components/ai-chat";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default function AIAssistantPage() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      <div className="border-b px-6 py-4">
        <h1 className="text-base font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-xs text-muted-foreground">Powered by FPT Cloud AI</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <AIChat initialModels={AVAILABLE_MODELS} />
      </div>
    </div>
  );
}
