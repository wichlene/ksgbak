"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { PriceHistoryPoint } from "@/lib/types";
import { formatDateShort, formatPriceTRY } from "@/lib/format";

const ACCENT = "#f27a1a";
const GRID = "#232733";
const AXIS_TEXT = "#8b93a7";
const LOW = "#22c55e";
const HIGH = "#ef4444";

interface ChartPoint {
  date: string;
  price: number;
}

export function PriceChart({ history }: { history: PriceHistoryPoint[] }) {
  if (history.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-white/5 bg-bg-card text-sm text-gray-500">
        Henüz fiyat verisi yok.
      </div>
    );
  }

  const data: ChartPoint[] = history.map((p) => ({
    date: p.recorded_at,
    price: p.price,
  }));

  const minPoint = data.reduce((a, b) => (b.price < a.price ? b : a));
  const maxPoint = data.reduce((a, b) => (b.price > a.price ? b : a));

  return (
    <div className="h-80 rounded-2xl border border-white/5 bg-bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            stroke={GRID}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v: number) => `₺${Math.round(v)}`}
            stroke={GRID}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            width={64}
            domain={["auto", "auto"]}
          />
          <Tooltip content={(props) => <ChartTooltip {...props} />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#priceFill)"
            dot={false}
            activeDot={{ r: 5, fill: ACCENT, stroke: "#0b0d12", strokeWidth: 2 }}
          />
          <ReferenceDot
            x={minPoint.date}
            y={minPoint.price}
            r={5}
            fill={LOW}
            stroke="#0b0d12"
            strokeWidth={2}
            label={{ value: "En düşük", position: "bottom", fill: LOW, fontSize: 11 }}
          />
          <ReferenceDot
            x={maxPoint.date}
            y={maxPoint.price}
            r={5}
            fill={HIGH}
            stroke="#0b0d12"
            strokeWidth={2}
            label={{ value: "En yüksek", position: "top", fill: HIGH, fontSize: 11 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ChartPoint;

  return (
    <div className="rounded-lg border border-white/10 bg-bg-soft px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400">{formatDateShort(point.date)}</div>
      <div className="mt-1 font-semibold text-gray-100">
        {formatPriceTRY(point.price)}
      </div>
    </div>
  );
}
