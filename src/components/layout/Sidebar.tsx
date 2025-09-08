"use client";

import {
  Activity,
  Server,
  Globe,
  Network,
  Database,
  AlertTriangle,
  Settings,
  FileText,
  Download,
  BarChart3,
  Shield,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/", icon: Activity },
    { name: "Servers", href: "/servers", icon: Server },
    { name: "Websites", href: "/websites", icon: Globe },
    { name: "Networks", href: "/networks", icon: Network },
    { name: "Databases", href: "/databases", icon: Database },
    { name: "Alerts", href: "/alerts", icon: AlertTriangle },
    { name: "Reports", href: "/reports", icon: BarChart3 },
  ];

  const bottomNavigation = [
    { name: "Agent Download", href: "/agents", icon: Download },
    { name: "API Docs", href: "/api-docs", icon: FileText },
    { name: "Team", href: "/team", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">AnkerCloud</h1>
            <p className="text-xs text-zinc-400">Monitoring Platform</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-zinc-800 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="p-4 border-t border-zinc-800">
        <div className="bg-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">System Status</span>
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">API</span>
              <span className="text-green-400">Online</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Agents</span>
              <span className="text-green-400">28 Active</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
