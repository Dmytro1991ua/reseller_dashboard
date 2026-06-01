import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 max-w-xs flex-1" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ml-auto h-9 w-32" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex gap-4 border-b pb-2">
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
                <Skeleton className="ml-auto h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
