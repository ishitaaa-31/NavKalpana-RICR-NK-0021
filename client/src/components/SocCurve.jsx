import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const soc = payload?.[0]?.value ?? 0;
  const km = label ?? 0;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
        color: "#111827",
        minWidth: 130,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14 }}>
        {Number(km).toFixed(1)} km
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#059669" }}>
        {Number(soc).toFixed(1)}% SoC
      </div>
    </div>
  );
};

// ✅ Small tick marker on X axis at stop distances
const StopTick = ({ x, y, payload, stopSet }) => {
  const value = payload?.value;
  const isStop = stopSet?.has(Number(value));
  const label = `${Math.round(value)} km`;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* text */}
      <text
        x={0}
        y={16}
        textAnchor="middle"
        fill="rgba(255,255,255,0.65)"
        fontSize={12}
      >
        {label}
      </text>

      {/* marker dot above axis (only for stops) */}
      {isStop && (
        <>
          <circle cx={0} cy={-2} r={5} fill="rgba(16,185,129,0.18)" />
          <circle cx={0} cy={-2} r={3} fill="#10b981" />
        </>
      )}
    </g>
  );
};

const SocCurve = ({ socCurve = [], reservePercentage = 10 }) => {
  if (!socCurve || socCurve.length === 0) return null;

  // sanitize + sort
  const data = useMemo(
    () =>
      socCurve
        .map((d) => ({
          ...d,
          distance: Number(d.distance),
          soc: clamp(Number(d.soc), 0, 100),
        }))
        .filter((d) => Number.isFinite(d.distance) && Number.isFinite(d.soc))
        .sort((a, b) => a.distance - b.distance),
    [socCurve]
  );

  // stop distances from backend (use your "charge" points as stops)
  const stopDistances = useMemo(() => {
    const stops = data
      .filter((d) => d.type === "charge")
      .map((d) => Number(d.distance.toFixed(1)));

    return Array.from(new Set(stops)).sort((a, b) => a - b);
  }, [data]);

  // ticks we want on X axis: start + stops + end
  const xTicks = useMemo(() => {
    const start = 0;
    const end = data.length ? Number(data[data.length - 1].distance.toFixed(1)) : 0;

    const all = [start, ...stopDistances, end]
      .map((v) => Number(v.toFixed(1)))
      .filter((v) => Number.isFinite(v));

    return Array.from(new Set(all)).sort((a, b) => a - b);
  }, [data, stopDistances]);

  const stopSet = useMemo(() => new Set(stopDistances), [stopDistances]);

  // show dot only on charge points
  const dot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload || payload.type !== "charge") return null;

    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="rgba(16,185,129,0.18)" />
        <circle cx={cx} cy={cy} r={4} fill="#10b981" />
      </g>
    );
  };

  return (
    <div
      className="w-full rounded-2xl p-6"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="mb-4">
        <h3 className="text-xl font-bold">State of Charge (SoC) Curve</h3>
        <p className="text-sm text-gray-300 mt-1">
          Battery level throughout your journey with charging events
        </p>
      </div>

      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 24, left: 6, bottom: 24 }}
          >
            <defs>
              {/* Fill */}
              <linearGradient id="socFillSoft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>

              {/* Glow */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.10)" />

            {/* ✅ vertical soft lines at stops (like Figma) */}
            {stopDistances.map((x) => (
              <ReferenceLine
                key={`stopline-${x}`}
                x={x}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="2 6"
                ifOverflow="extendDomain"
              />
            ))}

            <XAxis
              dataKey="distance"
              type="number"
              domain={[0, "dataMax"]}
              ticks={xTicks} // ✅ show start + stop distances + end
              interval={0}   // ✅ force all ticks
              tick={(props) => <StopTick {...props} stopSet={stopSet} />}
              axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
              padding={{ left: 10, right: 10 }}
              label={{
                value: "Distance (km)",
                position: "insideBottom",
                offset: -12,
                fill: "rgba(255,255,255,0.65)",
                fontSize: 12,
              }}
            />

            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.15)" }}
              width={48}
              label={{
                value: "SoC (%)",
                angle: -90,
                position: "insideLeft",
                fill: "rgba(255,255,255,0.65)",
                fontSize: 12,
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Optimal */}
            <ReferenceLine
              y={80}
              stroke="rgba(59,130,246,0.9)"
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
            />

            {/* Reserve */}
            <ReferenceLine
              y={reservePercentage}
              stroke="rgba(239,68,68,0.9)"
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
            />

            <Area
              dataKey="soc"
              type="linear"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#socFillSoft)"
              filter="url(#glow)"
              dot={dot}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#ffffff", fill: "#10b981" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-4 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#10b981" }} />
          Battery Level
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-5 h-[2px]" style={{ background: "rgba(59,130,246,0.9)" }} />
          Optimal Charge Level (80%)
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-5 h-[2px]" style={{ background: "rgba(239,68,68,0.9)" }} />
          Minimum Reserve
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#10b981" }} />
          Charging Stop (marker)
        </div>
      </div>
    </div>
  );
};

export default SocCurve;