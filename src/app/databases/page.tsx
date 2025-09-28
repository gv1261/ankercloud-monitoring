"use client";

import { useEffect, useState } from "react";
import { Database, Activity } from "lucide-react";

interface DatabaseMetrics {
  cpuUsage: number;
  memoryUsage: number;
  connections: number;
  queriesPerSec: number;
  lastReported: string;
}

interface Database {
  id: string;
  name: string;
  displayName: string;
  status: string;
  metrics: DatabaseMetrics | null;
}

export default function DatabasePage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatabases = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/resources?type=database", {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        });
        const data = await res.json();
        setDatabases(data.resources || []);
      } catch (err) {
        console.error("Error fetching databases:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDatabases();
  }, []);

  const getUsageColor = (value?: number) => {
    if (value === undefined) return "bg-gray-400";
    if (value < 50) return "bg-green-500";
    if (value < 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Database className="w-6 h-6" /> Databases
      </h1>

      {loading ? (
        <p className="text-zinc-400">Loading databases...</p>
      ) : databases.length === 0 ? (
        <p className="text-zinc-400">No databases found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <thead className="bg-zinc-800 text-zinc-200">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">CPU %</th>
                <th className="px-4 py-2">Memory %</th>
                <th className="px-4 py-2">Connections</th>
                <th className="px-4 py-2">Queries/sec</th>
                <th className="px-4 py-2">Last Reported</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db) => (
                <tr key={db.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                  <td className="px-4 py-2 text-white">{db.displayName || db.name}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      db.status === "online"
                        ? "text-green-400"
                        : db.status === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {db.status || "-"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getUsageColor(db.metrics?.cpuUsage)} h-3 rounded`}
                        style={{ width: `${db.metrics?.cpuUsage || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{db.metrics?.cpuUsage ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getUsageColor(db.metrics?.memoryUsage)} h-3 rounded`}
                        style={{ width: `${db.metrics?.memoryUsage || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{db.metrics?.memoryUsage ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{db.metrics?.connections ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300">{db.metrics?.queriesPerSec ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300 text-sm">
                    {db.metrics?.lastReported ? new Date(db.metrics.lastReported).toLocaleString() : "-"}
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
