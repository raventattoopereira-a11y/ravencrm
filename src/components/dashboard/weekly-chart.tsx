"use client";

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
import { formatCOP } from "@/lib/utils";

export interface DailyPoint {
  label: string;
  ingresos: number;
  egresos: number;
}

export function WeeklyChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2b2b33" vertical={false} />
        <XAxis dataKey="label" stroke="#9a9aa5" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#9a9aa5"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip
          contentStyle={{ background: "#1e1e24", border: "1px solid #2b2b33", borderRadius: 8 }}
          labelStyle={{ color: "#f4f4f5" }}
          formatter={(value) => formatCOP(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9a9aa5" }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="egresos" name="Egresos" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
