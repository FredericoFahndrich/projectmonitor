import { riskPriority } from "../../../shared/models.js";
import type { Row } from "../types";
export function businessToday(
  timezone = "America/Sao_Paulo",
  instant = new Date(),
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
export function summarize(
  p: Row,
  tasks: Row[],
  costs: Row[],
  risks: Row[],
  today: string,
) {
  const eligible = tasks.filter(
    (t) => t.kind === "atividade" && t.status !== "Cancelada",
  );
  const open = tasks.filter(
    (t) => !["Concluída", "Cancelada"].includes(t.status),
  );
  const week = new Date(`${today}T12:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const end = week.toISOString().slice(0, 10);
  return {
    progress: eligible.length
      ? Math.round(
          (100 * eligible.filter((t) => t.status === "Concluída").length) /
            eligible.length,
        )
      : null,
    deadline: p.end_date,
    status: p.status,
    budget_cents: p.budget_cents,
    actual_cents: costs.reduce((s, c) => s + c.actual_cents, 0),
    planned_cents: costs.reduce((s, c) => s + c.planned_cents, 0),
    overdue: open.filter((t) => t.end_date && t.end_date < today),
    due_soon: open.filter((t) => t.end_date >= today && t.end_date <= end),
    milestones: open
      .filter((t) => t.kind === "marco")
      .sort((a, b) => a.end_date.localeCompare(b.end_date)),
    high_risks: risks.filter(
      (r) => r.status !== "Encerrado" && riskPriority(r).label === "Alta",
    ),
    today,
  };
}
