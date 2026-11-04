import { el, button, note } from "../components/ui.js";
import {
  configured,
  login,
  register,
  reset,
  google,
  authError,
} from "../auth/firebase.js";
export function loginPage() {
  const message = el("div", { "aria-live": "polite" }),
    email = el("input", {
      type: "email",
      id: "email",
      autocomplete: "email",
      required: true,
    }),
    password = el("input", {
      type: "password",
      id: "password",
      "aria-label": "Senha",
      autocomplete: "current-password",
      required: true,
      minlength: 6,
    });
  let mode = "login";
  const submit = el("button", { type: "submit", class: "primary" }, "Entrar");
  const action = async (fn) => {
    submit.disabled = true;
    message.replaceChildren();
    try {
      await fn();
    } catch (e) {
      message.replaceChildren(note(authError(e), "error"));
    } finally {
      submit.disabled = false;
    }
  };
  const form = el(
    "form",
    {
      onSubmit: (e) => {
        e.preventDefault();
        action(() =>
          mode === "register"
            ? register(email.value, password.value)
            : login(email.value, password.value),
        );
      },
    },
    el("label", { for: "email" }, "E-mail", email),
    el(
      "label",
      { for: "password" },
      "Senha",
      el(
        "div",
        { class: "password" },
        password,
        button("Mostrar", (e) => {
          const visible = password.type === "password";
          password.type = visible ? "text" : "password";
          e.currentTarget.textContent = visible ? "Ocultar" : "Mostrar";
        }),
      ),
    ),
    message,
    submit,
  );
  const card = el(
    "section",
    { class: "login-card" },
    el("div", { class: "logo-mark" }, "PM"),
    el("h1", {}, "Project Monitor"),
    el("p", { class: "muted" }, "Acompanhamento e gestão de projetos"),
    configured
      ? null
      : note(
          "Configuração pendente: preencha frontend/.env.local com os dados públicos do Firebase. Nenhum dado simulado está ativo.",
        ),
    form,
    button("Entrar com Google", () => action(google), "google"),
    el(
      "div",
      { class: "login-links" },
      button(
        "Esqueci minha senha",
        () => {
          if (!email.reportValidity()) return;
          action(async () => {
            await reset(email.value);
            message.replaceChildren(
              note(
                "Se houver uma conta para este e-mail, você receberá as instruções de recuperação.",
              ),
            );
          });
        },
        "link",
      ),
      button(
        "Criar conta",
        (e) => {
          mode = mode === "login" ? "register" : "login";
          submit.textContent = mode === "login" ? "Entrar" : "Criar conta";
          password.autocomplete =
            mode === "login" ? "current-password" : "new-password";
          e.currentTarget.textContent =
            mode === "login" ? "Criar conta" : "Já tenho conta";
        },
        "link",
      ),
    ),
  );
  if (!configured)
    for (const control of card.querySelectorAll("input,button"))
      control.disabled = true;
  return el(
    "main",
    { class: "login-layout" },
    card,
    el(
      "p",
      { class: "login-footer" },
      "Planeje com clareza. Acompanhe com confiança.",
    ),
  );
}
