"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // ✅ import this
import { Activity, Server, Globe, Network, Database, AlertTriangle } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ResourceList } from "@/components/dashboard/ResourceList";
import { IncidentList } from "@/components/dashboard/IncidentList";
import { RealtimeChart } from "@/components/dashboard/RealtimeChart";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import api from "@/lib/api";

export default function Dashboard() {
  const router = useRouter(); // ✅ initialize router
  const [resources, setResources] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Fetch all resources
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch resources
        const allResources = await api.resources.getAll();
        const resourcesArray = Array.isArray(allResources.servers) ? allResources.servers : [];
        setResources(resourcesArray);

        setResources(resourcesArray);

        // 2. Fetch latest metrics for all resources
        const resourceIds = resourcesArray.map((res) => res.id);
        const latestMetrics = await api.metrics.getLatest(resourceIds);
        setMetrics(latestMetrics || {});

        // 3. Fetch incidents
        const activeIncidents = await api.alerts.getIncidents({ state: "active" });
        const incidentsArray = Array.isArray(activeIncidents) ? activeIncidents : [];
        setIncidents(incidentsArray);

      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Prepare stats dynamically from fetched resources/metrics
  const stats = {
    totalServers: resources.filter(r => r.type === "server").length,
    totalWebsites: resources.filter(r => r.type === "website").length,
    totalNetworks: resources.filter(r => r.type === "network").length,
    totalDatabases: resources.filter(r => r.type === "database").length,
    activeIncidents: incidents.length,
    uptime: calculateUptime(metrics), // you can implement a helper function
  };

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-zinc-950 p-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatsCard
              title="Servers"
              value={stats.totalServers}
              icon={<Server className="h-4 w-4" />}
              trend="up"
              trendValue="100%"
              status="online"
              onClick={() => router.push("/servers")}
            />
            <StatsCard
              title="Websites"
              value={stats.totalWebsites}
              icon={<Globe className="h-4 w-4" />}
              trend="up"
              trendValue="100%"
              status="online"
              onClick={() => router.push("/websites")}
            />
            <StatsCard
              title="Networks"
              value={stats.totalNetworks}
              icon={<Network className="h-4 w-4" />}
              trend="stable"
              trendValue="100%"
              status="online"
              onClick={() => router.push("/networks")}
            />
            <StatsCard
              title="Databases"
              value={stats.totalDatabases}
              icon={<Database className="h-4 w-4" />}
              trend="down"
              trendValue="66%"
              status="warning"
              onClick={() => router.push("/databases")}
            />
            <StatsCard
              title="Incidents"
              value={stats.activeIncidents}
              icon={<AlertTriangle className="h-4 w-4" />}
              trend="down"
              trendValue={`+${stats.activeIncidents}`}
              status={stats.activeIncidents > 0 ? "critical" : "online"}
            />
            <StatsCard
              title="Uptime"
              value={`${stats.uptime}%`}
              icon={<Activity className="h-4 w-4" />}
              trend="up"
              trendValue="SLA"
              status="online"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Resources */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="p-4 border-b border-zinc-800">
                  <h2 className="text-lg font-semibold text-zinc-100">Monitored Resources</h2>
                  <p className="text-sm text-zinc-400 mt-1">Real-time status of all resources</p>
                </div>
                <ResourceList resources={resources} />
              </div>

              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4">System Metrics</h2>
                <RealtimeChart metrics={metrics} />
              </div>
            </div>

            {/* Incidents */}
            <div className="space-y-6">
              <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="p-4 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-zinc-100">Active Incidents</h2>
                    <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-400 rounded-full">
                      {incidents.length} Active
                    </span>
                  </div>
                </div>
                <IncidentList incidents={incidents} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Example helper for uptime calculation from metrics
function calculateUptime(metricsData: any) {
  // Compute an average uptime from all server metrics
  if (!metricsData || Object.keys(metricsData).length === 0) return 0;
  const uptimes = Object.values(metricsData)
    .map((m: any) => m.uptime)
    .filter((v: any) => typeof v === "number");
  if (!uptimes.length) return 0;
  return (uptimes.reduce((a: number, b: number) => a + b, 0) / uptimes.length).toFixed(2);
}
