"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Server as ServerIcon, Activity } from "lucide-react";

interface ServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  lastReported: string;
}

interface Server {
  id: string;
  name: string;
  displayName: string;
  status: string;
  hostname: string;
  ipAddress: string;
  metrics: ServerMetrics | null;
}

export default function ServerPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/resources/servers", {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        });
        const data = await res.json();
        setServers(data.servers || []);
      } catch (err) {
        console.error("Error fetching servers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const getUtilizationColor = (value: number | undefined) => {
    if (value === undefined) return "bg-gray-400";
    if (value < 50) return "bg-green-500";
    if (value < 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <ServerIcon className="w-6 h-6" /> Monitored Servers
      </h1>

      {loading ? (
        <p className="text-zinc-400">Loading servers...</p>
      ) : servers.length === 0 ? (
        <p className="text-zinc-400">No servers found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <thead className="bg-zinc-800 text-zinc-200">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">IP Address</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">CPU %</th>
                <th className="px-4 py-2 text-left">Memory %</th>
                <th className="px-4 py-2 text-left">Disk %</th>
                <th className="px-4 py-2 text-left">Last Reported</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                  <td className="px-4 py-2 text-white">{server.displayName || server.name}</td>
                  <td className="px-4 py-2 text-zinc-300">{server.ipAddress || server.hostname}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      server.status === "online"
                        ? "text-green-400"
                        : server.status === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {server.status || "unknown"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getUtilizationColor(server.metrics?.cpu)} h-3 rounded`}
                        style={{ width: `${server.metrics?.cpu || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{server.metrics?.cpu ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getUtilizationColor(server.metrics?.memory)} h-3 rounded`}
                        style={{ width: `${server.metrics?.memory || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{server.metrics?.memory ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getUtilizationColor(server.metrics?.disk)} h-3 rounded`}
                        style={{ width: `${server.metrics?.disk || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{server.metrics?.disk ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-400 text-sm">
                    {server.metrics?.lastReported
                      ? new Date(server.metrics.lastReported).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
