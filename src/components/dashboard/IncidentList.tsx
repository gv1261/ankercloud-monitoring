"use client";

import { AlertTriangle, AlertCircle, Info, Clock, CheckCircle } from "lucide-react";

interface Incident {
  id: string;
  resourceName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  triggeredAt: string;
  state: "active" | "acknowledged" | "resolved";
}

interface IncidentListProps {
  incidents: Incident[];
}

export function IncidentList({ incidents }: IncidentListProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500 bg-red-500/10";
      case "warning":
        return "text-yellow-500 bg-yellow-500/10";
      case "info":
        return "text-blue-500 bg-blue-500/10";
      default:
        return "text-zinc-400 bg-zinc-400/10";
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case "acknowledged":
        return <CheckCircle className="h-3 w-3" />;
      case "resolved":
        return <CheckCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (incidents.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-500/10 mb-4">
          <CheckCircle className="h-6 w-6 text-green-500" />
        </div>
        <p className="text-sm text-zinc-400">No active incidents</p>
        <p className="text-xs text-zinc-500 mt-1">All systems operational</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800">
      {incidents.map((incident) => (
        <div key={incident.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg ${getSeverityColor(incident.severity)}`}>
              {getSeverityIcon(incident.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-zinc-100 truncate">
                    {incident.resourceName}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    {incident.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      <span>{incident.triggeredAt}</span>
                    </div>
                    {incident.state === "acknowledged" && (
                      <div className="flex items-center gap-1 text-xs text-blue-400">
                        {getStateIcon(incident.state)}
                        <span>Acknowledged</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <button className="px-2 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">
                    View
                  </button>
                  {incident.state === "active" && (
                    <button className="px-2 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">
                      Ack
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {incidents.length > 3 && (
        <div className="p-3 text-center">
          <button className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            View all incidents →
          </button>
        </div>
      )}
    </div>
  );
}
