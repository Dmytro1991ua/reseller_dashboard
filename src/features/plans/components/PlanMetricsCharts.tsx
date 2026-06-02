"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import type { LatencyData, ThroughputData } from "@/types/api";
import { MOCK_LATENCY, MOCK_THROUGHPUT } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HOURS = 24;

// Format ISO bucket timestamp as HH:MM for the X axis
function formatBucket(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Proxy route passes through the FlashProxy envelope unchanged — unwrap if present
async function fetchMetric<T>(planId: string, metric: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/proxy/plans/${planId}/metrics/${metric}?hours=${HOURS}`);
    if (!res.ok) return null;
    const raw = await res.json();
    return (raw.data ?? raw) as T;
  } catch {
    return null;
  }
}

// ─── throughput chart ─────────────────────────────────────────────────────────

function ThroughputChart({ data }: Readonly<{ data: ThroughputData }>) {
  const points = data.series.map((p) => ({
    t: formatBucket(p.bucket),
    mbps: Number(p.mbps.toFixed(2)),
    cap: Number(p.rate_cap_mbps.toFixed(2)),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">Throughput</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={80}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}`}
              unit=" Mbps"
              width={64}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Solid blue line for actual throughput */}
            <Line
              type="monotone"
              dataKey="mbps"
              name="Throughput (Mbps)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            {/* Dashed red line shows the rate cap as context */}
            <Line
              type="monotone"
              dataKey="cap"
              name="Cap (Mbps)"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── latency chart ────────────────────────────────────────────────────────────

function LatencyChart({ data }: Readonly<{ data: LatencyData }>) {
  const points = data.series.map((p) => ({
    t: formatBucket(p.bucket),
    p50: p.p50,
    p95: p.p95,
    p99: p.p99,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">Latency</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={80}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              unit=" ms"
              width={56}
            />
            <Tooltip
              formatter={(value) => [`${value as number} ms`]}
              contentStyle={{
                fontSize: 12,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="p50"
              name="P50"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="p95"
              name="P95"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="p99"
              name="P99"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── exported component ───────────────────────────────────────────────────────

interface ChartsState {
  throughput: ThroughputData | null;
  latency: LatencyData | null;
  loading: boolean;
}

export function PlanMetricsCharts({ planId }: Readonly<{ planId: string }>) {
  const [state, setState] = useState<ChartsState>({
    throughput: null,
    latency: null,
    loading: true,
  });

  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    Promise.all([
      fetchMetric<ThroughputData>(planId, "throughput"),
      fetchMetric<LatencyData>(planId, "latency"),
    ]).then(([throughput, latency]) => {
      setState({
        throughput: throughput ?? (isDev ? MOCK_THROUGHPUT : null),
        latency: latency ?? (isDev ? MOCK_LATENCY : null),
        loading: false,
      });
    });
  }, [planId]);

  if (state.loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading charts…
      </div>
    );
  }

  // If both endpoints returned no data, show a subtle message rather than nothing
  // so it's clear the section exists but has no data (common in dev with mock plan IDs)
  if (!state.throughput && !state.latency) {
    return (
      <p className="text-muted-foreground text-sm">
        No time-series data available for the last {HOURS} hours.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.throughput && <ThroughputChart data={state.throughput} />}
      {state.latency && <LatencyChart data={state.latency} />}
    </div>
  );
}
