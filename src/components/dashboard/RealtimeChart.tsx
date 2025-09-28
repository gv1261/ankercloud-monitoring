"use client";

import { useEffect, useState, useRef } from "react";

interface Server {
  id: string;
  name?: string;
  displayName?: string;
  details?: { hostname?: string };
  type?: string;
}

interface LatestMetricRow {
  cpu_usage_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  disk_used_mb?: number;
  disk_total_mb?: number;
  latency_ms?: number;
  packet_loss_percent?: number;
  response_time_ms?: number;
  time?: string;
}

export function RealtimeChart() {
  const [servers, setServers] = useState<Server[]>([]);
  const [series, setSeries] = useState<
    Record<string, { cpu: number[]; mem: number[]; disk: number[]; timestamps: string[]; name: string }>
  >({});
  const maxPoints = 20;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchServers = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/resources/servers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const serverList: Server[] = Array.isArray(data?.resources) ? data.resources : [];
        if (!mounted) return;

        setServers(serverList);
        const ids = serverList.map((s) => s.id).filter(Boolean);
        if (ids.length === 0) return;

        await fetchLatestMetrics(ids, serverList);

        timerRef.current = window.setInterval(() => fetchLatestMetrics(ids, serverList), 5000);
      } catch (err) {
        console.error("fetchServers error:", err);
      }
    };

    const fetchLatestMetrics = async (ids: string[], serverList: Server[]) => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/latest`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ resourceIds: ids }),
        });

        const json = await res.json();
        const metricsMap = json.metrics || {};

        setSeries((prev) => {
          const next = { ...prev };
          serverList.forEach((s) => {
            const entry = metricsMap[s.id]?.data || {};
            const cpu = entry.cpu_usage_percent ?? 0;
            const mem =
              entry.memory_total_mb && entry.memory_used_mb
                ? (entry.memory_used_mb / entry.memory_total_mb) * 100
                : entry.memory_usage_percent ?? 0;
            const disk =
              entry.disk_total_mb && entry.disk_used_mb
                ? (entry.disk_used_mb / entry.disk_total_mb) * 100
                : entry.disk_usage_percent ?? 0;
            const ts = entry.time ?? new Date().toISOString();

            if (!next[s.id]) next[s.id] = { cpu: [], mem: [], disk: [], timestamps: [], name: s.name || s.displayName || s.id };

            next[s.id].cpu = [...next[s.id].cpu, cpu].slice(-maxPoints);
            next[s.id].mem = [...next[s.id].mem, Math.round(mem * 100) / 100].slice(-maxPoints);
            next[s.id].disk = [...next[s.id].disk, Math.round(disk * 100) / 100].slice(-maxPoints);
            next[s.id].timestamps = [...next[s.id].timestamps, ts].slice(-maxPoints);
          });
          return next;
        });
      } catch (err) {
        console.error("fetchLatestMetrics error:", err);
      }
    };

    fetchServers();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const serverIds = Object.keys(series);
  const firstId = serverIds[0];
  const cpuData = firstId ? series[firstId].cpu : [];
  const memData = firstId ? series[firstId].mem : [];
  const diskData = firstId ? series[firstId].disk : [];
  const nameForFirst = firstId ? series[firstId].name : "—";

  const maxValue = Math.max(100, ...cpuData, ...memData, ...diskData);
  const chartHeight = 180;
  const pointsFor = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = (i / Math.max(arr.length - 1, 1)) * 100;
        const y = ((maxValue - v) / maxValue) * 100;
        return `${x}%,${y}%`;
      })
      .join(" ");

  return (
    <div>
      <div className="mb-3">
        <strong>Servers found:</strong> {servers.length} — {serverIds.length} metrics tracked
      </div>

      <div className="bg-zinc-900 p-4 rounded">
        <div className="text-sm text-zinc-300 mb-2">
          CPU / Memory / Disk (latest) — {nameForFirst}
        </div>

        <svg width="100%" height={chartHeight} className="relative">
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={pointsFor(cpuData)} />
          <polyline fill="none" stroke="#a855f7" strokeWidth="2" points={pointsFor(memData)} />
          <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={pointsFor(diskData)} />
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-4">
          {serverIds.map((id) => {
            const s = series[id];
            const lastCpu = s.cpu[s.cpu.length - 1] ?? 0;
            const lastMem = s.mem[s.mem.length - 1] ?? 0;
            const lastDisk = s.disk[s.disk.length - 1] ?? 0;
            return (
              <div key={id} className="bg-zinc-800 p-3 rounded">
                <div className="text-xs text-zinc-400">{s.name}</div>
                <div className="text-lg font-semibold">{lastCpu}%</div>
                <div className="text-xs text-zinc-400">
                  Mem {lastMem}% • Disk {lastDisk}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default RealtimeChart;
