import { api } from "../api/client.js";
import {
  el,
  button,
  note,
  empty,
  table,
  confirmAction,
} from "../components/ui.js";
import { editDialog, recordForm } from "../components/forms.js";
import { models, riskPriority, taskStatuses } from "../../../shared/models.js";
import { date, brl } from "../utils/format.js";
import { csv, charterTxt, projectJson, download } from "../exports/index.js";
import { conversationView } from "./chat.js";
export async function projectPage(id, tab = "overview", sub = "risks") {
  const p = await api(`/projects/${id}`),
    base = `/projects/${id}`,
    projectChat = await api(`${base}/chat`),
    root = el("main", { class: "container" }),
    content = el("section", { class: "panel" });
  let cleanup = () => {};
  const canWrite =
      ["admin", "gestor", "colaborador"].includes(p.role) && !p.archived_at,
    canDelete = ["admin", "gestor"].includes(p.role) && !p.archived_at,
    canExport = ["admin", "gestor"].includes(p.role);
  const exportAll = async () => {
    try {
      const data = await api(`${base}/export`);
      download(
        "projeto.json",
        projectJson(data),
        "application/json;charset=utf-8",
      );
    } catch (e) {
      content.prepend(note(e.message, "error"));
    }
  };
  root.append(
    el("a", { class: "breadcrumb", href: "#/projects" }, "Meus Projetos /"),
    el(
      "div",
      { class: "page-title" },
      el(
        "div",
        {},
        el("h1", {}, p.name),
        el("span", { class: "badge" }, p.status),
        p.archived_at ? el("span", { class: "badge" }, "Arquivado") : null,
      ),
      el(
        "div",
        { class: "actions" },
        canExport ? button("Exportar JSON", exportAll) : null,
        ["admin", "gestor"].includes(p.role) && !p.archived_at
          ? button("Editar projeto", () =>
              editDialog("projects", p, [], async (data) => {
                await api(base, "PATCH", { ...data, version: p.version });
                window.dispatchEvent(new Event("refresh-page"));
              }),
            )
          : null,
      ),
    ),
    el(
      "nav",
      { class: "tabs", "aria-label": "Áreas do projeto" },
      [
        ["overview", "Visão Geral"],
        ["charter", "TAP e Escopo"],
        ["tasks", "Cronograma"],
        ["control", "Gestão e Controle"],
        ["documents", "Documentos"],
        ["chat", "Chat"],
      ].map(([key, label]) =>
        el(
          "a",
          {
            href: `#/projects/${id}/${key}`,
            class: tab === key ? "active" : "",
          },
          label,
          key === "chat" && projectChat.unread > 0
            ? el(
                "span",
                { class: "badge", "data-chat-unread": true },
                `${projectChat.unread} não lidas`,
              )
            : null,
        ),
      ),
    ),
    ...(p.archived_at
      ? [
          note(
            "Projeto arquivado. Dados preservados; restauração disponível para o administrador.",
          ),
        ]
      : []),
    content,
  );
  if (tab === "overview") {
    const s = await api(`${base}/summary`);
    content.className = "overview";
    content.append(
      el(
        "div",
        { class: "metrics" },
        [
          [
            "Progresso",
            s.progress === null ? "Não calculado" : `${s.progress}%`,
            "Atividades concluídas / não canceladas",
          ],
          ["Prazo", date(s.deadline), "Término previsto no cadastro"],
          [
            "Custo",
            brl(s.actual_cents),
            `Orçamento vigente: ${brl(s.budget_cents)}`,
          ],
          ["Situação", s.status, "Informada pela gestão"],
        ].map(([title, value, caption]) =>
          el(
            "article",
            { class: "metric" },
            el("p", { class: "muted" }, title),
            el("strong", {}, value),
            el("small", {}, caption),
          ),
        ),
      ),
      el(
        "div",
        { class: "overview-grid" },
        el(
          "section",
          { class: "panel" },
          el("h2", {}, "Próximos marcos"),
          s.milestones.length
            ? table(
                ["Marco", "Data", "Situação"],
                s.milestones.map((t) => [t.title, date(t.end_date), t.status]),
              )
            : empty("Nenhum marco pendente."),
        ),
        el(
          "section",
          { class: "panel" },
          el("h2", {}, "Pendências"),
          el(
            "p",
            { class: "muted" },
            `Data de referência: ${date(s.today)} · próximos 7 dias`,
          ),
          ...[
            ["Atividades atrasadas", s.overdue],
            ["Próximas do vencimento", s.due_soon],
            ["Riscos de alta prioridade", s.high_risks],
          ].map(([label, items]) =>
            el(
              "div",
              { class: "pending-group" },
              el("h3", {}, `${label} (${items.length})`),
              items.length
                ? el(
                    "ul",
                    {},
                    items.map((i) => el("li", {}, i.title || i.description)),
                  )
                : el("p", { class: "muted" }, "Nenhuma pendência."),
            ),
          ),
        ),
      ),
    );
  } else if (tab === "charter") {
    const c = await api(`${base}/charter`);
    content.append(
      el(
        "div",
        { class: "section-title" },
        el("h2", {}, "Termo de Abertura do Projeto"),
        canExport
          ? button("Exportar TXT", async () => {
              const d = await api(`${base}/export`);
              download(
                "tap.txt",
                charterTxt(d.project, d.charter),
                "text/plain;charset=utf-8",
              );
            })
          : null,
      ),
      note(
        "Datas e orçamento deste TAP são referências iniciais independentes. Os indicadores usam o cadastro do projeto.",
      ),
    );
    const form = recordForm("charter", c || {}, [], async (data) => {
      const saved = await api(`${base}/charter`, "PUT", {
        ...data,
        version: c?.version || 0,
      });
      Object.assign(c || {}, saved);
      window.dispatchEvent(new Event("refresh-page"));
    });
    if (!canWrite)
      for (const control of form.querySelectorAll(
        "input,textarea,select,button",
      ))
        control.disabled = true;
    content.append(form);
  } else if (tab === "chat") {
    const c = projectChat;
    content.append(
      note(
        "O administrador tem acesso ao chat do projeto. Novos membros podem consultar o histórico. Mensagens ficam armazenadas no backend, sem criptografia de ponta a ponta.",
      ),
    );
    const view = await conversationView(c.id, async () =>
      root.querySelector("[data-chat-unread]")?.remove(),
    );
    content.append(view.node);
    cleanup = view.cleanup;
  } else {
    let resource =
      tab === "control"
        ? ["risks", "costs", "quality", "stakeholders"].includes(sub)
          ? sub
          : "risks"
        : tab === "tasks"
          ? "tasks"
          : "documents";
    if (tab === "control")
      content.append(
        el(
          "nav",
          { class: "subtabs" },
          ["risks", "costs", "quality", "stakeholders"].map((k) =>
            el(
              "a",
              {
                href: `#/projects/${id}/control/${k}`,
                class: k === resource ? "active" : "",
              },
              models[k].label,
            ),
          ),
        ),
      );
    const body = el("div");
    content.append(body);
    async function showResource(res) {
      try {
        await renderResource(res);
      } catch (error) {
        body.replaceChildren(
          note(error.message, "error"),
          button("Tentar novamente", () => showResource(res)),
        );
      }
    }
    async function renderResource(res) {
      body.replaceChildren(note("Carregando registros..."));
      const rows = await api(`${base}/${res}`),
        phases = res === "tasks" ? await api(`${base}/phases`) : [],
        today = res === "tasks" ? (await api(`${base}/summary`)).today : null,
        result = el("div"),
        error = el("div"),
        listing = el("div"),
        selects = [];
      const refresh = async () => {
        try {
          await renderResource(res);
        } catch (e) {
          body.replaceChildren(
            note(e.message, "error"),
            button("Tentar novamente", () => showResource(res)),
          );
        }
      };
      const add = () =>
        editDialog(res, {}, phases, async (data) => {
          await api(`${base}/${res}`, "POST", data);
          await refresh();
        });
      result.append(
        el(
          "div",
          { class: "section-title" },
          el("h2", {}, models[res].label),
          el(
            "div",
            { class: "actions" },
            res === "tasks"
              ? button("Gerenciar fases", () => showResource("phases"))
              : res === "phases"
                ? button("Voltar às atividades", () => showResource("tasks"))
                : null,
            canExport && res !== "documents" && res !== "phases"
              ? button("Exportar CSV", async () => {
                  try {
                    const d = await api(`${base}/export`);
                    download(
                      `${res}.csv`,
                      csv(res, d[res]),
                      "text/csv;charset=utf-8",
                    );
                  } catch (e) {
                    error.replaceChildren(note(e.message, "error"));
                  }
                })
              : null,
            canWrite ? button("+ Adicionar", add, "primary") : null,
          ),
        ),
        error,
      );
      if (res === "risks")
        result.append(
          note(
            "Matriz: probabilidade × impacto (1 a 3). Baixa: 1–2; média: 3–4; alta: 6–9.",
          ),
        );
      if (res === "documents")
        result.append(
          note(
            "Referências externas: o arquivo não é enviado nem armazenado na aplicação.",
          ),
        );
      if (res === "costs") {
        const planned = rows.reduce((s, r) => s + r.planned_cents, 0),
          actual = rows.reduce((s, r) => s + r.actual_cents, 0);
        result.append(
          el(
            "div",
            { class: "cost-totals" },
            `Previsto detalhado: ${brl(planned)} · Realizado: ${brl(actual)} · Diferença: ${brl(planned - actual)}`,
          ),
        );
      }
      const filters = el("div", { class: "toolbar" });
      if (res === "tasks") {
        for (const [key, label, options] of [
          ["phase_id", "Todas as fases", phases.map((p) => [p.id, p.title])],
          ["status", "Todas as situações", taskStatuses.map((s) => [s, s])],
        ]) {
          const select = el(
            "select",
            { "aria-label": label },
            el("option", { value: "" }, label),
            options.map(([v, t]) => el("option", { value: v }, t)),
          );
          selects.push([key, select]);
          select.onchange = draw;
          filters.append(select);
        }
      }
      if (res === "risks") {
        const select = el(
          "select",
          { "aria-label": "Prioridade" },
          ["Todas as prioridades", "Alta", "Média", "Baixa"].map((v, i) =>
            el("option", { value: i ? v : "" }, v),
          ),
        );
        selects.push(["priority", select]);
        select.onchange = draw;
        filters.append(select);
      }
      function draw() {
        const filtered = rows.filter((r) =>
          selects.every(
            ([k, s]) =>
              !s.value ||
              (k === "priority" ? riskPriority(r).label : r[k]) === s.value,
          ),
        );
        const keys = Object.keys(models[res].fields);
        listing.replaceChildren(
          filtered.length
            ? table(
                [
                  ...keys.map((k) => models[res].fields[k][0]),
                  ...(res === "risks" ? ["Prioridade"] : []),
                  "Ações",
                ],
                filtered.map((r) => [
                  ...keys.map((k) => {
                    const type = models[res].fields[k][2];
                    if (
                      res === "tasks" &&
                      k === "title" &&
                      r.end_date &&
                      r.end_date < today &&
                      !["Concluída", "Cancelada"].includes(r.status)
                    )
                      return el(
                        "div",
                        {},
                        r.title,
                        el("span", { class: "badge overdue" }, "Atrasada"),
                      );
                    if (type === "money") return brl(r[k]);
                    if (type === "date") return date(r[k]);
                    if (type === "phase")
                      return (
                        phases.find((p) => p.id === r[k])?.title || "Sem fase"
                      );
                    if (type === "url" && r[k])
                      return el(
                        "a",
                        {
                          href: r[k],
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                        "Abrir referência",
                      );
                    return r[k];
                  }),
                  ...(res === "risks" ? [riskPriority(r).label] : []),
                  el(
                    "div",
                    { class: "actions" },
                    canWrite
                      ? button("Editar", () =>
                          editDialog(res, r, phases, async (data) => {
                            await api(`${base}/${res}/${r.id}`, "PATCH", {
                              ...data,
                              version: r.version,
                            });
                            await refresh();
                          }),
                        )
                      : null,
                    canDelete
                      ? button(
                          "Excluir",
                          async () => {
                            if (await confirmAction("Excluir este registro?")) {
                              try {
                                await api(`${base}/${res}/${r.id}`, "DELETE", {
                                  version: r.version,
                                });
                                await refresh();
                              } catch (e) {
                                error.replaceChildren(note(e.message, "error"));
                              }
                            }
                          },
                          "danger-text",
                        )
                      : null,
                  ),
                ]),
              )
            : empty(),
        );
      }
      result.append(filters, listing);
      draw();
      body.replaceChildren(result);
    }
    await renderResource(resource);
  }
  return { node: root, cleanup };
}
