import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";

// Gradient applied to the provider so BOTH sidebar and content share it.
// SidebarInset and sidebar-inner must be transparent to let it show through.
const PAGE_GRADIENT = "linear-gradient(135deg, var(--bg-top) 0%, var(--bg-bottom) 100%)";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider className="h-svh" style={{ background: PAGE_GRADIENT }}>
      <AppSidebar />
      {/* transparent: shows the SidebarProvider gradient through the content area */}
      <SidebarInset className="min-h-0 overflow-y-auto" style={{ background: "transparent" }}>
        <Header />
        <PageWrapper>{children}</PageWrapper>
      </SidebarInset>
    </SidebarProvider>
  );
}
