"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface MetricData {
  time: string;
  cpu: number;
  memory: number;
  disk: number;
}

export default function ServerGraphPage() {
  const params = useParams();
  const serverId = params.id;

  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `http://localhost:3001/api/metrics/${serverId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );
        const data = await res.json();

        // Transform data for recharts
        const formattedData = data.data.map((d: any) => ({
          time: new Date(d.bucket).toLocaleTimeString(),
          cpu: parseFloat(d.cpu),
          memory: parseFloat(d.memory_mb),
          disk: parseFloat(d.disk_mb),
        }));

        setMetrics(formattedData);
      } catch (err) {
        console.error("Error fetching metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [serverId]);

  if (loading) return <p className="p-6 text-white">Loading metrics...</p>;
  if (!metrics.length) return <p className="p-6 text-white">No metrics found.</p>;

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">Server Utilization Graph</h1>

      <LineChart width={900} height={400} data={metrics}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke="#fff" />
        <YAxis stroke="#fff" />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
        <Line type="monotone" dataKey="memory" stroke="#82ca9d" />
        <Line type="monotone" dataKey="disk" stroke="#ffc658" />
      </LineChart>
    </div>
  );
}
