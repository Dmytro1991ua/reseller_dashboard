import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CreatePlanForm } from "@/features/plans/components/CreatePlanForm";

export const metadata: Metadata = { title: "New Plan" };

export default function NewPlanPage() {
  return (
    <>
      <div className="space-y-1">
        <Link
          href="/plans"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to Plans
        </Link>
        <h1 className="text-2xl font-bold">New Plan</h1>
        <p className="text-muted-foreground text-sm">
          Select a product and configure your plan. You&apos;ll see the exact cost before
          confirming.
        </p>
      </div>

      <CreatePlanForm />
    </>
  );
}
