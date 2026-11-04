import "./styles/main.css";
import { auth, observe, logout, verifyEmail } from "./auth/firebase.js";
import { api, clearRequests } from "./api/client.js";
import { el, button, note } from "./components/ui.js";
import { route } from "./router.js";
import { loginPage } from "./pages/login.js";
import { projectsPage } from "./pages/projects.js";
import { projectPage } from "./pages/project.js";
import { adminPage } from "./pages/admin.js";
import { messagesPage } from "./pages/chat.js";
const app = document.querySelector("#app");
let cleanup = () => {},
  generation = 0;
function clear() {
  generation++;
  cleanup();
  cleanup = () => {};
  clearRequests();
  for (const d of document.querySelectorAll("dialog")) d.remove();
  app.replaceChildren();
}
async function render() {
  clear();
  const run = generation;
  if (!auth?.currentUser) {
    app.append(loginPage());
    return;
  }
  app.append(note("Carregando seu espaço de trabalho..."));
  try {
    const me = await api("/me");
    if (run !== generation) return;
    const header = el(
      "header",
      { class: "topbar" },
      el(
        "a",
        { href: "#/projects", class: "brand" },
        el("span", { class: "logo-small" }, "PM"),
        "Project Monitor",
      ),
      el(
        "nav",
        {},
        el("a", { href: "#/projects" }, "Meus Projetos"),
        el("a", { href: "#/messages" }, "Mensagens"),
        me.admin
          ? el("a", { href: "#/admin/users" }, "Administração de usuários")
          : null,
      ),
      el(
        "div",
        { class: "user-menu" },
        el("span", {}, me.name),
        button("Sair", async () => {
          clear();
          await logout();
        }),
      ),
    );
    app.replaceChildren(header);
    if (!me.admin && (me.status !== "ativa" || !me.emailVerified)) {
      const box = el(
        "main",
        { class: "account-state" },
        el(
          "h1",
          {},
          me.status === "bloqueada"
            ? "Conta bloqueada"
            : me.status === "pendente"
              ? "Aguardando aprovação"
              : "Verifique seu e-mail",
        ),
        el(
          "p",
          {},
          me.status === "bloqueada"
            ? "Seu acesso à aplicação foi bloqueado. Sua conta Firebase não foi excluída."
            : me.status === "pendente"
              ? "Sua conta foi registrada. O administrador precisa aprová-la e conceder acesso aos projetos."
              : "Confirme o e-mail para acessar os projetos autorizados.",
        ),
        !me.emailVerified
          ? button("Reenviar verificação", async () => {
              try {
                await verifyEmail();
                box.append(note("E-mail de verificação enviado."));
              } catch {
                box.append(
                  note(
                    "Não foi possível reenviar agora. Aguarde e tente novamente.",
                    "error",
                  ),
                );
              }
            })
          : null,
        button("Verificar novamente", async () => {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          render();
        }),
      );
      app.append(box);
      return;
    }
    const p = route();
    let view;
    if (p[0] === "admin") {
      view = me.admin
        ? await adminPage()
        : note("Acesso exclusivo do administrador.", "error");
    } else if (p[0] === "messages") {
      view = await messagesPage(p[1]);
    } else if (p[0] === "projects" && p[1])
      view = await projectPage(p[1], p[2], p[3]);
    else view = await projectsPage(me);
    if (run !== generation) {
      view.cleanup?.();
      return;
    }
    cleanup = view.cleanup || (() => {});
    app.append(view.node || view);
  } catch (e) {
    if (run !== generation) return;
    app.append(
      note(e.message, "error"),
      button("Tentar novamente", render),
      button("Sair", () => logout()),
    );
  }
}
window.addEventListener("hashchange", render);
window.addEventListener("refresh-page", render);
window.addEventListener("access-lost", (e) => {
  clear();
  app.append(
    el(
      "main",
      { class: "account-state" },
      note(e.detail.message, "error"),
      button("Revalidar acesso", render),
      button("Sair", () => logout()),
    ),
  );
});
observe(render).catch(() =>
  app.replaceChildren(
    note("Não foi possível iniciar a autenticação.", "error"),
  ),
);
