"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Plan } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// ─── extend dialog ────────────────────────────────────────────────────────────

// Only these statuses make sense to extend (expired included — it renews the plan)
const EXTENDABLE_STATUSES = new Set(["active", "pending", "provisioning", "inactive", "expired"]);

// z.number() rejects NaN (RHF sends NaN for an empty number input via valueAsNumber).
// This keeps the input type as `number`, matching ExtendFormData exactly.
const extendSchema = z.object({
  amount: z
    .number({ error: "Enter a whole number." })
    .int("Must be a whole number.")
    .min(1, "Must add at least 1."),
});
type ExtendFormData = z.infer<typeof extendSchema>;

interface ExtendDialogProps {
  plan: Plan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ExtendDialog({ plan, open, onOpenChange }: Readonly<ExtendDialogProps>) {
  const router = useRouter();

  // One idempotency key per dialog open session.
  // If the request fails (network error) and the user retries without closing,
  // the same key is reused so FlashProxy deduplicates and won't double-charge.
  // dedicated_isp has billing_type "per_ip" and extends by exactly 30 days (no configurable amount)
  // unlimited_residential is not extendable at all per API spec
  const isDedicatedIsp = plan.billing_type === "per_ip";
  const isBandwidth = plan.billing_type === "bandwidth";
  // price_per_gb is in cents — present on bandwidth plans from the billing object
  const pricePerGbCents = plan.billing?.price_per_gb ?? null;

  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isValid, isSubmitting, errors },
  } = useForm<ExtendFormData>({
    resolver: zodResolver(extendSchema),
    // NaN renders as an empty input (browser ignores NaN for number inputs),
    // and z.number() rejects NaN so the button stays disabled until the user types.
    defaultValues: { amount: Number.NaN },
    mode: "onChange",
  });

  // Generate a fresh idempotency key on each open.
  // dedicated_isp always extends 30 days — pre-fill so the form passes validation.
  useEffect(() => {
    if (!open) return;
    idempotencyKeyRef.current = crypto.randomUUID();
    if (isDedicatedIsp) setValue("amount", 30, { shouldValidate: true });
  }, [open, isDedicatedIsp, setValue]);

  // Live cost preview — valueAsNumber means watch() already returns a number (or NaN when empty)
  const amount = watch("amount");
  const estimatedCents =
    isBandwidth && pricePerGbCents && !Number.isNaN(amount) && amount > 0
      ? amount * pricePerGbCents
      : null;

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(data: ExtendFormData) {
    let body: Record<string, unknown>;
    if (isDedicatedIsp) {
      body = { extend_30_days: true };
    } else if (isBandwidth) {
      body = { add_bandwidth_gb: data.amount };
    } else {
      body = { add_days: data.amount };
    }

    const res = await fetch(`/api/proxy/plans/${plan.plan_id}/extend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKeyRef.current ? { "X-Idempotency-Key": idempotencyKeyRef.current } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? "Failed to extend plan.");
      return;
    }

    let successMsg: string;
    if (isDedicatedIsp) {
      successMsg = "Plan extended by 30 days.";
    } else if (isBandwidth) {
      successMsg = `Added ${data.amount} GB to plan.`;
    } else {
      successMsg = `Extended plan by ${data.amount} days.`;
    }
    toast.success(successMsg);
    onOpenChange(false);
    router.refresh();
  }

  const inputLabel = isBandwidth ? "GB to add" : "Days to add";
  const inputUnit = isBandwidth ? "GB" : "days";

  let submitLabel = "Extend plan";
  if (isDedicatedIsp) submitLabel = "Extend 30 days";
  else if (estimatedCents !== null) submitLabel = `Confirm — charge ${formatCents(estimatedCents)}`;

  let extendDescription =
    "Extend this plan's active period. The cost will be charged from your balance.";
  if (isDedicatedIsp)
    extendDescription = `Extend all ${plan.quantity ?? ""} IPs for 30 days. The cost will be charged from your balance.`;
  else if (isBandwidth)
    extendDescription =
      "Add more bandwidth to this plan. The cost will be charged from your balance.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend plan</DialogTitle>
          <DialogDescription>{extendDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* dedicated_isp always extends 30 days — no amount input needed */}
          {isDedicatedIsp ? (
            <p className="text-muted-foreground text-sm">
              Duration: <span className="text-foreground font-medium">30 days</span> (fixed)
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">{inputLabel}</p>
              <div className="flex items-center gap-2">
                <Input
                  {...register("amount", { valueAsNumber: true })}
                  type="number"
                  min={1}
                  step={1}
                  placeholder={isBandwidth ? "e.g. 10" : "e.g. 30"}
                  className="w-36"
                  autoFocus
                />
                <span className="text-muted-foreground text-sm">{inputUnit}</span>
              </div>
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
          )}

          {/* Quick shortcut for time-billed plans */}
          {!isBandwidth && !isDedicatedIsp && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue("amount", 30, { shouldValidate: true })}
            >
              + 30 days
            </Button>
          )}

          {/* Inline cost estimate for bandwidth plans when price_per_gb is known */}
          {isBandwidth && estimatedCents !== null && (
            <p className="text-muted-foreground text-sm">
              Estimated cost:{" "}
              <span className="text-foreground font-medium">{formatCents(estimatedCents)}</span>
            </p>
          )}
          {/* Fallback when price_per_gb is absent — we can't estimate client-side */}
          {isBandwidth && pricePerGbCents === null && (
            <p className="text-muted-foreground text-xs">
              Cost will be deducted from your balance at current rates.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Extending…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── cancel dialog ────────────────────────────────────────────────────────────

const CANCELLABLE_STATUSES = new Set(["active", "pending", "provisioning", "inactive"]);

interface CancelDialogProps {
  plan: Plan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CancelDialog({ plan, open, onOpenChange }: Readonly<CancelDialogProps>) {
  const router = useRouter();
  const expectedId = plan.plan_id.slice(0, 8);

  const cancelSchema = z.object({
    confirm: z.string().refine((v) => v === expectedId, `Must match "${expectedId}" to confirm.`),
  });
  type CancelFormData = z.infer<typeof cancelSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting },
  } = useForm<CancelFormData>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { confirm: "" },
    mode: "onChange",
  });

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit() {
    const res = await fetch(`/api/proxy/plans/${plan.plan_id}`, { method: "DELETE" });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? "Failed to cancel plan.");
      return;
    }

    const json = (await res.json().catch(() => ({}))) as {
      data?: { refund_cents?: number; refund_formatted?: string };
    };
    const refundCents = json?.data?.refund_cents ?? 0;
    const refundFormatted = json?.data?.refund_formatted;
    if (refundCents > 0 && refundFormatted) {
      toast.success("Plan cancelled. " + refundFormatted + " refunded to your balance.");
    } else {
      toast.success("Plan cancelled.");
    }
    onOpenChange(false);
    router.push("/plans");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancel this plan?</DialogTitle>
          <DialogDescription>
            This is irreversible. The plan will be cancelled immediately and cannot be restored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-1 text-sm">
          <p className="text-muted-foreground">
            Plan: <span className="text-foreground font-medium">{plan.plan_id}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-sm">
            Type <code className="bg-muted rounded px-1 font-mono font-medium">{expectedId}</code>{" "}
            to confirm.
          </p>
          <Input
            {...register("confirm")}
            placeholder={expectedId}
            className="font-mono"
            autoComplete="off"
            autoFocus
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Keep plan
            </Button>
            <Button type="submit" variant="destructive" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Cancelling…" : "Yes, cancel this plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── exported component ───────────────────────────────────────────────────────

export function PlanActions({ plan }: Readonly<{ plan: Plan }>) {
  const [extendOpen, setExtendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const canExtend =
    EXTENDABLE_STATUSES.has(plan.status) && plan.product !== "unlimited_residential";
  const canCancel = CANCELLABLE_STATUSES.has(plan.status);

  return (
    <>
      <div className="flex items-center gap-2">
        {canExtend && (
          <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)}>
            <RefreshCw className="size-4" />
            Extend plan
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
            <Trash2 className="size-4" />
            Cancel plan
          </Button>
        )}
      </div>

      <ExtendDialog plan={plan} open={extendOpen} onOpenChange={setExtendOpen} />
      <CancelDialog plan={plan} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}
