"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Layers, Receipt, Settings, LogOut, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/plans", label: "Plans", icon: Layers, exact: false },
  { href: "/transactions", label: "Transactions", icon: Receipt, exact: false },
];

function isNavActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile, open } = useSidebar();
  console.log(open);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="from-primary/8 via-primary/8 to-primary/4 bg-linear-to-br"
    >
      {/* Brand */}
      <SidebarHeader className={cn("border-b-2", open ? "pb-0" : "pb-4")}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent"
              render={<Link href="/" />}
            >
              <div className="bg-primary flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
                <Zap className="text-primary-foreground size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-tight">FlashProxy</span>
                <span className="text-muted-foreground text-[11px]">Reseller Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isNavActive(pathname, item.href, item.exact)}
                    tooltip={item.label}
                    className="mb-2 transition-all duration-200"
                    onClick={closeMobile}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={isNavActive(pathname, "/settings", true)}
              tooltip="Settings"
              className="transition-all duration-200"
              onClick={closeMobile}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log out"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
