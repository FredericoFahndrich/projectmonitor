export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (v !== undefined && v !== null && v !== false)
      n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c !== null && c !== undefined)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
export const button = (label, fn, cls = "secondary") =>
  el("button", { type: "button", class: cls, onClick: fn }, label);
export const note = (message, kind = "info") =>
  el(
    "div",
    { class: `notice ${kind}`, role: kind === "error" ? "alert" : "status" },
    message,
  );
export function empty(message = "Nenhum registro cadastrado.") {
  return el(
    "div",
    { class: "empty" },
    el("span", { class: "empty-symbol", "aria-hidden": "true" }, "◇"),
    el("p", {}, message),
  );
}
export function table(headers, rows) {
  return el(
    "div",
    { class: "table-wrap" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          headers.map((h) => el("th", { scope: "col" }, h)),
        ),
      ),
      el(
        "tbody",
        {},
        rows.map((row) =>
          el(
            "tr",
            {},
            row.map((c) => el("td", {}, c)),
          ),
        ),
      ),
    ),
  );
}
export function modal(title, content) {
  const d = el(
    "dialog",
    {},
    el(
      "div",
      { class: "modal-title" },
      el("h2", {}, title),
      button("Fechar", () => d.close()),
    ),
    content,
  );
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}
export async function confirmAction(message) {
  return new Promise((resolve) => {
    const d = modal(
      "Confirmar operação",
      el(
        "div",
        {},
        el("p", {}, message),
        el(
          "div",
          { class: "actions" },
          button("Cancelar", () => {
            resolve(false);
            d.close();
          }),
          button(
            "Confirmar",
            () => {
              resolve(true);
              d.close();
            },
            "danger",
          ),
        ),
      ),
    );
    d.addEventListener("cancel", () => resolve(false));
    d.addEventListener("close", () => resolve(false));
  });
}
export async function busy(btn, task) {
  btn.disabled = true;
  try {
    await task();
  } finally {
    btn.disabled = false;
  }
}
