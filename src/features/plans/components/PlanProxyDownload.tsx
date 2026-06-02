"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Plan, ProxyListData } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Creates a temporary anchor and clicks it to trigger a browser file download
function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PlanProxyDownload({ plan }: Readonly<{ plan: Plan }>) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/plans/${plan.plan_id}/proxies`);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Failed to fetch proxy list.");
        return;
      }

      const raw = await res.json();
      // The proxy route passes through the FlashProxy response envelope unchanged,
      // so the actual payload is under .data (unlike flashproxyFetch which unwraps it)
      const data: ProxyListData = raw.data ?? raw;

      if (!data.proxies?.length) {
        toast.info("No proxies available for this plan.");
        return;
      }

      // ProxyItem.full is already formatted as host:port:user:pass
      const content = data.proxies.map((p) => p.full).join("\n");
      const filename = `proxies-${plan.plan_id.slice(0, 8)}.txt`;
      triggerDownload(content, filename);
      toast.success(
        `Downloaded ${data.proxies.length} ${data.proxies.length === 1 ? "proxy" : "proxies"}.`,
      );
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proxy List</CardTitle>
        <CardDescription>
          Download all proxy addresses as a <code>.txt</code> file — one{" "}
          <code>host:port:user:pass</code> per line.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {loading ? "Fetching proxies…" : "Download proxies"}
        </Button>
      </CardContent>
    </Card>
  );
}
