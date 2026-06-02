"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Crumb {
  label: string;
  href?: string;
}

function getCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Overview" }];
  if (pathname === "/plans") return [{ label: "Plans" }];
  if (pathname === "/transactions") return [{ label: "Transactions" }];
  if (pathname === "/settings") return [{ label: "Settings" }];

  if (pathname === "/plans/new") {
    return [{ label: "Plans", href: "/plans" }, { label: "New Plan" }];
  }

  if (/^\/plans\/.+/.test(pathname)) {
    return [{ label: "Plans", href: "/plans" }, { label: "Plan Details" }];
  }

  return [{ label: "Dashboard" }];
}

export function Header() {
  const pathname = usePathname();
  const crumbs = getCrumbs(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-auto" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                <BreadcrumbItem>
                  {!isLast && crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
