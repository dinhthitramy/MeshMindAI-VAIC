"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bot,
  House,
  MessageSquarePlus,
  Route,
  Square,
  Trash2,
} from "lucide-react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatSession } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  createSessionAction,
  deleteSessionAction,
  getSessionsAction,
  loadMessagesAction,
} from "../actions";

type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  streaming?: boolean;
};

const HOME_TAB = "assistant-home";

const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  li: ({ children }) => <li className="pl-1 marker:text-muted-foreground">{children}</li>,
  ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1.5">{children}</ol>,
  p: ({ children }) => <p>{children}</p>,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl bg-background/70 p-3 font-mono text-xs">
      {children}
    </pre>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  td: ({ children }) => <td className="border p-2 align-top">{children}</td>,
  th: ({ children }) => <th className="border bg-background/60 p-2 font-semibold">{children}</th>,
  ul: ({ children }) => <ul className="ml-5 list-disc space-y-1.5">{children}</ul>,
};

function TypingIndicator() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-1 px-1 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/50"
          animate={shouldReduceMotion ? { opacity: 0.7 } : { opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const shouldReduceMotion = useReducedMotion();
  const isUser = message.role === "user";
  const isEmpty = !message.content && message.streaming;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full"
    >
      <Message align={isUser ? "end" : "start"} className={cn(!isUser && "gap-4")}>
        {!isUser ? (
          <MessageAvatar className="size-8 self-start bg-foreground text-background">
            <Bot className="size-4" />
          </MessageAvatar>
        ) : null}
        <MessageContent className={cn(isUser ? "max-w-[85%] sm:max-w-[70%]" : "max-w-3xl")}>
          {!isUser && message.model ? (
            <MessageHeader className="px-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {message.model}
            </MessageHeader>
          ) : null}
          <Bubble
            align={isUser ? "end" : "start"}
            variant={isUser ? "default" : "ghost"}
            className={cn(!isUser && "w-full max-w-full")}
          >
            <BubbleContent
              className={cn(
                isUser
                  ? "rounded-[1.35rem] rounded-br-md px-4 py-3"
                  : "w-full text-[0.95rem] leading-7",
              )}
            >
              {isEmpty ? (
                <TypingIndicator />
              ) : isUser ? (
                <span className="whitespace-pre-wrap">{message.content}</span>
              ) : (
                <div className="flex flex-col gap-3">
                  <Markdown skipHtml remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {message.content}
                  </Markdown>
                </div>
              )}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
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
  onChange: (model: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("Assistant");
  const modelItems = models.map((value) => ({ value, label: value }));

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Select
        items={modelItems}
        value={selected}
        onValueChange={(value) => {
          if (value) onChange(value);
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" aria-label={t("model")} className="min-w-0 max-w-52 border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {modelItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function SessionTab({
  session,
  disabled,
}: {
  session: ChatSession;
  disabled: boolean;
}) {
  return (
    <TabsTrigger
      value={session.id}
      data-session-id={session.id}
      disabled={disabled}
      className="h-7 min-w-32 max-w-52 flex-none px-3 text-xs"
    >
      <span className="truncate">{session.title}</span>
    </TabsTrigger>
  );
}

function DeleteConversationButton({
  disabled,
  onDelete,
}: {
  disabled: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations("Assistant");

  return (
    <Button
      type="button"
      variant="destructive"
      size="icon-sm"
      onClick={onDelete}
      disabled={disabled}
      aria-label={t("delete")}
      title={t("delete")}
      className="shrink-0"
    >
      <Trash2 />
    </Button>
  );
}

function EmptyState({
  onPrompt,
  disabled,
}: {
  onPrompt: (text: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("Assistant");
  const shouldReduceMotion = useReducedMotion();
  const prompts = [
    t("prompts.major"),
    t("prompts.coding"),
    t("prompts.university"),
    t("prompts.skills"),
    t("prompts.scholarship"),
  ];

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-full items-center py-8 sm:py-12"
    >
      <Empty className="mx-auto grid max-w-5xl gap-10 border-0 p-2 text-left lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1.15fr)] lg:gap-16">
        <EmptyHeader className="max-w-none items-start text-left">
          <EmptyMedia variant="icon" className="size-11 rounded-2xl bg-foreground text-background">
            <Bot />
          </EmptyMedia>
          <EmptyTitle className="mt-4 max-w-sm text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {t("emptyTitle")}
          </EmptyTitle>
          <EmptyDescription className="mt-2 max-w-sm text-base leading-7">
            {t("emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex w-full flex-col border-t">
          {prompts.map((prompt, index) => (
            <Button
              key={prompt}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onPrompt(prompt)}
              className="group h-auto justify-start gap-4 rounded-none border-b px-0 py-4 text-left text-sm font-normal leading-6 whitespace-normal hover:bg-transparent"
            >
              <span className="font-mono text-xs text-muted-foreground/45">0{index + 1}</span>
              <span className="flex-1 transition-transform group-hover:translate-x-1">{prompt}</span>
              <ArrowUp className="size-4 rotate-45 text-muted-foreground/45" />
            </Button>
          ))}
        </div>
      </Empty>
    </motion.div>
  );
}

function OverviewHome({
  conversationCount,
  disabled,
  modelCount,
  onNewConversation,
  viewerName,
}: {
  conversationCount: number;
  disabled: boolean;
  modelCount: number;
  onNewConversation: () => void;
  viewerName: string;
}) {
  const t = useTranslations("Assistant");

  return (
    <section className="mx-auto grid min-h-full w-full max-w-5xl items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
      <header>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          {t("welcome", { name: viewerName })}
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          {t("overviewDescription")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={onNewConversation} disabled={disabled}>
            <MessageSquarePlus data-icon="inline-start" />
            {t("newConversation")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/dashboard/careerlens" />}
          >
            <Route data-icon="inline-start" />
            {t("openRoadmap")}
          </Button>
        </div>
      </header>

      <aside className="rounded-[2rem] bg-foreground p-7 text-background">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">
          {t("workspaceSnapshot")}
        </p>
        <div className="mt-8">
          <p className="font-mono text-5xl font-semibold tracking-[-0.06em]">
            {conversationCount}
          </p>
          <p className="mt-2 text-sm text-background/55">{t("conversationCount")}</p>
        </div>
        <Separator className="my-6 bg-background/10" />
        <div>
          <p className="font-mono text-3xl font-semibold tracking-[-0.04em]">{modelCount}</p>
          <p className="mt-2 text-sm text-background/55">{t("modelCount")}</p>
        </div>
      </aside>
    </section>
  );
}

export function AIChat({
  initialModels,
  viewerName,
}: {
  initialModels: string[];
  viewerName: string;
}) {
  const t = useTranslations("Assistant");
  const shouldReduceMotion = useReducedMotion();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialModels[0] ?? "Qwen3.6-27B");
  const [isStreaming, setIsStreaming] = useState(false);
  const [, startTransition] = useTransition();
  const messagesRef = useRef<HTMLDivElement>(null);
  const tabsViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load sessions on mount
  useEffect(() => {
    getSessionsAction()
      .then(setSessions)
      .catch(() => setSessionsError(true))
      .finally(() => setSessionsLoading(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length === 0) return;

    const container = messagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!currentSessionId) return;

    const viewport = tabsViewportRef.current;
    const activeTab = viewport?.querySelector<HTMLElement>(
      `[data-session-id="${CSS.escape(currentSessionId)}"]`,
    );

    if (!viewport || !activeTab) return;

    const viewportRect = viewport.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const overflowRight = tabRect.right - viewportRect.right;
    const overflowLeft = tabRect.left - viewportRect.left;

    if (overflowRight > 0) {
      viewport.scrollBy({
        left: overflowRight + 8,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    } else if (overflowLeft < 0) {
      viewport.scrollBy({
        left: overflowLeft - 8,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    }
  }, [currentSessionId, sessions, shouldReduceMotion]);

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
    setSessions((prev) => [...prev, session]);
    setCurrentSessionId(session.id);
    setMessages([]);
  }, [isStreaming, selectedModel]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const sessionIndex = sessions.findIndex((session) => session.id === sessionId);
    const previousSession = sessionIndex > 0 ? sessions[sessionIndex - 1] : null;

    await deleteSessionAction(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));

    if (currentSessionId === sessionId) {
      if (previousSession) {
        switchSession(previousSession.id);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  }, [currentSessionId, sessions, switchSession]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Ensure there's an active session
    let sessionId = currentSessionId;
    if (!sessionId) {
      const session = await createSessionAction(selectedModel);
      setSessions((prev) => [...prev, session]);
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

      const responseModel = res.headers.get("X-AI-Model") ?? selectedModel;
      if (responseModel !== selectedModel) setSelectedModel(responseModel);

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
                      ? { ...m, content: accumulated, model: responseModel }
                      : m,
                  ),
                );
              }
            } catch {
              // Skip malformed SSE chunks.
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
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMsgId ? { ...message, streaming: false } : message,
          ),
        );
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: t("messageError"), streaming: false }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [currentSessionId, isStreaming, selectedModel, t]);

  function stopStreaming() {
    abortRef.current?.abort();
  }

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center border-b bg-muted/30 px-2 sm:px-4">
        <div
          ref={tabsViewportRef}
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex h-9 w-max min-w-full items-center">
            <Tabs
              value={currentSessionId ?? HOME_TAB}
              onValueChange={(value) => {
                if (value === HOME_TAB) {
                  if (!isStreaming) {
                    setCurrentSessionId(null);
                    setMessages([]);
                  }
                  return;
                }

                if (typeof value === "string" && value !== currentSessionId) {
                  switchSession(value);
                }
              }}
              className="block shrink-0"
            >
              <TabsList
                aria-label={t("conversations")}
                className="h-9 w-max justify-start"
              >
                <TabsTrigger
                  value={HOME_TAB}
                  disabled={isStreaming}
                  className="h-7 flex-none px-3 text-xs"
                >
                  <House data-icon="inline-start" />
                  {t("home")}
                </TabsTrigger>
                {sessionsLoading ? (
                  <div role="presentation" className="flex items-center gap-2 px-2">
                    <Skeleton className="h-7 w-36 shrink-0" />
                    <Skeleton className="h-7 w-44 shrink-0" />
                  </div>
                ) : sessionsError ? null : (
                  sessions.map((session) => (
                    <SessionTab
                      key={session.id}
                      session={session}
                      disabled={isStreaming}
                    />
                  ))
                )}
              </TabsList>
            </Tabs>
            {sessionsError ? (
              <span role="alert" className="px-3 text-xs text-destructive">
                {t("sessionsError")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1 border-l pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={createNewSession}
            disabled={isStreaming}
            aria-label={t("newConversation")}
            title={t("newConversation")}
          >
            <MessageSquarePlus />
          </Button>
          {currentSessionId ? (
            <DeleteConversationButton
              key={currentSessionId}
              disabled={isStreaming}
              onDelete={() => handleDeleteSession(currentSessionId)}
            />
          ) : null}
        </div>
      </header>

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentSessionId ?? HOME_TAB}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.16,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {currentSessionId ? (
            <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 md:px-8">
              {messages.length === 0 ? (
                <EmptyState onPrompt={sendMessage} disabled={isStreaming} />
              ) : (
                <div
                  className="mx-auto flex w-full max-w-4xl flex-col gap-9 py-8 sm:py-12"
                  aria-live="polite"
                >
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 md:px-8">
              <OverviewHome
                conversationCount={sessions.length}
                disabled={isStreaming}
                modelCount={initialModels.length}
                onNewConversation={createNewSession}
                viewerName={viewerName}
              />
            </div>
          )}

          {currentSessionId ? (
            <div className="shrink-0 bg-background px-3 pb-3 pt-2 sm:px-5 sm:pb-5 md:px-8">
              <div className="mx-auto w-full max-w-4xl">
                <form onSubmit={handleSubmit}>
                  <InputGroup className="h-auto rounded-[1.5rem] border border-input bg-muted/50 shadow-[0_18px_50px_-32px_oklch(0.145_0_0_/_0.6)]">
                    <InputGroupTextarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("placeholder")}
                      rows={1}
                      disabled={isStreaming}
                      className="min-h-12 px-4 pt-3.5 text-sm leading-6 placeholder:text-muted-foreground/70"
                      style={{ maxHeight: "120px" }}
                    />
                    <InputGroupAddon align="block-end" className="justify-between px-3 pb-3 pt-1">
                      <ModelSelector
                        models={initialModels}
                        selected={selectedModel}
                        onChange={setSelectedModel}
                        disabled={isStreaming}
                      />
                      <div className="ml-auto flex items-center gap-2">
                        <span className="hidden text-[10px] font-normal text-muted-foreground/45 sm:inline">
                          {t("provider")}
                        </span>
                        {isStreaming ? (
                          <InputGroupButton
                            type="button"
                            variant="secondary"
                            size="icon-sm"
                            onClick={stopStreaming}
                            aria-label={t("stop")}
                            title={t("stop")}
                          >
                            <Square />
                          </InputGroupButton>
                        ) : (
                          <InputGroupButton
                            type="submit"
                            variant="default"
                            size="icon-sm"
                            disabled={!input.trim()}
                            aria-label={t("send")}
                            title={t("send")}
                          >
                            <ArrowUp />
                          </InputGroupButton>
                        )}
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                </form>
                <p className="mt-2 px-3 text-center text-[11px] text-muted-foreground/50">
                  {t("disclaimer")}
                </p>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
