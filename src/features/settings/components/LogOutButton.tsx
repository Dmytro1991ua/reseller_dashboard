"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to log out. Please try again.");
      setPending(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleLogout} disabled={pending}>
      <LogOut className="size-4" />
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
