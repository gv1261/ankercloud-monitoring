"use client";

import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const resourceIds = ["id1", "id2", "id3"]; // replace with actual IDs

        const res = await fetch("/api/metrics/latest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceIds }),
        });

        const data = await res.json();
        setMetrics(data.metrics); // store only metrics
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) return <p className="text-white">Loading metrics...</p>;

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Latest Metrics</h1>
      <pre className="bg-gray-800 p-4 rounded">{JSON.stringify(metrics, null, 2)}</pre>
    </div>
  );
}
