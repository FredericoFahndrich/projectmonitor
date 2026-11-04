import { z } from "zod";
const text = z.string().trim().max(10000).default("");
const required = z.string().trim().min(1, "Campo obrigatório").max(300);
const date = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Data inválida",
  )
  .default("");
const money = z.number().int().min(0).max(999999999999).default(0);
const enumField = (values) => z.enum(values);
export const statuses = [
  "Planejamento",
  "Em andamento",
  "Em atenção",
  "Concluído",
];
export const taskStatuses = [
  "Não iniciada",
  "Em andamento",
  "Bloqueada",
  "Concluída",
  "Cancelada",
];
export const levels = ["Baixa", "Média", "Alta"];
const url = z
  .string()
  .max(2048)
  .refine(
    (v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)),
    "Informe uma URL HTTP(S)",
  )
  .default("");
export const models = {
  projects: {
    label: "Projetos",
    fields: {
      name: ["Nome", required],
      description: ["Descrição", text, "textarea"],
      start_date: ["Data de início", date, "date"],
      end_date: ["Término previsto", date, "date"],
      status: ["Situação", enumField(statuses), statuses],
      budget_cents: ["Orçamento vigente (R$)", money, "money"],
    },
  },
  charter: {
    label: "TAP e Escopo",
    fields: {
      justification: ["Justificativa", text, "textarea"],
      objective: ["Objetivo", text, "textarea"],
      sponsor: ["Patrocinador", text],
      manager: ["Gerente responsável (não concede acesso)", text],
      scope: ["Escopo inicial", text, "textarea"],
      exclusions: ["Exclusões", text, "textarea"],
      deliverables: ["Principais entregas", text, "textarea"],
      assumptions: ["Premissas", text, "textarea"],
      constraints: ["Restrições", text, "textarea"],
      success_criteria: ["Critérios de sucesso", text, "textarea"],
      initial_start_date: ["Início de referência", date, "date"],
      initial_end_date: ["Término de referência", date, "date"],
      initial_budget_cents: [
        "Orçamento inicial de referência (R$)",
        money,
        "money",
      ],
    },
  },
  phases: {
    label: "Fases",
    fields: {
      title: ["Nome da fase", required],
      position: [
        "Ordem",
        z.number().int().min(0).max(100000).default(0),
        "number",
      ],
    },
  },
  tasks: {
    label: "Atividades e marcos",
    fields: {
      title: ["Título", required],
      description: ["Descrição", text, "textarea"],
      phase_id: ["Fase", z.string().max(100).default(""), "phase"],
      responsible: ["Responsável", text],
      start_date: ["Início planejado", date, "date"],
      end_date: ["Término planejado", date, "date"],
      status: ["Situação", enumField(taskStatuses), taskStatuses],
      completed_date: ["Data de conclusão", date, "date"],
      kind: ["Tipo", enumField(["atividade", "marco"]), ["atividade", "marco"]],
    },
  },
  risks: {
    label: "Riscos",
    fields: {
      code: ["Identificador", required],
      description: ["Descrição", required, "textarea"],
      probability: ["Probabilidade", enumField(levels), levels],
      impact: ["Impacto", enumField(levels), levels],
      responsible: ["Responsável", text],
      response_plan: ["Plano de resposta", text, "textarea"],
      status: [
        "Situação",
        enumField(["Aberto", "Em tratamento", "Encerrado"]),
        ["Aberto", "Em tratamento", "Encerrado"],
      ],
    },
  },
  costs: {
    label: "Custos",
    fields: {
      category: ["Categoria", required],
      description: ["Descrição", required],
      planned_cents: ["Valor previsto (R$)", money, "money"],
      actual_cents: ["Valor realizado (R$)", money, "money"],
      date: ["Data", date, "date"],
      notes: ["Observações", text, "textarea"],
    },
  },
  quality: {
    label: "Qualidade",
    fields: {
      code: ["Identificador", required],
      requirement: ["Requisito", required, "textarea"],
      acceptance: ["Critério de aceitação", text, "textarea"],
      responsible: ["Responsável", text],
      result: ["Resultado da verificação", text, "textarea"],
      status: [
        "Situação",
        enumField(["Pendente", "Aprovado", "Reprovado"]),
        ["Pendente", "Aprovado", "Reprovado"],
      ],
      evidence_url: ["Evidência (URL)", url, "url"],
    },
  },
  stakeholders: {
    label: "Partes interessadas",
    fields: {
      name: ["Nome", required],
      organization: ["Organização", text],
      role: ["Função", text],
      contact: ["Contato", text],
      interest: ["Interesse", enumField(levels), levels],
      influence: ["Influência", enumField(levels), levels],
      notes: ["Observações", text, "textarea"],
    },
  },
  documents: {
    label: "Documentos",
    fields: {
      name: ["Nome", required],
      category: ["Categoria", text],
      description: ["Descrição", text, "textarea"],
      url: ["URL do arquivo", url.refine((v) => !!v, "URL obrigatória"), "url"],
    },
  },
};
export const tables = {
  projects: "projects",
  charter: "project_charters",
  phases: "project_phases",
  tasks: "project_tasks",
  risks: "project_risks",
  costs: "project_costs",
  quality: "project_quality_checks",
  stakeholders: "project_stakeholders",
  documents: "project_documents",
};
export function schemaFor(resource) {
  return z
    .object(
      Object.fromEntries(
        Object.entries(models[resource].fields).map(([k, v]) => [k, v[1]]),
      ),
    )
    .strict()
    .superRefine((v, c) => {
      for (const [a, b] of [
        ["start_date", "end_date"],
        ["initial_start_date", "initial_end_date"],
      ])
        if (v[a] && v[b] && v[a] > v[b])
          c.addIssue({
            code: "custom",
            path: [b],
            message: "Término anterior ao início",
          });
      if (resource === "tasks" && v.status === "Concluída" && !v.completed_date)
        c.addIssue({
          code: "custom",
          path: ["completed_date"],
          message: "Informe a data de conclusão",
        });
    });
}
export function riskPriority(r) {
  const score =
    (levels.indexOf(r.probability) + 1) * (levels.indexOf(r.impact) + 1);
  return { score, label: score >= 6 ? "Alta" : score >= 3 ? "Média" : "Baixa" };
}
