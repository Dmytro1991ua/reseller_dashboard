import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { ApiKeyDisplay, LogOutButton } from "@/features/settings/components/ApiKeyDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const environment = baseUrl.includes("sandbox") ? "Sandbox" : "Production";

export default async function SettingsPage() {
  const session = await getSession();
  const apiKey = session.apiKey ?? "";
  const loggedInAt = session.loggedInAt;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your session and API key.</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>Your FlashProxy reseller API key for this session.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyDisplay apiKey={apiKey} />
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Details about your current login session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y">
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-medium">{environment}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">API endpoint</span>
              <span className="font-mono text-xs">{baseUrl}</span>
            </div>
            {loggedInAt && (
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Logged in</span>
                <span className="font-medium">{formatDateTime(loggedInAt)}</span>
              </div>
            )}
          </div>

          <LogOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
