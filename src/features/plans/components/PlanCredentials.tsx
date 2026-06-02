"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Plan } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./CopyButton";

// ─── schema ───────────────────────────────────────────────────────────────────

const passwordSchema = z.object({
  new_password: z.string().min(6, "Password must be at least 6 characters."),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

// ─── sub-components ───────────────────────────────────────────────────────────

function CredentialRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground w-28 shrink-0 text-sm">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function PlanCredentials({ plan }: Readonly<{ plan: Plan }>) {
  const router = useRouter();

  // UI-only toggles — not form data, so useState is correct here
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: "" },
  });

  async function onSubmit(data: PasswordFormData) {
    const res = await fetch(`/api/proxy/plans/${plan.plan_id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: data.new_password }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? "Failed to update password.");
      return;
    }

    toast.success("Password updated successfully.");
    cancelPasswordChange();
    router.refresh();
  }

  function cancelPasswordChange() {
    reset();
    setChangingPassword(false);
    setShowNewPassword(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proxy Credentials</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <CredentialRow label="Hostname" value={plan.connection.hostname} />
        <CredentialRow label="HTTP Port" value={String(plan.connection.port_http)} />
        {plan.connection.port_socks != null && (
          <CredentialRow label="SOCKS Port" value={String(plan.connection.port_socks)} />
        )}
        <CredentialRow label="Username" value={plan.proxy_username} />

        {/* Password — show/hide + copy */}
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-muted-foreground w-28 shrink-0 text-sm">Password</span>
          <span className="min-w-0 flex-1 truncate font-mono text-sm">
            {showPassword
              ? plan.proxy_password
              : "•".repeat(Math.min(plan.proxy_password.length, 16))}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <CopyButton value={plan.proxy_password} />
          </div>
        </div>

        {/* Full connection string */}
        <div className="pt-4 pb-2">
          <p className="text-muted-foreground mb-2 text-xs">Full format</p>
          <div className="bg-muted flex items-center gap-3 rounded-md p-3">
            <code className="min-w-0 flex-1 font-mono text-xs break-all">
              {plan.connection.format}
            </code>
            <CopyButton value={plan.connection.format} />
          </div>
        </div>

        {/* Allowed IPs */}
        {plan.allowed_ips && plan.allowed_ips.length > 0 && (
          <div className="pt-4 pb-2">
            <p className="text-muted-foreground mb-2 text-xs">Allowed IPs (whitelist)</p>
            <div className="flex flex-wrap gap-2">
              {plan.allowed_ips.map((ip) => (
                <span key={ip} className="bg-muted rounded px-2 py-1 font-mono text-xs">
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Change password */}
        <div className="pt-4 pb-1">
          {!changingPassword ? (
            <button
              type="button"
              onClick={() => setChangingPassword(true)}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
            >
              Change password
            </button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <p className="text-sm font-medium">New password</p>
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    {...register("new_password")}
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    className="pr-10 font-mono text-sm"
                    autoFocus
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                    tabIndex={-1}
                    aria-label={showNewPassword ? "Hide" : "Show"}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-destructive text-xs">{errors.new_password.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                  {isSubmitting ? "Updating…" : "Update password"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelPasswordChange}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
