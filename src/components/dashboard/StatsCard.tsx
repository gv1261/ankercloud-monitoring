"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  status?: "online" | "warning" | "critical" | "offline";
}

export function StatsCard({ title, value, icon, trend, trendValue, status }: StatsCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "text-green-500 bg-green-500/10";
      case "warning":
        return "text-yellow-500 bg-yellow-500/10";
      case "critical":
        return "text-red-500 bg-red-500/10";
      case "offline":
        return "text-zinc-500 bg-zinc-500/10";
      default:
        return "text-zinc-400 bg-zinc-400/10";
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3" />;
      case "down":
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green-500";
      case "down":
        return "text-red-500";
      default:
        return "text-zinc-400";
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${getStatusColor()}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100">{value}</p>
        <p className="text-sm text-zinc-400 mt-1">{title}</p>
      </div>
    </div>
  );
}
