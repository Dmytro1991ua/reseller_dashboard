import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="mb-2 flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Globe className="size-4" />
          </div>
          <span className="font-semibold">ProxyDesk</span>
        </div>
        <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
        <CardDescription>Sign in with your admin credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
