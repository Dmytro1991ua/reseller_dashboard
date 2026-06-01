import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32 ml-auto" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex gap-4 pb-2 border-b">
              {[140, 100, 80, 80, 90, 60].map((w, i) => (
                <Skeleton key={i} className={`h-4 w-[${w}px]`} />
              ))}
            </div>
            {/* Data rows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-22" />
                <Skeleton className="h-8 w-8 rounded ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
