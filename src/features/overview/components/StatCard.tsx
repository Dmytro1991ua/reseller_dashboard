import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <Card className="hover:bg-primary/5 hover:border-primary/20 cursor-default transition-transform duration-300 hover:-translate-y-0.5">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
