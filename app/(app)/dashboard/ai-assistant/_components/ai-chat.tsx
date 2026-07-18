"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, ChevronDown, User } from "lucide-react";

import { askAIAction, getAvailableModelsAction } from "../actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/50"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
          isUser
            ? "border-foreground/10 bg-foreground text-background"
            : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className="flex flex-col gap-1">
        {!isUser && message.model && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {message.model}
          </span>
        )}
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-foreground text-background"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

function ModelSelector({
  models,
  selected,
  onChange,
  disabled,
}: {
  models: string[];
  selected: string;
  onChange: (m: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <span className="max-w-[140px] truncate">{selected}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 z-10 mb-1.5 min-w-[180px] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
          >
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { onChange(m); setOpen(false); }}
                className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${
                  m === selected ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {m === selected && <span className="mr-2 size-1.5 rounded-full bg-foreground" />}
                {m}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AIChat({ initialModels }: { initialModels: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialModels[0] ?? "DeepSeek-V4-Flash");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setInput("");

    startTransition(async () => {
      const { text } = await askAIAction(trimmed, selectedModel);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: text, model: selectedModel },
      ]);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex h-full flex-col items-start justify-center gap-4 pb-12"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted">
              <Bot size={22} className="text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Career guidance, on demand.</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Ask about career paths, required skills, salary ranges, or job market trends in Vietnam.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Ngành IT phù hợp với tôi không?", "Mức lương kỹ sư phần mềm tại HCM?", "Skills needed for product management?"].map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            </AnimatePresence>
            {isPending && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <ModelSelector
            models={initialModels}
            selected={selectedModel}
            onChange={setSelectedModel}
            disabled={isPending}
          />
          <span className="text-xs text-muted-foreground/40">FPT Cloud AI</span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-foreground/20"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about careers, skills, or job market..."
            rows={1}
            disabled={isPending}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || isPending}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity disabled:opacity-30"
          >
            <ArrowUp size={15} />
          </motion.button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground/50">
          AI suggestions are for reference only. Always verify with career counselors.
        </p>
      </div>
    </div>
  );
}
