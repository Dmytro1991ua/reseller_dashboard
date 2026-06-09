import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { dbFetch } from "@/lib/dbFetch";
import type { Balance } from "@/types/api";
import { LogOutButton } from "@/features/settings/components/LogOutButton";
import { TopupForm } from "@/features/settings/components/TopupForm";
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

export default async function SettingsPage() {
  const session = await getSession();
  const loggedInAt = session.loggedInAt;

  const [user, balance] = await Promise.all([
    session.userId ? db.user.findUnique({ where: { id: session.userId } }) : null,
    dbFetch<Balance>("/balance").catch(() => null),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and session.</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your ProxyDesk admin account details.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name ?? "Admin"}</span>
          </div>
          {loggedInAt && (
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">Logged in</span>
              <span className="font-medium">{formatDateTime(loggedInAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance top-up */}
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
          <CardDescription>
            Current balance:{" "}
            <span className="text-foreground font-semibold">
              {balance?.balance_formatted ?? "—"}
            </span>
            {balance && (
              <span className="text-muted-foreground">
                {" "}
                · All-time spent: {balance.total_spent_formatted}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TopupForm />
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Manage your current login session.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
