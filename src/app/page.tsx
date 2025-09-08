"use client";

import { useState, useEffect } from "react";
import { Activity, Server, Globe, Network, Database, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ResourceList } from "@/components/dashboard/ResourceList";
import { IncidentList } from "@/components/dashboard/IncidentList";
import { RealtimeChart } from "@/components/dashboard/RealtimeChart";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalServers: 12,
    totalWebsites: 8,
    totalNetworks: 5,
    totalDatabases: 3,
    activeIncidents: 2,
    uptime: 99.95,
  });

  const [resources, setResources] = useState([
    {
      id: "1",
      name: "Production Server 1",
      type: "server",
      status: "online",
      cpu: 45,
      memory: 62,
      disk: 38,
      lastSeen: "2 mins ago",
    },
    {
      id: "2",
      name: "ankercloud.com",
      type: "website",
      status: "online",
      responseTime: 245,
      availability: 100,
      lastCheck: "1 min ago",
    },
    {
      id: "3",
      name: "Database Primary",
      type: "database",
      status: "warning",
      connections: 85,
      queries: 1250,
      lastSeen: "30 secs ago",
    },
  ]);

  const [incidents, setIncidents] = useState([
    {
      id: "1",
      resourceName: "Database Primary",
      severity: "warning",
      message: "High connection count (85/100)",
      triggeredAt: "10 mins ago",
      state: "active",
    },
    {
      id: "2",
      resourceName: "Production Server 2",
      severity: "critical",
      message: "CPU usage above 90%",
      triggeredAt: "5 mins ago",
      state: "active",
    },
  ]);

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
            />
            <StatsCard
              title="Websites"
              value={stats.totalWebsites}
              icon={<Globe className="h-4 w-4" />}
              trend="up"
              trendValue="100%"
              status="online"
            />
            <StatsCard
              title="Networks"
              value={stats.totalNetworks}
              icon={<Network className="h-4 w-4" />}
              trend="stable"
              trendValue="100%"
              status="online"
            />
            <StatsCard
              title="Databases"
              value={stats.totalDatabases}
              icon={<Database className="h-4 w-4" />}
              trend="down"
              trendValue="66%"
              status="warning"
            />
            <StatsCard
              title="Incidents"
              value={stats.activeIncidents}
              icon={<AlertTriangle className="h-4 w-4" />}
              trend="down"
              trendValue="+2"
              status="critical"
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
            {/* Resources List - 2 columns wide */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="p-4 border-b border-zinc-800">
                  <h2 className="text-lg font-semibold text-zinc-100">Monitored Resources</h2>
                  <p className="text-sm text-zinc-400 mt-1">Real-time status of all resources</p>
                </div>
                <ResourceList resources={resources} />
              </div>

              {/* Real-time Chart */}
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4">System Metrics</h2>
                <RealtimeChart />
              </div>
            </div>

            {/* Incidents Panel - 1 column wide */}
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

              {/* Quick Actions */}
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    Add New Server
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    Add Website Monitor
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    Configure Alerts
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    Download Agent
                  </button>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-3">System Health</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">API Status</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Operational</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Data Ingestion</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Running</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Alert Engine</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
