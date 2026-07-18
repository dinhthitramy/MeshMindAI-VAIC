"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

import { getLangfuseLogsAction, type LangfuseTrace, type LangfuseGeneration } from "../actions";

type Tab = "traces" | "generations";

function StatusBadge({ level }: { level: string }) {
  const isError = level === "ERROR";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {isError ? <XCircle size={10} /> : <CheckCircle size={10} />}
      {isError ? "ERROR" : "OK"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3.5">
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
      <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function TraceRow({ trace }: { trace: LangfuseTrace }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(trace.timestamp).toLocaleTimeString();
  const date = new Date(trace.timestamp).toLocaleDateString();

  return (
    <motion.div layout className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {date} {time}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {trace.name ?? "—"}
        </span>
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {trace.userId ?? "anonymous"}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4 bg-muted/20 px-4 py-4">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
                <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                  {JSON.stringify(trace.input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Output</p>
                <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                  {JSON.stringify(trace.output, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GenerationRow({ gen }: { gen: LangfuseGeneration }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(gen.startTime).toLocaleTimeString();
  const date = new Date(gen.startTime).toLocaleDateString();
  const totalTokens = gen.usage?.total ?? (gen.usage?.input ?? 0) + (gen.usage?.output ?? 0);

  return (
    <motion.div layout className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {date} {time}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {gen.model ?? "—"}
        </span>
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {gen.name ?? "generation"}
        </span>
        {totalTokens > 0 && (
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Clock size={10} />
            {totalTokens} tok
          </span>
        )}
        <StatusBadge level={gen.level} />
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4 bg-muted/20 px-4 py-4">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
                <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                  {JSON.stringify(gen.input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Output</p>
                <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                  {JSON.stringify(gen.output, null, 2)}
                </pre>
              </div>
            </div>
            {gen.statusMessage && (
              <p className="border-t border-border bg-destructive/5 px-4 py-2 font-mono text-xs text-destructive">
                {gen.statusMessage}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function LangfuseLogs() {
  const [activeTab, setActiveTab] = useState<Tab>("generations");
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [generations, setGenerations] = useState<LangfuseGeneration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getLangfuseLogsAction(30);
      setTraces(result.traces);
      setGenerations(result.generations);
      setError(result.error);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "generations", label: "Generations", count: generations.length },
    { id: "traces", label: "Traces", count: traces.length },
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar + refresh */}
      <div className="flex items-center justify-between border-b border-border px-4">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-mono">
                {tab.count}
              </span>
              {activeTab === tab.id && (
                <motion.span
                  layoutId="admin-log-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <motion.span
            animate={{ rotate: isPending ? 360 : 0 }}
            transition={{ duration: 0.6, repeat: isPending ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw size={12} />
          </motion.span>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="min-h-[400px]">
        {isPending ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : activeTab === "generations" ? (
          generations.length === 0 ? (
            <div className="flex flex-col items-start gap-2 px-4 py-12">
              <p className="text-sm font-medium">No generations yet</p>
              <p className="text-xs text-muted-foreground">
                Send a message in AI Assistant to see logs appear here.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {generations.map((gen) => (
                <GenerationRow key={gen.id} gen={gen} />
              ))}
            </AnimatePresence>
          )
        ) : traces.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-4 py-12">
            <p className="text-sm font-medium">No traces yet</p>
            <p className="text-xs text-muted-foreground">
              Traces will appear after AI calls are made.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {traces.map((trace) => (
              <TraceRow key={trace.id} trace={trace} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
