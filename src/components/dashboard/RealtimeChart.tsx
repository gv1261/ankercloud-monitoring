"use client";

import { useEffect, useState } from "react";

export function RealtimeChart() {
  const [data, setData] = useState<number[]>([]);
  const maxDataPoints = 20;

  useEffect(() => {
    // Initialize with some data
    const initialData = Array.from({ length: maxDataPoints }, () =>
      Math.floor(Math.random() * 40) + 30
    );
    setData(initialData);

    // Simulate real-time data updates
    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData];
        newData.shift();
        newData.push(Math.floor(Math.random() * 40) + 30);
        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const maxValue = Math.max(...data, 100);
  const chartHeight = 200;

  return (
    <div className="relative">
      {/* Chart Grid */}
      <div className="absolute inset-0 grid grid-cols-10 grid-rows-4 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="border-r border-b border-zinc-800/30"></div>
        ))}
      </div>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-zinc-500 -ml-8 w-8">
        <span>100%</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>

      {/* Chart */}
      <svg width="100%" height={chartHeight} className="relative">
        {/* CPU Line */}
        <polyline
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
          points={data.map((value, index) => {
            const x = (index / (maxDataPoints - 1)) * 100;
            const y = ((maxValue - value) / maxValue) * 100;
            return `${x}%,${y}%`;
          }).join(' ')}
        />

        {/* CPU Fill */}
        <polygon
          fill="url(#cpuGradient)"
          opacity="0.2"
          points={`0,100% ${data.map((value, index) => {
            const x = (index / (maxDataPoints - 1)) * 100;
            const y = ((maxValue - value) / maxValue) * 100;
            return `${x}%,${y}%`;
          }).join(' ')} 100%,100%`}
        />

        {/* Memory Line (simulated) */}
        <polyline
          fill="none"
          stroke="rgb(168, 85, 247)"
          strokeWidth="2"
          points={data.map((value, index) => {
            const memValue = value * 0.8 + Math.random() * 10;
            const x = (index / (maxDataPoints - 1)) * 100;
            const y = ((maxValue - memValue) / maxValue) * 100;
            return `${x}%,${y}%`;
          }).join(' ')}
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-zinc-400">CPU Usage</span>
          <span className="text-xs font-medium text-zinc-200">{data[data.length - 1]}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-purple-500"></div>
          <span className="text-xs text-zinc-400">Memory Usage</span>
          <span className="text-xs font-medium text-zinc-200">{Math.floor(data[data.length - 1] * 0.8)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span className="text-xs text-zinc-400">Network I/O</span>
          <span className="text-xs font-medium text-zinc-200">24 Mbps</span>
        </div>
      </div>
    </div>
  );
}
