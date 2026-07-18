"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  MessageSquarePlus,
  Trash2,
  User,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatSession, ChatMessage } from "@/lib/db/schema";
import {
  createSessionAction,
  deleteSessionAction,
  getSessionsAction,
  loadMessagesAction,
} from "../actions";

// ─── constants ───────────────────────────────────────────────────────────────

const PRESET_PROMPTS = [
  "Làm thế nào để chọn ngành học phù hợp với sở thích và năng lực?",
  "Lộ trình học lập trình từ con số 0 cho người mới bắt đầu?",
  "Cần chuẩn bị gì để thi đỗ vào đại học top đầu Việt Nam?",
  "Những kỹ năng quan trọng nhất sinh viên cần có trong thời đại AI?",
  "Học bổng du học Nhật Bản và Hàn Quốc dành cho sinh viên Việt Nam?",
] as const;

// ─── types ───────────────────────────────────────────────────────────────────

type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  streaming?: boolean;
};

// ─── TypingIndicator ─────────────────────────────────────────────────────────

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

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const isEmpty = !message.content && message.streaming;

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
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && message.model && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {message.model}
          </span>
        )}
        <div
          className={`max-w-[75vw] rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[65%] ${
            isUser
              ? "rounded-tr-sm bg-foreground text-background"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {isEmpty ? (
            <TypingIndicator />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ModelSelector ───────────────────────────────────────────────────────────

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
        <ChevronDown
          size={11}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
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
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${
                  m === selected ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {m === selected && (
                  <span className="mr-2 size-1.5 rounded-full bg-foreground" />
                )}
                {m}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SessionItem ─────────────────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group/item relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="session-active"
          className="absolute inset-0 rounded-lg bg-sidebar-accent"
          transition={{ duration: 0.15 }}
        />
      )}
      <span className="relative flex-1 truncate text-xs">{session.title}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={handleDelete}
        onKeyDown={(e) => e.key === "Enter" && handleDelete(e as unknown as React.MouseEvent)}
        title={confirmDelete ? "Click again to confirm" : "Delete session"}
        className={`relative shrink-0 rounded p-0.5 opacity-0 transition-colors group-hover/item:opacity-100 ${
          confirmDelete
            ? "text-destructive hover:bg-destructive/10"
            : "hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground"
        }`}
      >
        <Trash2 size={11} />
      </span>
    </button>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

function EmptyState({
  onPrompt,
  disabled,
}: {
  onPrompt: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col items-start justify-center gap-5 pb-16 pl-2"
    >
      <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted">
        <Bot size={20} className="text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">MeshMind AI</h2>
        <p className="mt-0.5 max-w-xs text-sm text-muted-foreground">
          Trợ lý giáo dục thông minh dành cho học sinh và sinh viên Việt Nam.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {PRESET_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onPrompt(p)}
            className="max-w-sm rounded-xl border border-border px-3.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── AIChat (main) ───────────────────────────────────────────────────────────

export function AIChat({ initialModels }: { initialModels: string[] }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialModels[0] ?? "DeepSeek-V4-Flash");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load sessions on mount
  useEffect(() => {
    getSessionsAction().then(setSessions);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const switchSession = useCallback((sessionId: string) => {
    if (isStreaming) return;
    setCurrentSessionId(sessionId);
    setMessages([]);
    startTransition(async () => {
      const msgs = await loadMessagesAction(sessionId);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model ?? undefined,
        })),
      );
    });
  }, [isStreaming]);

  const createNewSession = useCallback(async () => {
    if (isStreaming) return;
    const session = await createSessionAction(selectedModel);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setMessages([]);
  }, [isStreaming, selectedModel]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSessionAction(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Ensure there's an active session
    let sessionId = currentSessionId;
    if (!sessionId) {
      const session = await createSessionAction(selectedModel);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      sessionId = session.id;
    }

    setInput("");

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed, model: selectedModel }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ") && !trimmedLine.includes("[DONE]")) {
            try {
              const data = JSON.parse(trimmedLine.slice(6)) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = data.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                accumulated += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulated, model: selectedModel }
                      : m,
                  ),
                );
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }
      }

      // Mark streaming done, update session list (title may have changed)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m,
        ),
      );
      const updatedSessions = await getSessionsAction();
      setSessions(updatedSessions);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: "Đã xảy ra lỗi. Vui lòng thử lại.", streaming: false }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [currentSessionId, isStreaming, selectedModel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar"
          >
            <div className="flex h-12 shrink-0 items-center justify-between px-3">
              <span className="text-xs font-medium text-sidebar-foreground/60">Conversations</span>
              <Button
                variant="ghost"
                size="icon-sm"
                title="New Chat"
                onClick={createNewSession}
                disabled={isStreaming}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <MessageSquarePlus size={14} />
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
              {sessions.length === 0 ? (
                <p className="px-2 py-4 text-xs text-sidebar-foreground/40">
                  No conversations yet.
                </p>
              ) : (
                sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === currentSessionId}
                    onSelect={() => switchSession(s.id)}
                    onDelete={() => handleDeleteSession(s.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </Button>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {currentSession?.title ?? "New Chat"}
          </span>
          {!currentSessionId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewSession}
              disabled={isStreaming}
              className="gap-1.5 text-xs"
            >
              <MessageSquarePlus size={13} />
              New Chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
          {messages.length === 0 ? (
            <EmptyState onPrompt={sendMessage} disabled={isStreaming} />
          ) : (
            <div className="flex flex-col gap-5">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t px-4 py-3 md:px-6">
          <div className="mb-2 flex items-center justify-between">
            <ModelSelector
              models={initialModels}
              selected={selectedModel}
              onChange={setSelectedModel}
              disabled={isStreaming}
            />
            <span className="text-xs text-muted-foreground/40">FPT Cloud AI</span>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 transition-colors focus-within:border-foreground/20"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về học tập, lộ trình, ngành nghề..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isStreaming}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity disabled:opacity-30"
            >
              <ArrowUp size={15} />
            </motion.button>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground/40">
            MeshMind AI hỗ trợ các câu hỏi về giáo dục và định hướng nghề nghiệp.
          </p>
        </div>
      </div>
    </div>
  );
}
