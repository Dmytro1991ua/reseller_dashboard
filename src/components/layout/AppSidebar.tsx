"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Receipt,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
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

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-tight">FlashProxy</span>
                <span className="text-[11px] text-muted-foreground">
                  Reseller Dashboard
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation — 3 items, no group label needed */}
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

      {/* Footer: settings + logout */}
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={isNavActive(pathname, "/settings", true)}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log out"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                /* wired in auth step */
              }}
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
