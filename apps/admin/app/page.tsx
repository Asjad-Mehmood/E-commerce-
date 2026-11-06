import { Badge, Card } from "@hoodie/ui";
import { getApiHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

// Phase 4 fills these from GET /admin/dashboard.
const kpis = [
  { label: "Revenue (today)", value: "—" },
  { label: "Orders (today)", value: "—" },
  { label: "Average order value", value: "—" },
  { label: "New customers", value: "—" },
];

export default async function DashboardPage() {
  const health = await getApiHealth();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted mt-1 text-sm">
          Store overview. Sales metrics will appear here once orders are live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-muted text-sm">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold">System status</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">API</dt>
            <dd className="mt-1">
              {health ? (
                <Badge tone={health.status === "ok" ? "success" : "warning"}>{health.status}</Badge>
              ) : (
                <Badge tone="danger">unreachable</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Database</dt>
            <dd className="mt-1">
              <Badge tone={health?.checks.database === "up" ? "success" : "danger"}>
                {health?.checks.database ?? "unknown"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted">API version</dt>
            <dd className="mt-1 font-mono">{health?.version ?? "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
