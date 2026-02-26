import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Colour palette — each segment gets its own slice colour ──────────────────
const SLICE_COLORS = [
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
  "#facc15", // yellow
  "#60a5fa", // blue
  "#4ade80", // green
];

const fmt = (v) => `${v} kWh`;

// ── Stat pill (reused visual language from BarGraph) ─────────────────────────
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
    <span style={{ fontSize: 15 }}>{icon}</span>
    <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {label}
    </span>
    <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
  </div>
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload; // full segment object

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(15,23,42,0.94)",
        backdropFilter: "blur(16px)",
        padding: "14px 18px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontWeight: 600, letterSpacing: "0.04em" }}>
        {d.label}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Row dot={payload[0].fill} label="Drive energy"  value={fmt(d.driveEnergyKwh)} color={payload[0].fill} />
        <Row dot="#a78bfa"          label="Recharged"     value={fmt(d.rechargedKwh)}   color="#a78bfa" />
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <Row dot={null}             label="Distance"      value={`${d.driveKm} km`}     color="#f1f5f9" />
      </div>
    </div>
  );
};

const Row = ({ dot, label, value, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#cbd5e1" }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 2, background: dot, display: "inline-block" }} />}
      {label}
    </span>
    <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
  </div>
);

// ── Custom legend ─────────────────────────────────────────────────────────────
const CustomLegend = ({ segments }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "8px 16px",
      marginTop: 16,
    }}
  >
    {segments.map((s, i) => (
      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: SLICE_COLORS[i % SLICE_COLORS.length],
          }}
        />
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{s.label}</span>
      </div>
    ))}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const EnergyPieChart = ({ payload }) => {
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
        const res = await fetch("http://localhost:4500/api/ev/analytics/energy-per-segment", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.error("EnergyPieChart error:", e);
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [canFetch, payload]);

  // Pie slices — one per segment, sized by driveEnergyKwh
  const pieData = useMemo(() => {
    if (!data?.segments) return [];
    return data.segments
      .filter((s) => s.driveEnergyKwh > 0)
      .map((s, i) => ({
        ...s,
        value: s.driveEnergyKwh,
        fill:  SLICE_COLORS[i % SLICE_COLORS.length],
      }));
  }, [data]);

  const totals = data?.totals;

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
            <span style={{ fontSize: 18 }}>⚡</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              Energy per Segment
            </h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>drive consumption</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
            How your battery energy is consumed across each leg of the journey
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
              color: "#38bdf8",
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
          <Pill icon="🔋" label="Total consumed" value={`${totals.totalDriveEnergyKwh} kWh`}    color="#38bdf8" />
          <Pill icon="⚡" label="Recharged"       value={`${totals.totalRechargedEnergyKwh} kWh`} color="#a78bfa" />
          <Pill icon="🏁" label="Final SoC"        value={`${totals.finalSoCPct}%`}               color="#34d399" />
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
          {/* ── Two-column layout: pie left, breakdown table right ── */}
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>

            {/* Pie */}
            <div style={{ flex: "1 1 260px", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="78%"
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.fill}
                        fillOpacity={0.85}
                        style={{ cursor: "pointer", outline: "none" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Breakdown table */}
            <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 8 }}>
              {pieData.map((s, i) => {
                const pct = totals?.totalDriveEnergyKwh > 0
                  ? ((s.driveEnergyKwh / totals.totalDriveEnergyKwh) * 100).toFixed(1)
                  : 0;
                return (
                  <div
                    key={s.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Colour dot */}
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: s.fill, flexShrink: 0 }} />

                    {/* Label */}
                    <span style={{ flex: 1, fontSize: 11, color: "#94a3b8", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </span>

                    {/* Progress bar */}
                    <div style={{ width: 60, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: s.fill, borderRadius: 99 }} />
                    </div>

                    {/* Value */}
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.fill, flexShrink: 0 }}>
                      {s.driveEnergyKwh} kWh
                    </span>
                    <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <CustomLegend segments={pieData} />
        </>
      )}
    </div>
  );
};

export default EnergyPieChart;