import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const BarGraph = ({ payload }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const canFetch = useMemo(() => {
    return (
      payload &&
      payload.distance &&
      payload.duration &&
      Array.isArray(payload.routePolyline) &&
      payload.routePolyline.length >= 2
    );
  }, [payload]);

  useEffect(() => {
    if (!canFetch) return;

    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:4500/api/ev/analytics/time-breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }

        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("BarGraph error:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [canFetch, payload]);

  const chartData = useMemo(() => {
    if (!data?.segments) return [];
    return data.segments.map((s) => ({
      segment: s.label,
      Driving: s.drivingHours,
      Charging: s.chargingHours,
    }));
  }, [data]);

  const totalsLine = useMemo(() => {
    if (!data?.totals) return "";
    const t = data.totals;
    return `Driving ${t.drivingHours}h • Charging ${t.chargingHours}h • Total ${t.totalTripHours}h`;
  }, [data]);

  const CustomTooltip = ({ active, payload: p, label }) => {
    if (!active || !p?.length) return null;
    const driving = p.find((x) => x.dataKey === "Driving")?.value ?? 0;
    const charging = p.find((x) => x.dataKey === "Charging")?.value ?? 0;
    return (
      <div className="rounded-xl border border-white/10 bg-black/80 backdrop-blur px-4 py-3 shadow-xl">
        <div className="text-sm font-semibold text-white mb-2">{label}</div>
        <div className="text-sm text-gray-200">🚗 Driving: <span className="font-semibold">{driving}h</span></div>
        <div className="text-sm text-gray-200">⚡ Charging: <span className="font-semibold">{charging}h</span></div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-semibold">⏱️ Driving vs Charging Time (Per Segment)</h3>
          <p className="text-xs text-gray-400 mt-1">{totalsLine}</p>
        </div>
        {loading && (
          <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/10 text-gray-200">
            Loading…
          </span>
        )}
      </div>

      {!canFetch ? (
        <div className="text-sm text-gray-400">Generate a route first to view the chart.</div>
      ) : !data ? (
        <div className="text-sm text-gray-400">No data yet.</div>
      ) : (
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="segment"
                stroke="#cbd5e1"
                interval={0}
                angle={-18}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke="#cbd5e1" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Colorful stacked bars */}
              <Bar dataKey="Driving" stackId="t" fill="#60a5fa" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Charging" stackId="t" fill="#22c55e" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default BarGraph;