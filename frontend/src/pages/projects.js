import { api } from "../api/client.js";
import { el, button, note, empty, confirmAction } from "../components/ui.js";
import { editDialog } from "../components/forms.js";
import { date } from "../utils/format.js";
import { statuses } from "../../../shared/models.js";
export async function projectsPage(me) {
  const root = el("main", { class: "container" }),
    cards = el("div", { class: "project-grid" }),
    error = el("div"),
    search = el("input", {
      type: "search",
      placeholder: "Buscar projetos...",
      "aria-label": "Buscar projetos",
    }),
    filter = el(
      "select",
      { "aria-label": "Filtrar situação" },
      ["Todos", ...statuses].map((v) => el("option", {}, v)),
    ),
    archive = el("input", { type: "checkbox" });
  let rows = [];
  const render = () => {
    const filtered = rows.filter(
      (p) =>
        p.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()) &&
        (filter.value === "Todos" || p.status === filter.value),
    );
    cards.replaceChildren(
      ...filtered.map((p) =>
        el(
          "article",
          { class: "project-card" },
          el(
            "div",
            { class: "card-top" },
            el("span", { class: "project-icon", "aria-hidden": true }, "▤"),
            el("span", { class: "badge" }, p.status),
          ),
          el("h2", {}, el("a", { href: `#/projects/${p.id}` }, p.name)),
          el(
            "p",
            { class: "card-description" },
            p.description || "Sem descrição",
          ),
          el("div", { class: "muted" }, "Término previsto: ", date(p.end_date)),
          el(
            "div",
            { class: "progress-label" },
            "Progresso",
            el(
              "strong",
              {},
              p.progress === null ? "Não calculado" : `${p.progress}%`,
            ),
          ),
          p.progress === null
            ? null
            : el("progress", {
                value: p.progress,
                max: 100,
                "aria-label": "Progresso",
              }),
          me.admin
            ? el(
                "div",
                { class: "card-actions" },
                button("Editar", () =>
                  editDialog("projects", p, [], async (data) => {
                    await api(`/projects/${p.id}`, "PATCH", {
                      ...data,
                      version: p.version,
                    });
                    await load();
                  }),
                ),
                button(p.archived_at ? "Restaurar" : "Arquivar", async () => {
                  if (
                    await confirmAction(
                      p.archived_at
                        ? "Restaurar este projeto?"
                        : "Arquivar e ocultar da lista padrão, preservando os dados?",
                    )
                  )
                    await change(() =>
                      api(`/projects/${p.id}/archive`, "PUT", {
                        archived: !p.archived_at,
                        version: p.version,
                      }),
                    );
                }),
                button(
                  "Excluir",
                  async () => {
                    if (
                      await confirmAction(
                        "Excluir definitivamente o projeto, todos os registros de gestão e mensagens do chat coletivo? Conversas diretas e auditoria serão preservadas.",
                      )
                    )
                      await change(() =>
                        api(`/projects/${p.id}`, "DELETE", {
                          version: p.version,
                        }),
                      );
                  },
                  "danger-text",
                ),
              )
            : null,
        ),
      ),
    );
    if (!filtered.length)
      cards.append(
        empty(
          rows.length
            ? "Nenhum projeto corresponde à busca."
            : me.admin
              ? "Comece cadastrando seu primeiro projeto."
              : "Você ainda não recebeu acesso a projetos nesta listagem.",
        ),
      );
  };
  const change = async (fn) => {
    try {
      await fn();
      await load();
    } catch (e) {
      error.replaceChildren(note(e.message, "error"));
    }
  };
  const load = async () => {
    cards.replaceChildren(note("Carregando projetos..."));
    rows = await api(`/projects?archived=${archive.checked}`);
    render();
  };
  search.oninput = render;
  filter.onchange = render;
  archive.onchange = () => change(async () => {});
  root.append(
    el(
      "div",
      { class: "page-title" },
      el(
        "div",
        {},
        el("p", { class: "eyebrow" }, "SEU ESPAÇO DE TRABALHO"),
        el("h1", {}, "Meus Projetos"),
        el(
          "p",
          { class: "muted" },
          "Organize o planejamento e acompanhe cada entrega.",
        ),
      ),
      me.admin
        ? button(
            "+ Novo Projeto",
            () =>
              editDialog("projects", {}, [], async (data) => {
                await api("/projects", "POST", data);
                await load();
              }),
            "primary",
          )
        : null,
    ),
    el(
      "div",
      { class: "toolbar" },
      search,
      filter,
      el("label", { class: "check" }, archive, "Arquivados"),
    ),
    error,
    cards,
  );
  await load();
  return root;
}
