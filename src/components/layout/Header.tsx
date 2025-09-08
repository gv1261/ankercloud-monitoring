"use client";

import { Bell, Search, Settings, User, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search resources..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
                <div className="p-4 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="p-4 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50">
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 bg-red-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-200">Production Server 2 - High CPU Usage</p>
                        <p className="text-xs text-zinc-400 mt-1">5 minutes ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 hover:bg-zinc-800 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 bg-yellow-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-200">Database Primary - Connection limit warning</p>
                        <p className="text-xs text-zinc-400 mt-1">10 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors">
            <Settings className="h-5 w-5" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-white">JD</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-200">John Doe</p>
                <p className="text-xs text-zinc-400">Administrator</p>
              </div>
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <hr className="my-2 border-zinc-800" />
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 rounded-md transition-colors">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
