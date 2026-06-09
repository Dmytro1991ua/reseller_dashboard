import { Globe } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="from-primary/15 via-primary/6 to-background hidden flex-col items-center justify-center gap-8 bg-linear-to-b p-12 lg:flex lg:w-2/5">
        {/* Animated logo */}
        <div className="animate-logo-float flex items-center gap-5">
          <div className="animate-logo-glow bg-primary flex size-24 items-center justify-center rounded-full">
            <Globe className="text-primary-foreground size-12" />
          </div>

          <div>
            <p className="text-3xl font-bold tracking-tight">ProxyDesk</p>
            <p className="text-muted-foreground text-base">Admin</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-2xl leading-snug font-semibold">Built for resellers.</p>
          <p className="text-muted-foreground mt-2">Buy. Brand. Sell.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center p-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
