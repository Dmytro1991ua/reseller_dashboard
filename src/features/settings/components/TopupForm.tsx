"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [10, 25, 50, 100];

export function TopupForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTopup(cents: number) {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/balance/topup/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Top-up failed.");
        return;
      }
      toast.success(
        `Added ${json.data?.added_formatted ?? `$${(cents / 100).toFixed(2)}`} to balance.`,
      );
      setAmount("");
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Math.round(parseFloat(amount) * 100);
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid dollar amount.");
      return;
    }
    handleTopup(parsed);
  }

  return (
    <div className="space-y-4">
      {/* Quick preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((d) => (
          <Button
            key={d}
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleTopup(d * 100)}
          >
            +${d}
          </Button>
        ))}
      </div>

      {/* Custom amount */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            $
          </span>
          <Input
            type="number"
            min="1"
            step="0.01"
            placeholder="0.00"
            className="pl-7"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !amount}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Add funds
        </Button>
      </form>

      <p className="text-muted-foreground text-xs">
        Funds are added instantly. This is a local admin operation — no payment processing.
      </p>
    </div>
  );
}
