import React from "react"
import {
  Briefcase,
  Compass,
  GraduationCap,
  HeartPulse,
  Target,
  TrendingUp,
} from "lucide-react"
import type { Tone } from "@/lib/constants"

export const GOAL_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Financial: <TrendingUp className="size-4" />,
  Career: <Briefcase className="size-4" />,
  Learning: <GraduationCap className="size-4" />,
  Health: <HeartPulse className="size-4" />,
  Personal: <Compass className="size-4" />,
  Other: <Target className="size-4" />,
}

export const GOAL_TONE_STYLES: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/25",
  info: "bg-info-soft text-info border-info/25",
  primary: "bg-primary-soft text-primary border-primary/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  neutral: "bg-muted text-muted-foreground border-border",
}
