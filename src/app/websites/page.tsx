"use client";

import { useEffect, useState } from "react";
import { Globe, Activity } from "lucide-react";

interface WebsiteMetrics {
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  totalChecks: number;
  successfulChecks: number;
  availabilityPercent: number;
}

interface Website {
  id: string;
  name: string;
  displayName: string;
  url: string;
  status: string;
  metrics: WebsiteMetrics | null;
}

export default function WebsitePage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWebsites = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/resources?type=website", {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        });
        const data = await res.json();
        setWebsites(data.resources || []);
      } catch (err) {
        console.error("Error fetching websites:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWebsites();
  }, []);

  const getAvailabilityColor = (percent?: number) => {
    if (percent === undefined) return "bg-gray-400";
    if (percent > 90) return "bg-green-500";
    if (percent > 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Globe className="w-6 h-6" /> Website Checks
      </h1>

      {loading ? (
        <p className="text-zinc-400">Loading websites...</p>
      ) : websites.length === 0 ? (
        <p className="text-zinc-400">No websites found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <thead className="bg-zinc-800 text-zinc-200">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">URL</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Availability %</th>
                <th className="px-4 py-2">Avg Response (ms)</th>
                <th className="px-4 py-2">Total Checks</th>
                <th className="px-4 py-2">Successful</th>
              </tr>
            </thead>
            <tbody>
              {websites.map((site) => (
                <tr key={site.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                  <td className="px-4 py-2 text-white">{site.displayName || site.name}</td>
                  <td className="px-4 py-2 text-zinc-300">{site.url}</td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      site.status === "online"
                        ? "text-green-400"
                        : site.status === "warning"
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {site.status || "-"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-700 rounded h-3">
                      <div
                        className={`${getAvailabilityColor(site.metrics?.availabilityPercent)} h-3 rounded`}
                        style={{ width: `${site.metrics?.availabilityPercent || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-zinc-300 text-sm">{site.metrics?.availabilityPercent ?? "-"}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{site.metrics?.avgResponseTime ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300">{site.metrics?.totalChecks ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300">{site.metrics?.successfulChecks ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
