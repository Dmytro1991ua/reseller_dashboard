"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartPoint {
  date: string; // pre-formatted label, e.g. "Jun 1"
  gb: number;
}

interface UsageChartProps {
  points: ChartPoint[];
  total: string; // e.g. "5 GB"
}

export function UsageChart({ points, total }: Readonly<UsageChartProps>) {
  const hasData = points.some((p) => p.gb > 0);

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Bandwidth Usage</CardTitle>
        <span className="text-muted-foreground text-sm">{total} · last 30 days</span>
      </CardHeader>
      <CardContent className="pt-2">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={points} margin={{ top: 6, right: 4, left: -16, bottom: 8 }}>
              <defs>
                <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.65} />
                  <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
                strokeOpacity={0.6}
              />

              {/* preserveStartEnd guarantees the last date label (today) is always shown */}
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
                padding={{ left: 8, right: 8 }}
              />

              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v} GB`}
                width={56}
              />

              <Tooltip
                formatter={(value) => [`${(value as number).toFixed(2)} GB`, "Bandwidth"]}
                contentStyle={{
                  fontSize: 12,
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  boxShadow: "0 2px 8px hsl(var(--foreground) / 0.08)",
                  color: "hsl(var(--foreground))",
                  padding: "6px 10px",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                cursor={{ stroke: "#3b82f6", strokeWidth: 1, strokeDasharray: "4 2" }}
              />

              <Area
                type="monotone"
                dataKey="gb"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#usageGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-50 items-center justify-center">
            <p className="text-muted-foreground text-sm">No usage data for this period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
