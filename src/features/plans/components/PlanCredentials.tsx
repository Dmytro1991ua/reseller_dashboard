"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { Plan } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./CopyButton";

// ─── schemas ──────────────────────────────────────────────────────────────────

const passwordSchema = z.object({
  new_password: z.string().min(6, "Password must be at least 6 characters."),
});
type PasswordFormData = z.infer<typeof passwordSchema>;

const addIpSchema = z.object({
  ip: z
    .string()
    .min(1, "IP address is required.")
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter a valid IPv4 address."),
});
type AddIpFormData = z.infer<typeof addIpSchema>;

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

interface AllowedIpsEditorProps {
  planId: string;
  initialIps: string[];
  onSaved: () => void;
  onCancel: () => void;
}

function AllowedIpsEditor({
  planId,
  initialIps,
  onSaved,
  onCancel,
}: Readonly<AllowedIpsEditorProps>) {
  const [ips, setIps] = useState<string[]>(initialIps);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<AddIpFormData>({
    resolver: zodResolver(addIpSchema),
    defaultValues: { ip: "" },
  });

  function addIp(data: AddIpFormData) {
    setIps((prev) => [...new Set([...prev, data.ip.trim()])]);
    reset();
  }

  function removeIp(ip: string) {
    setIps((prev) => prev.filter((i) => i !== ip));
  }

  async function saveIps() {
    const pending = getValues("ip").trim();

    if (pending) {
      // Something typed — validate and flush into the list first
      const valid = await trigger("ip");
      if (!valid) return;
      setIps((prev) => [...new Set([...prev, pending])]);
      reset();
    } else if (ips.length === 0) {
      // Nothing typed and list is empty — surface the required error
      await trigger("ip");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/proxy/plans/${planId}/allowed-ips`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed_ips: ips }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Failed to update allowed IPs.");
        return;
      }

      toast.success("Allowed IPs updated.");
      onSaved();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Current IPs with remove buttons */}
      {ips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {ips.map((ip) => (
            <span
              key={ip}
              className="bg-muted flex items-center gap-1 rounded px-2 py-1 font-mono text-xs"
            >
              {ip}
              <button
                type="button"
                onClick={() => removeIp(ip)}
                className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
                aria-label={`Remove ${ip}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No IPs — all connections will be allowed.</p>
      )}

      {/* Add IP input */}
      <form onSubmit={handleSubmit(addIp)} className="flex gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            {...register("ip")}
            placeholder="Enter IP address"
            className="font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {errors.ip && <p className="text-destructive text-xs">{errors.ip.message}</p>}
        </div>
        <Button type="submit" variant="outline" size="sm" className="shrink-0">
          Add
        </Button>
      </form>

      {/* Save / Cancel */}
      <div className="flex gap-2">
        <Button size="sm" onClick={saveIps} disabled={saving}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function PlanCredentials({ plan }: Readonly<{ plan: Plan }>) {
  const router = useRouter();

  // UI-only toggles
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [editingIps, setEditingIps] = useState(false);

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
          <p className="text-muted-foreground mb-2 p-2 text-xs">Full format</p>
          <div className="bg-muted flex items-center gap-3 rounded-md px-1.5 py-3">
            <code className="min-w-0 flex-1 font-mono text-xs break-all">
              {plan.connection.format}
            </code>
            <CopyButton value={plan.connection.format} />
          </div>
        </div>

        {/* Allowed IPs */}
        <div className="pt-4 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-muted-foreground text-xs">Allowed IPs (whitelist)</p>
            {!editingIps && (
              <button
                type="button"
                onClick={() => setEditingIps(true)}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editingIps ? (
            <AllowedIpsEditor
              planId={plan.plan_id}
              initialIps={plan.allowed_ips ?? []}
              onSaved={() => {
                setEditingIps(false);
                router.refresh();
              }}
              onCancel={() => setEditingIps(false)}
            />
          ) : (
            <>
              {plan.allowed_ips && plan.allowed_ips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {plan.allowed_ips.map((ip) => (
                    <span key={ip} className="bg-muted rounded px-2 py-1 font-mono text-xs">
                      {ip}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">None set — all connections allowed.</p>
              )}
            </>
          )}
        </div>

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
