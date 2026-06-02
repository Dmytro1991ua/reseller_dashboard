"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
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

    toast.success("Plan cancelled.");
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
  const [cancelOpen, setCancelOpen] = useState(false);

  const canCancel = CANCELLABLE_STATUSES.has(plan.status);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Extend — step 4 */}

        {canCancel && (
          <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
            <Trash2 className="size-4" />
            Cancel plan
          </Button>
        )}
      </div>

      <CancelDialog plan={plan} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}
