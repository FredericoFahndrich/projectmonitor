import { api } from "../api/client.js";
import { el, button, note, empty } from "../components/ui.js";
import { time } from "../utils/format.js";
import { pollVisible } from "../utils/polling.js";
export async function conversationView(id, onRead = async () => {}) {
  const history = el("div", {
      class: "message-history",
      "aria-live": "polite",
    }),
    status = el("div"),
    text = el("textarea", {
      maxlength: 2000,
      required: true,
      rows: 3,
      "aria-label": "Sua mensagem",
      placeholder: "Escreva uma mensagem...",
    }),
    send = el("button", { type: "submit", class: "primary" }, "Enviar"),
    older = button("Carregar mensagens anteriores", () => loadOlder()),
    node = el("div", { class: "conversation" }, older, history, status);
  let stopped = false,
    busy = false,
    timer = null,
    delay = 5000,
    first = 0,
    last = 0,
    hasOlder = false,
    pendingMessage = null,
    sending = false;
  const messages = new Map();
  function draw() {
    history.replaceChildren(
      ...[...messages.values()]
        .sort((a, b) => a.seq - b.seq)
        .map((m) =>
          el(
            "article",
            { class: "message" },
            el(
              "div",
              { class: "message-meta" },
              el("strong", {}, m.author_name || "Você"),
              el("time", { datetime: m.created_at }, time(m.created_at)),
            ),
            el("p", {}, m.text),
          ),
        ),
    );
    older.hidden = !hasOlder;
  }
  async function receive(params = "") {
    const data = await api(`/conversations/${id}/messages${params}`);
    if (stopped) return null;
    for (const m of data.items) messages.set(m.seq, m);
    if (data.items.length) {
      first = Math.min(first || Infinity, data.items[0].seq);
      last = Math.max(last, data.items.at(-1).seq);
    }
    draw();
    return data;
  }
  async function mark() {
    if (stopped || document.hidden) return;
    const m = messages.get(last);
    if (m) await api(`/conversations/${id}/read`, "PUT", { message_id: m.id });
    if (!stopped) await onRead();
  }
  async function loadOlder() {
    if (busy || stopped) return;
    busy = true;
    try {
      const d = await receive(`?before=${first}`);
      if (d) {
        hasOlder = d.has_more;
        draw();
      }
    } catch (e) {
      status.replaceChildren(note(e.message, "error"));
    } finally {
      busy = false;
    }
  }
  async function poll() {
    clearTimeout(timer);
    if (stopped) return;
    if (document.hidden || busy) {
      timer = setTimeout(poll, delay);
      return;
    }
    busy = true;
    try {
      let more = true;
      while (more && !stopped) {
        const d = await receive(`?after=${last}`);
        more = !!d?.has_more;
      }
      await mark();
      delay = 5000;
    } catch (e) {
      if ([401, 403, 404].includes(e.status)) {
        cleanup();
        node.replaceChildren(note(e.message, "error"));
        return;
      }
      delay = Math.min(delay * 2, 60000);
      status.replaceChildren(
        note(
          "Falha ao atualizar. Nova tentativa automática em instantes.",
          "error",
        ),
      );
    } finally {
      busy = false;
      if (!stopped) timer = setTimeout(poll, delay);
    }
  }
  async function sendMessage(pending) {
    if (sending || stopped) return;
    sending = true;
    pendingMessage = pending;
    text.readOnly = true;
    send.disabled = true;
    status.replaceChildren(note("Enviando..."));
    try {
      await api(`/conversations/${id}/messages`, "POST", pending);
      if (stopped) return;
      text.value = "";
      pendingMessage = null;
      text.readOnly = false;
      send.textContent = "Enviar";
      status.replaceChildren(note("Mensagem enviada."));
      await poll();
    } catch (e) {
      if (!stopped)
        status.replaceChildren(
          note(e.message, "error"),
          button("Tentar novamente", () => sendMessage(pending)),
        );
    } finally {
      sending = false;
      send.disabled = false;
      if (pendingMessage) send.textContent = "Tentar envio novamente";
    }
  }
  const form = el(
    "form",
    {
      onSubmit: (e) => {
        e.preventDefault();
        const value = text.value.trim();
        if (value)
          sendMessage(
            pendingMessage || { text: value, client_id: crypto.randomUUID() },
          );
      },
    },
    text,
    el(
      "div",
      { class: "actions" },
      el(
        "small",
        { class: "muted" },
        "Até 2.000 caracteres · atualização a cada 5 segundos",
      ),
      send,
    ),
  );
  node.append(form);
  const visible = () => {
    if (!document.hidden) poll();
  };
  function cleanup() {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visible);
    messages.clear();
    pendingMessage = null;
    history.replaceChildren();
    text.value = "";
    status.replaceChildren();
  }
  try {
    const initial = await receive();
    hasOlder = !!initial?.has_more;
    draw();
    await mark();
    document.addEventListener("visibilitychange", visible);
    timer = setTimeout(poll, 5000);
  } catch (e) {
    cleanup();
    throw e;
  }
  return { node, cleanup };
}
export async function messagesPage(selected) {
  const root = el(
      "main",
      { class: "container" },
      el("h1", {}, "Mensagens"),
      note(
        "Conversas diretas são acessíveis somente aos dois participantes enquanto elegíveis. O administrador não recebe acesso às conversas de outras pessoas. Não há criptografia de ponta a ponta.",
      ),
    ),
    list = el("aside", { class: "conversation-list" }),
    panel = el("section", { class: "panel" }),
    recipients = await api("/chat/eligible-users"),
    conversations = (await api("/conversations")).filter(
      (c) => c.type === "direct",
    ),
    select = el(
      "select",
      { "aria-label": "Destinatário" },
      el("option", { value: "" }, "Selecione um destinatário"),
      recipients.map((r) =>
        el(
          "option",
          { value: r.public_id },
          `${r.name} · ${r.public_id.slice(0, 8)}`,
        ),
      ),
    ),
    error = el("div");
  let cleanup = () => {},
    disposed = false;
  root.append(
    el(
      "div",
      { class: "toolbar" },
      select,
      button(
        "Iniciar conversa",
        async () => {
          if (!select.value) return;
          try {
            const c = await api("/conversations/direct", "POST", {
              recipient_public_id: select.value,
            });
            location.hash = `#/messages/${c.id}`;
          } catch (e) {
            error.replaceChildren(note(e.message, "error"));
          }
        },
        "primary",
      ),
    ),
    error,
    el("div", { class: "chat-layout" }, list, panel),
  );
  function drawList(rows) {
    if (disposed) return;
    list.replaceChildren(
      ...rows.map((c) =>
        el(
          "a",
          {
            href: `#/messages/${c.id}`,
            class: c.id === selected ? "selected" : "",
          },
          c.title,
          el("span", { class: "badge" }, `${c.unread} não lidas`),
        ),
      ),
    );
    if (!rows.length) list.append(empty("Nenhuma conversa direta."));
  }
  async function refreshList() {
    const rows = await api("/conversations");
    drawList(rows.filter((c) => c.type === "direct"));
  }
  drawList(conversations);
  if (selected) {
    const view = await conversationView(selected, refreshList);
    panel.append(view.node);
    cleanup = view.cleanup;
  } else {
    panel.append(empty("Selecione uma conversa ou inicie uma nova."));
    cleanup = pollVisible(refreshList, (e) =>
      error.replaceChildren(note(e.message, "error")),
    );
  }
  return {
    node: root,
    cleanup: () => {
      disposed = true;
      cleanup();
      list.replaceChildren();
    },
  };
}
