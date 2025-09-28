"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [pollInterval, setPollInterval] = useState(5);
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [memoryThreshold, setMemoryThreshold] = useState(75);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(true);

  const handleSave = () => {
    alert(
      `Settings Saved:\nPoll Interval: ${pollInterval} min\nCPU Threshold: ${cpuThreshold}%\nMemory Threshold: ${memoryThreshold}%\nEmail: ${notificationEmail}\nEmail Alerts: ${enableEmailAlerts ? "Enabled" : "Disabled"}`
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Monitoring Settings</h1>

      {/* Polling Settings */}
      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">Polling Settings</h2>
        <label className="block mb-1">Poll Interval (minutes)</label>
        <input
          type="number"
          min={1}
          value={pollInterval}
          onChange={(e) => setPollInterval(Number(e.target.value))}
          className="border px-2 py-1 rounded w-24"
        />
      </div>

      {/* Threshold Settings */}
      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">Alert Thresholds</h2>
        <label className="block mb-1">CPU Usage (%)</label>
        <input
          type="number"
          min={1}
          max={100}
          value={cpuThreshold}
          onChange={(e) => setCpuThreshold(Number(e.target.value))}
          className="border px-2 py-1 rounded w-24 mb-2"
        />

        <label className="block mb-1">Memory Usage (%)</label>
        <input
          type="number"
          min={1}
          max={100}
          value={memoryThreshold}
          onChange={(e) => setMemoryThreshold(Number(e.target.value))}
          className="border px-2 py-1 rounded w-24"
        />
      </div>

      {/* Notifications */}
      <div className="border p-4 rounded">
        <h2 className="font-semibold mb-2">Notifications</h2>
        <label className="block mb-1">Notification Email</label>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          className="border px-2 py-1 w-full rounded mb-2"
        />
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={enableEmailAlerts}
            onChange={(e) => setEnableEmailAlerts(e.target.checked)}
            className="mr-2"
          />
          Enable Email Alerts
        </label>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}
