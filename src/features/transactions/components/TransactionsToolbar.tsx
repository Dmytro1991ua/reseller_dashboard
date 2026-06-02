"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "topup", label: "Top-up" },
  { value: "purchase", label: "Purchase" },
  { value: "plan_creation", label: "Plan creation" },
  { value: "plan_extension", label: "Plan extension" },
  { value: "extend", label: "Extend" },
  { value: "refund", label: "Refund" },
  { value: "manual_refund", label: "Manual refund" },
  { value: "adjustment", label: "Adjustment" },
  { value: "allocation_usage", label: "Usage" },
  { value: "admin_credit", label: "Admin credit" },
  { value: "admin_debit", label: "Admin debit" },
  { value: "admin_adjustment", label: "Admin adjustment" },
];

export function TransactionsToolbar({ total }: Readonly<{ total: number }>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function handleType(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("type", value);
    else params.delete("type");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={searchParams.get("type") ?? "all"} onValueChange={handleType}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground ml-auto text-sm tabular-nums">
        {total} transaction{total === 1 ? "" : "s"}
      </span>
    </div>
  );
}
