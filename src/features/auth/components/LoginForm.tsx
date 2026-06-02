"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  apiKey: z
    .string()
    .min(1, "API key is required.")
    .refine(
      (val) => val.startsWith("fp_live_") || val.startsWith("fp_test_"),
      "Key must start with fp_live_ or fp_test_.",
    ),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { apiKey: "" },
  });

  const apiKeyValue = watch("apiKey");

  async function onSubmit(data: LoginFormData) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: data.apiKey }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error ?? "Login failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <div className="relative">
          <Input
            {...register("apiKey")}
            id="apiKey"
            type={showKey ? "text" : "password"}
            placeholder="fp_live_..."
            className="pr-10 font-mono text-sm"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            tabIndex={-1}
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.apiKey && <p className="text-destructive text-xs">{errors.apiKey.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || !apiKeyValue?.trim()}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {isSubmitting ? "Verifying…" : "Sign in"}
      </Button>

      <p className="text-muted-foreground text-xs">
        Your key starts with <code className="font-mono">fp_live_</code> or{" "}
        <code className="font-mono">fp_test_</code>. It is never stored on disk — only in an
        encrypted session cookie.
      </p>
    </form>
  );
}
