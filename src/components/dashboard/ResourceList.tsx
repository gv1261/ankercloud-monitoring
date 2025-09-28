"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext"; 
import { api } from "@/lib/api"; 
import { Server, Globe, Database, Network, Activity, HardDrive, Cpu } from "lucide-react";

interface Resource {
  id: string;
  name: string;
  type: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  responseTime?: number;
  availability?: number;
  connections?: number;
  queries?: number;
  lastSeen?: string;
}

export function ResourceList() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); 
 
  useEffect(() => {
    async function fetchResources() {
      try {
        if (!user) return;

        // fetch servers with metrics
        const res = await fetch("http://localhost:3001/api/resources/servers", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        const data = await res.json();

        // Map backend response -> frontend Resource type
        const mappedResources: Resource[] = (data.servers || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          type: "server",
          status: r.status,
          cpu: r.metrics?.cpu ?? 0,
          memory: r.metrics?.memory ?? 0,
          disk: r.metrics?.disk ?? 0,
          lastSeen: r.metrics?.lastReported ?? "",
        }));

        setResources(mappedResources);
      } catch (err) {
        console.error("Failed to fetch resources:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchResources();
    const interval = setInterval(fetchResources, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case "server": return <Server className="h-5 w-5" />;
      case "website": return <Globe className="h-5 w-5" />;
      case "database": return <Database className="h-5 w-5" />;
      case "network": return <Network className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "critical": return "bg-red-500";
      case "offline": return "bg-zinc-500";
      default: return "bg-zinc-400";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "online": return "text-green-500";
      case "warning": return "text-yellow-500";
      case "critical": return "text-red-500";
      case "offline": return "text-zinc-500";
      default: return "text-zinc-400";
    }
  };

  if (loading) return <p className="p-8 text-center">Loading resources...</p>;

  return (
    <div className="divide-y divide-zinc-800">
      {resources.map(resource => (
        <div key={resource.id} className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                {getIcon(resource.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{resource.name}</h3>
                  <span className={`h-2 w-2 rounded-full ${getStatusColor(resource.status)}`}></span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 capitalize">{resource.type}</p>
                {resource.type === "server" && (
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-zinc-500" /> 
                      <span className="text-xs text-zinc-400">CPU: {resource.cpu}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-zinc-500" /> 
                      <span className="text-xs text-zinc-400">Memory: {resource.memory}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3 text-zinc-500" /> 
                      <span className="text-xs text-zinc-400">Disk: {resource.disk}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs font-medium ${getStatusTextColor(resource.status)} capitalize`}>
                {resource.status}
              </span>
              <p className="text-xs text-zinc-500 mt-1">{resource.lastSeen}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
