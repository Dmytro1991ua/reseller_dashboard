import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="mb-2 flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Zap className="size-4" />
          </div>
          <span className="font-semibold">FlashProxy</span>
        </div>
        <CardTitle className="text-2xl">Reseller Dashboard</CardTitle>
        <CardDescription>Enter your FlashProxy API key to access your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
