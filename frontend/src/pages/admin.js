import { api } from "../api/client.js";
import {
  el,
  button,
  note,
  table,
  modal,
  confirmAction,
} from "../components/ui.js";
import { time } from "../utils/format.js";
export async function adminPage() {
  const root = el(
      "main",
      { class: "container" },
      el("h1", {}, "Administração de usuários"),
      note(
        "Aprovação não concede projetos. Bloqueio revoga vínculos e não exclui a conta Firebase. Leitores podem participar do chat.",
      ),
    ),
    body = el("section", { class: "panel" }),
    error = el("div"),
    search = el("input", {
      type: "search",
      placeholder: "Nome ou e-mail",
      "aria-label": "Buscar usuários",
    }),
    filter = el(
      "select",
      { "aria-label": "Situação" },
      ["", "pendente", "ativa", "bloqueada"].map((v) =>
        el("option", { value: v }, v || "Todas as situações"),
      ),
    );
  let page = 1;
  async function guarded(fn) {
    try {
      await fn();
    } catch (e) {
      error.replaceChildren(note(e.message, "error"));
    }
  }
  async function load() {
    const data = await api(
      `/admin/users?q=${encodeURIComponent(search.value)}&status=${filter.value}&page=${page}`,
    );
    body.replaceChildren(
      table(
        [
          "Usuário",
          "Situação",
          "Cadastro / último acesso",
          "Projetos",
          "Ações",
        ],
        data.items.map((u) => [
          el(
            "div",
            {},
            el("strong", {}, u.name),
            el("p", {}, u.email),
            el("details", {}, el("summary", {}, "UID Firebase"), u.uid),
          ),
          u.is_admin ? "Administrador global" : u.status,
          el("div", {}, time(u.created_at), el("br"), time(u.last_seen_at)),
          u.memberships
            .filter((m) => m.status === "ativo")
            .map((m) => `${m.name} (${m.role})`)
            .join(", ") || "Nenhum",
          u.is_admin
            ? el(
                "span",
                { class: "muted" },
                "Acesso global por configuração protegida",
              )
            : el(
                "div",
                { class: "actions" },
                ...["ativa", "pendente", "bloqueada"]
                  .filter((s) => s !== u.status)
                  .map((s) =>
                    button(
                      s === "ativa"
                        ? "Aprovar / reativar"
                        : s === "pendente"
                          ? "Manter pendente"
                          : "Bloquear",
                      () =>
                        guarded(async () => {
                          if (
                            s !== "ativa" &&
                            !(await confirmAction(
                              "Esta alteração impedirá acesso e revogará todos os vínculos. A conta Firebase será preservada. Continuar?",
                            ))
                          )
                            return;
                          await api(
                            `/admin/users/${encodeURIComponent(u.uid)}/status`,
                            "PATCH",
                            { status: s, version: u.version },
                          );
                          await load();
                        }),
                    ),
                  ),
                button("Acessos", () => guarded(() => membershipDialog(u))),
              ),
        ]),
      ),
      el(
        "div",
        { class: "pagination" },
        button("Anterior", () => {
          if (page > 1) {
            page--;
            guarded(load);
          }
        }),
        `Página ${page} · ${data.total} usuários`,
        button("Próxima", () => {
          if (page * 20 < data.total) {
            page++;
            guarded(load);
          }
        }),
      ),
    );
  }
  async function membershipDialog(u) {
    const projects = [
        ...(await api("/projects")),
        ...(await api("/projects?archived=true")),
      ],
      feedback = el("div"),
      list = el("div");
    const d = modal(
      `Acessos — ${u.name}`,
      el(
        "div",
        {},
        note(
          "Novos membros podem ler todo o histórico do chat coletivo. Gestores exportam e excluem registros; colaboradores editam; leitores consultam e conversam.",
        ),
        feedback,
        list,
      ),
    );
    async function show() {
      list.replaceChildren();
      for (const p of projects) {
        const members = await api(`/admin/projects/${p.id}/members`),
          m = members.find((m) => m.uid === u.uid),
          role = el(
            "select",
            { "aria-label": `Perfil em ${p.name}` },
            ["gestor", "colaborador", "leitor"].map((v) => el("option", {}, v)),
          );
        role.value = m?.role || "leitor";
        const action = async (fn) => {
          try {
            await fn();
            await show();
            await load();
          } catch (e) {
            feedback.replaceChildren(note(e.message, "error"));
          }
        };
        list.append(
          el(
            "div",
            { class: "membership" },
            el("strong", {}, p.name),
            el("span", {}, m?.status || "Sem acesso"),
            role,
            button("Conceder / alterar", () =>
              action(() =>
                api(
                  `/admin/projects/${p.id}/members/${encodeURIComponent(u.uid)}`,
                  "PUT",
                  { role: role.value, version: m?.version || 0 },
                ),
              ),
            ),
            m?.status === "ativo"
              ? button(
                  "Revogar",
                  () =>
                    action(async () => {
                      if (
                        await confirmAction(
                          "Revogar acesso ao projeto e ao chat coletivo? Conversas diretas dependem dos vínculos restantes.",
                        )
                      )
                        await api(
                          `/admin/projects/${p.id}/members/${encodeURIComponent(u.uid)}`,
                          "DELETE",
                          { version: m.version },
                        );
                    }),
                  "danger-text",
                )
              : null,
          ),
        );
      }
    }
    await show();
    return d;
  }
  const audit = async () => {
    let auditPage = 1;
    const list = el("div");
    const d = modal("Auditoria administrativa", list);
    async function render() {
      const data = await api(`/admin/audit-logs?page=${auditPage}`);
      list.replaceChildren(
        table(
          ["Horário", "Ator", "Ação", "Alvo / projeto", "Alteração"],
          data.items.map((r) => [
            time(r.created_at),
            r.actor_uid,
            r.action,
            `${r.target_uid || ""} ${r.project_id || ""}`,
            r.details,
          ]),
        ),
        el(
          "div",
          { class: "pagination" },
          button("Anterior", () => {
            if (auditPage > 1) {
              auditPage--;
              guarded(render);
            }
          }),
          `Página ${auditPage}`,
          button("Próxima", () => {
            if (data.items.length === 20) {
              auditPage++;
              guarded(render);
            }
          }),
        ),
      );
    }
    await render();
    return d;
  };
  root.append(
    el(
      "form",
      {
        class: "toolbar",
        onSubmit: (e) => {
          e.preventDefault();
          page = 1;
          guarded(load);
        },
      },
      search,
      filter,
      el("button", { type: "submit", class: "primary" }, "Buscar"),
      button("Consultar auditoria", () => guarded(audit)),
    ),
    error,
    body,
  );
  await load();
  return root;
}
