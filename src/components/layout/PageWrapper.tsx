"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  // Re-trigger the CSS animation on every route change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-page-in");
    // Force reflow so removing+adding the class is visible
    void el.offsetHeight;
    el.classList.add("animate-page-in");
  }, [pathname]);

  return (
    <main
      ref={ref}
      className="animate-page-in from-primary/8 via-primary/8 to-primary/4 flex flex-1 flex-col gap-6 overflow-y-auto bg-linear-to-br p-6"
    >
      {children}
    </main>
  );
}
