"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Plan } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./CopyButton";

interface CredentialRowProps {
  label: string;
  value: string;
}

function CredentialRow({ label, value }: CredentialRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground w-28 shrink-0 text-sm">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

interface Props {
  plan: Plan;
}

export function PlanCredentials({ plan }: Props) {
  const [showPassword, setShowPassword] = useState(false);

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

        {/* Password row — with show/hide toggle */}
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
      </CardContent>
    </Card>
  );
}
