import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </div>
          <span className="font-semibold">FlashProxy</span>
        </div>
        <CardTitle className="text-2xl">Reseller Dashboard</CardTitle>
        <CardDescription>
          Enter your FlashProxy API key to access your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* LoginForm goes here — wired in auth step */}
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <p className="text-xs text-muted-foreground">
          Your key starts with <code className="font-mono">fp_live_</code> or{" "}
          <code className="font-mono">fp_test_</code>. It is never stored on
          disk — only in an encrypted session cookie.
        </p>
      </CardContent>
    </Card>
  );
}
