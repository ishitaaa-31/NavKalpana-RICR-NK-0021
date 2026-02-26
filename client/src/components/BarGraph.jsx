import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

/* ─── Colour tokens ─────────────────────────────────────── */
const DRIVE_COLOR  = "#38bdf8"; // sky-400
const CHARGE_COLOR = "#a78bfa"; // violet-400
const GRID_COLOR   = "rgba(255,255,255,0.06)";
const AXIS_COLOR   = "#64748b";

/* ─── Stat pill ─────────────────────────────────────────── */
const Pill = ({ icon, label, value, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(8px)",
    }}
  >
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {label}
    </span>
    <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}h</span>
  </div>
);

/* ─── Custom tooltip ────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const driving  = payload.find((x) => x.dataKey === "Driving")?.value  ?? 0;
  const charging = payload.find((x) => x.dataKey === "Charging")?.value ?? 0;
  const total    = (driving + charging).toFixed(2);

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(15,23,42,0.92)",
        backdropFilter: "blur(16px)",
        padding: "14px 18px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        minWidth: 180,
      }}
    >
      {/* Full label in tooltip even though axis shows shortened version */}
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontWeight: 600, letterSpacing: "0.04em" }}>
        {label}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#cbd5e1" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: DRIVE_COLOR, display: "inline-block" }} />
            Driving
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: DRIVE_COLOR }}>{driving}h</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#cbd5e1" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CHARGE_COLOR, display: "inline-block" }} />
            Charging
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: CHARGE_COLOR }}>{charging}h</span>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Segment total</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{total}h</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Custom legend ─────────────────────────────────────── */
const CustomLegend = () => (
  <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
    {[
      { color: DRIVE_COLOR,  label: "Driving time" },
      { color: CHARGE_COLOR, label: "Charging time" },
    ].map(({ color, label }) => (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
      </div>
    ))}
  </div>
);

/* ─── Shorten axis labels so they render straight ───────── */
// "Start → Stop 1"        →  "S → 1"
// "Stop 2 → Stop 3"       →  "2 → 3"
// "Stop 4 → Destination"  →  "4 → D"
const shortenLabel = (v) =>
  v
    .replace("Start", "S")
    .replace("Destination", "D")
    .replace(/Stop\s+(\d+)/g, "$1");

/* ─── Main component ─────────────────────────────────────── */
const BarGraph = ({ payload }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const canFetch = useMemo(() => (
    payload?.distance &&
    payload?.duration &&
    Array.isArray(payload.routePolyline) &&
    payload.routePolyline.length >= 2
  ), [payload]);

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://localhost:4500/api/ev/analytics/time-breakdown", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.error("BarGraph error:", e);
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [canFetch, payload]);

  /* ── Derived chart data ── */
  const chartData = useMemo(() => {
    if (!data?.segments) return [];
    return data.segments.map((s) => ({
      segment:  s.label,
      Driving:  parseFloat(s.drivingHours),
      Charging: parseFloat(s.chargingHours),
    }));
  }, [data]);

  const totals = data?.totals;

  /* ── Highlight the segment with the longest drive ── */
  const maxDriving = useMemo(
    () => Math.max(...chartData.map((d) => d.Driving), 0),
    [chartData]
  );

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(20px)",
        padding: "24px 28px 20px",
        boxShadow: "0 4px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              Driving vs Charging Time
            </h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>per segment</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
            How your trip time is split between driving and charging stops
          </p>
        </div>

        {loading && (
          <div
            style={{
              fontSize: 11,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.2)",
              color: DRIVE_COLOR,
              letterSpacing: "0.06em",
            }}
          >
            ● LOADING
          </div>
        )}
      </div>

      {/* ── Summary pills ── */}
      {totals && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Pill icon="🚗" label="Driving"  value={totals.drivingHours}   color={DRIVE_COLOR}  />
          <Pill icon="⚡" label="Charging" value={totals.chargingHours}  color={CHARGE_COLOR} />
          <Pill icon="🗺️" label="Total"    value={totals.totalTripHours} color="#f1f5f9"      />
        </div>
      )}

      {/* ── States ── */}
      {!canFetch ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", fontSize: 13 }}>
          Generate a route first to view the chart.
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#f87171", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", fontSize: 13 }}>
          {loading ? "Fetching data…" : "No data yet."}
        </div>
      ) : (
        <>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                barGap={4}
                barCategoryGap="30%"
                margin={{ top: 8, right: 8, left: -10, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke={GRID_COLOR} vertical={false} />

                <XAxis
                  dataKey="segment"
                  stroke={AXIS_COLOR}
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }}
                  interval={0}
                  textAnchor="middle"
                  height={36}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  tickFormatter={shortenLabel}
                />

                <YAxis
                  stroke={AXIS_COLOR}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}h`}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.03)", radius: 8 }}
                />

                {/* Driving bars – grouped side by side */}
                <Bar dataKey="Driving" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={`drive-${i}`}
                      fill={DRIVE_COLOR}
                      fillOpacity={entry.Driving === maxDriving ? 1 : 0.6}
                    />
                  ))}
                </Bar>

                {/* Charging bars – side by side with driving */}
                <Bar dataKey="Charging" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={`charge-${i}`}
                      fill={CHARGE_COLOR}
                      fillOpacity={entry.Driving === maxDriving ? 1 : 0.65}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <CustomLegend />
        </>
      )}
    </div>
  );
};

export default BarGraph;