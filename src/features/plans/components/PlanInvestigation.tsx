"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Investigation, InvestigationDiagnosis } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type SeverityIcon = typeof Info;
const SEVERITY_ICON: Record<string, SeverityIcon> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
};

function severityIconClass(severity: string) {
  if (severity === "warning") return "text-amber-500";
  if (severity === "critical") return "text-red-500";
  return "text-blue-500";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── diagnosis content ────────────────────────────────────────────────────────

function DiagnosisContent({
  diagnosis,
  cost,
}: Readonly<{ diagnosis: InvestigationDiagnosis; cost: string }>) {
  const SeverityIcon = SEVERITY_ICON[diagnosis.severity] ?? Info;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <SeverityIcon className={cn("size-4", severityIconClass(diagnosis.severity))} />
        <span
          className={cn(
            "inline-flex rounded px-1.5 py-0.5 text-xs font-medium capitalize",
            SEVERITY_BADGE[diagnosis.severity] ?? SEVERITY_BADGE.info,
          )}
        >
          {diagnosis.severity}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">Cost: {cost}</span>
      </div>

      <p className="text-base leading-snug font-semibold">{diagnosis.headline}</p>

      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
          Root cause
        </p>
        <p className="text-muted-foreground">{diagnosis.root_cause}</p>
      </div>

      {diagnosis.evidence.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Evidence
          </p>
          <div className="space-y-1.5">
            {diagnosis.evidence.map((ev, i) => (
              <div
                key={i}
                className="bg-muted/50 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground font-medium">{ev.metric}</span>
                <span className="font-semibold">{ev.value}</span>
                <span className="text-muted-foreground col-span-2">{ev.context}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
          Recommendation for customer
        </p>
        <p className="text-muted-foreground">{diagnosis.recommendation_to_customer}</p>
      </div>

      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
          Internal notes
        </p>
        <p className="text-muted-foreground">{diagnosis.recommendation_to_staff}</p>
      </div>
    </div>
  );
}

// ─── past investigation row ───────────────────────────────────────────────────

function PastInvestigationRow({ investigation }: Readonly<{ investigation: Investigation }>) {
  const [expanded, setExpanded] = useState(false);
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {investigation.severity && (
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.5 text-xs font-medium capitalize",
              SEVERITY_BADGE[investigation.severity],
            )}
          >
            {investigation.severity}
          </span>
        )}
        <span className="flex-1 truncate font-medium">
          {investigation.headline ?? investigation.status}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {formatDate(investigation.created_at)}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">{investigation.cost}</span>
        {investigation.refunded && (
          <span className="shrink-0 text-xs text-green-600 dark:text-green-400">Refunded</span>
        )}
        <ChevronIcon className="text-muted-foreground size-4 shrink-0" />
      </button>

      {expanded && investigation.diagnosis && (
        <div className="border-t px-4 pt-3 pb-4">
          <DiagnosisContent diagnosis={investigation.diagnosis} cost={investigation.cost} />
        </div>
      )}
    </div>
  );
}

async function fetchInvestigationStatus(
  planId: string,
  investigationId: string,
): Promise<Investigation | null> {
  const res = await fetch(`/api/proxy/investigate/${planId}/${investigationId}`).catch(() => null);
  if (!res?.ok) return null;
  const raw = (await res.json()) as Record<string, unknown>;
  return (raw.data ?? raw) as Investigation;
}

// ─── main component ───────────────────────────────────────────────────────────

export function PlanInvestigation({ planId }: Readonly<{ planId: string }>) {
  const [complaint, setComplaint] = useState("");
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState<Investigation | null>(null);
  const [past, setPast] = useState<Investigation[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  // Incrementing this triggers a re-fetch of the history list
  const [historyVersion, setHistoryVersion] = useState(0);

  // Fetch history — setState in .then() callbacks is the approved pattern
  useEffect(() => {
    let alive = true;
    fetch(`/api/proxy/investigate/${planId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: Record<string, unknown> | null) => {
        if (!alive) return;
        const data = (raw?.data ?? raw) as { investigations?: Investigation[] } | null;
        setPast(data?.investigations ?? []);
        setLoadingPast(false);
      })
      .catch(() => {
        if (alive) setLoadingPast(false);
      });
    return () => {
      alive = false;
    };
  }, [planId, historyVersion]);

  // Poll the active investigation every 10 seconds until it reaches a terminal state
  const activeId = active?.investigation_id;
  useEffect(() => {
    if (!activeId) return;

    const interval = setInterval(() => {
      fetchInvestigationStatus(planId, activeId)
        .then((updated) => {
          if (!updated) return;
          setActive(updated);
          if (updated.status === "complete" || updated.status === "error") {
            clearInterval(interval);
            setHistoryVersion((v) => v + 1);
          }
        })
        .catch(() => undefined);
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeId, planId]);

  async function handleStart() {
    setStarting(true);

    const res = await fetch(`/api/proxy/investigate/${planId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaint: complaint.trim() }),
    }).catch(() => null);

    setStarting(false);

    if (!res?.ok) {
      const json = (await res?.json().catch(() => ({}))) as Record<string, { message?: string }>;
      toast.error(json?.error?.message ?? "Failed to start investigation.");
      return;
    }

    const raw = (await res.json()) as Record<string, unknown>;
    setActive((raw.data ?? raw) as Investigation);
    setComplaint("");
  }

  const isPolling = !!active && (active.status === "running" || active.status === "pending");

  return (
    <div className="space-y-6">
      {/* New investigation form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Investigation</CardTitle>
          <p className="text-muted-foreground text-sm">
            Describe a customer complaint and AI will query real-time monitoring data to produce a
            structured diagnosis.{" "}
            <span className="text-foreground font-medium">$0.50 per investigation</span>, refunded
            on failure.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="e.g. Customer reports 403 errors on target site since yesterday"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{complaint.length}/400</span>
            <Button
              size="sm"
              onClick={handleStart}
              disabled={complaint.trim().length === 0 || starting || isPolling}
            >
              {starting && <Loader2 className="size-4 animate-spin" />}
              {starting ? "Starting…" : "Start investigation — $0.50"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* In-progress */}
      {isPolling && (
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <Loader2 className="size-5 shrink-0 animate-spin text-blue-500" />
            <div>
              <p className="text-sm font-medium">Investigation in progress</p>
              <p className="text-muted-foreground text-xs">
                {active.elapsed_seconds != null ? `${active.elapsed_seconds}s elapsed · ` : ""}
                Typically 60–180 seconds
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete */}
      {active?.status === "complete" && active.diagnosis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Latest investigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiagnosisContent diagnosis={active.diagnosis} cost={active.cost} />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {active?.status === "error" && (
        <Card className="border-destructive/40">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Investigation failed
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {active.error ?? "Unknown error"} · Charge refunded.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {!loadingPast && past.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Past investigations</p>
          {past.map((inv) => (
            <PastInvestigationRow key={inv.investigation_id} investigation={inv} />
          ))}
        </div>
      )}
    </div>
  );
}
