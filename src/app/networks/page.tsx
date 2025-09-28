"use client";

import { useEffect, useState } from "react";
import { Wifi, Activity } from "lucide-react";

interface NetworkMetrics {
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  avgPacketLoss: number;
  totalChecks: number;
  successfulChecks: number;
}

interface Network {
  id: string;
  name: string;
  displayName: string;
  targetHost: string;
  targetPort?: number;
  status: string;
  metrics: NetworkMetrics | null;
}

export default function NetworkPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNetworks = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/resources?type=network", {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        });
        const data = await res.json();
        setNetworks(data.resources || []);
      } catch (err) {
        console.error("Error fetching networks:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNetworks();
  }, []);

  const getPacketLossColor = (value?: number) => {
    if (value === undefined) return "bg-gray-400";
    if (value < 1) return "bg-green-500";
    if (value < 5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Wifi className="w-6 h-6" /> Network Checks
      </h1>

      {loading ? (
        <p className="text-zinc-400">Loading network resources...</p>
      ) : networks.length === 0 ? (
        <p className="text-zinc-400">No network resources found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <thead className="bg-zinc-800 text-zinc-200">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Target Host</th>
                <th className="px-4 py-2">Port</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Avg Latency (ms)</th>
                <th className="px-4 py-2">Packet Loss %</th>
                <th className="px-4 py-2">Total Checks</th>
                <th className="px-4 py-2">Successful</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((net) => (
                <tr key={net.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                  <td className="px-4 py-2 text-white">{net.displayName || net.name}</td>
                  <td className="px-4 py-2 text-zinc-300">{net.targetHost}</td>
                  <td className="px-4 py-2 text-zinc-300">{net.targetPort || "-"}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      net.status === "online"
                        ? "text-green-400"
                        : net.status === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {net.status || "-"}
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{net.metrics?.avgLatency ?? "-"}</td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getPacketLossColor(net.metrics?.avgPacketLoss)} h-3 rounded`}
                        style={{ width: `${net.metrics?.avgPacketLoss || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{net.metrics?.avgPacketLoss ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{net.metrics?.totalChecks ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300">{net.metrics?.successfulChecks ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
