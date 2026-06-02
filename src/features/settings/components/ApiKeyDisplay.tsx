"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/features/plans/components/CopyButton";

// ─── API key card ─────────────────────────────────────────────────────────────

export function ApiKeyDisplay({ apiKey }: Readonly<{ apiKey: string }>) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          readOnly
          value={showKey ? apiKey : "•".repeat(Math.min(apiKey.length, 48))}
          className="pr-20 font-mono text-sm"
          aria-label="API key"
        />
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <CopyButton value={apiKey} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Never stored on disk — lives only in an encrypted session cookie. Log out and log back in to
        use a different key.
      </p>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

export function LogOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to log out. Please try again.");
      setPending(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleLogout} disabled={pending}>
      <LogOut className="size-4" />
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
