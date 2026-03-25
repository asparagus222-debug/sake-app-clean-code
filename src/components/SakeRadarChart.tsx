"use client"

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  PolarRadiusAxis,
} from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface SakeRadarChartProps {
  data: {
    sweetness: number;
    acidity: number;
    bitterness: number;
    umami: number;
    astringency: number;
  }
}

const chartConfig = {
  value: {
    label: "程度",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function SakeRadarChart({ data }: SakeRadarChartProps) {
  const chartData = [
    { subject: "甘", value: data.sweetness },
    { subject: "酸", value: data.acidity },
    { subject: "苦", value: data.bitterness },
    { subject: "旨", value: data.umami },
    { subject: "澀", value: data.astringency },
  ]

  return (
    <div className="w-full aspect-square max-w-[400px] mx-auto flex items-center justify-center">
      <ChartContainer config={chartConfig} className="aspect-square w-full">
        <RadarChart 
          data={chartData} 
          margin={{ top: 35, right: 45, bottom: 35, left: 45 }}
        >
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <PolarGrid stroke="hsl(var(--foreground) / 0.15)" />
          <PolarRadiusAxis 
            domain={[0, 5]} 
            axisLine={false} 
            tick={{ fill: "transparent", fontSize: 0 }}
            ticks={[0, 1, 2, 3, 4, 5] as any}
          />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "hsl(var(--primary))", fontSize: 16, fontWeight: "bold" }} 
          />
          <Radar
            name="風味"
            dataKey="value"
            fill="hsl(var(--primary))"
            fillOpacity={0.5}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
