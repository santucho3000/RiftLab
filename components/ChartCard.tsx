"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, GoldDiffPoint } from "@/lib/types";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="section-tertiary min-h-[320px]">
      <p className="label-muted text-lab-cyan/80">Telemetry Chart</p>
      <h2 className="mt-3 text-xl font-semibold text-lab-text">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm leading-6 text-lab-muted">{subtitle}</p> : null}
      <div className="mt-5 h-56">{children}</div>
    </section>
  );
}

const axisStyle = {
  tick: { fill: "#92A0B4", fontSize: 12 },
  axisLine: { stroke: "#202A38" },
  tickLine: { stroke: "#202A38" },
};

const tooltipStyle = {
  backgroundColor: "#0D121B",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  color: "#E7EEF8",
};

export function GoldDiffChart({ data }: { data: GoldDiffPoint[] }) {
  return (
    <ChartCard title="Gold difference over time" subtitle="Team gold delta at key match checkpoints.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#202A38" strokeDasharray="3 3" />
          <XAxis dataKey="minute" {...axisStyle} tickFormatter={(value: number) => `${value}m`} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `${value} minutes`} />
          <Line type="monotone" dataKey="goldDiff" stroke="#45D4FF" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PhaseImpactChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Impact by phase" subtitle="How much value RiftLab attributes by game phase.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#202A38" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis domain={[0, 100]} {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#6BE19B" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MetricBarChart({
  title,
  subtitle,
  data,
  color = "#F6C85F",
}: {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  color?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 16, bottom: 0 }}>
          <CartesianGrid stroke="#202A38" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axisStyle} />
          <YAxis type="category" dataKey="label" width={84} {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill={color} radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
