import { models, schemaFor } from "../../../shared/models.js";
import { el, button, note, modal } from "./ui.js";
import { cents } from "../utils/format.js";
export function recordForm(resource, record = {}, phases = [], save) {
  const fields = models[resource].fields,
    form = el("form", { class: "record-form" }),
    error = el("div", { "aria-live": "polite" });
  const inputs = {};
  for (const [key, [label, schema, type]] of Object.entries(fields)) {
    let input;
    const id = `f-${crypto.randomUUID()}`;
    if (Array.isArray(type) || type === "phase") {
      const values =
        type === "phase"
          ? [["", "Sem fase"], ...phases.map((p) => [p.id, p.title])]
          : type.map((v) => [v, v]);
      input = el(
        "select",
        { id, name: key },
        values.map(([v, l]) => el("option", { value: v }, l)),
      );
    } else
      input = el(type === "textarea" ? "textarea" : "input", {
        id,
        name: key,
        type: type === "money" ? "text" : type || "text",
        ...(type === "money" ? { inputmode: "decimal" } : {}),
        ...(type === "number" ? { min: 0, step: 1 } : {}),
        maxlength: 10000,
      });
    if (record[key] !== undefined && record[key] !== null)
      input.value =
        type === "money"
          ? (record[key] / 100).toFixed(2).replace(".", ",")
          : record[key];
    else if (type === "money" || type === "number") input.value = "0";
    input.required = !schema.safeParse(undefined).success;
    input.setAttribute("aria-label", label + (input.required ? " *" : ""));
    inputs[key] = input;
    const wrapper = el(
      "label",
      { for: id, class: type === "textarea" ? "wide" : "" },
      label + (input.required ? " *" : ""),
      input,
    );
    if (resource === "charter") {
      const group = el(
        "details",
        { open: true },
        el("summary", {}, label),
        wrapper,
      );
      form.append(group);
    } else form.append(wrapper);
  }
  const submit = el("button", { type: "submit", class: "primary" }, "Salvar"),
    cancel = button("Cancelar", () => {
      const dialog = form.closest("dialog");
      if (dialog) dialog.close();
      else window.dispatchEvent(new Event("refresh-page"));
    });
  form.append(
    el(
      "div",
      { class: "wide" },
      error,
      el("div", { class: "actions" }, cancel, submit),
    ),
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    error.replaceChildren();
    submit.disabled = true;
    try {
      const data = {};
      for (const [key, [, , type]] of Object.entries(fields)) {
        const value = inputs[key].value;
        data[key] =
          type === "money"
            ? cents(value)
            : type === "number"
              ? Number(value)
              : value;
      }
      const parsed = schemaFor(resource).parse(data);
      await save(parsed);
      const success = note("Registro salvo com sucesso.");
      success.classList.add("toast");
      document.body.append(success);
      setTimeout(() => success.remove(), 4000);
    } catch (err) {
      error.replaceChildren(
        note(
          err.issues
            ? err.issues.map((i) => i.message).join("; ")
            : err.message,
          "error",
        ),
      );
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}
export function editDialog(resource, record, phases, onSave) {
  let d;
  d = modal(
    record?.id ? "Editar registro" : `Cadastrar — ${models[resource].label}`,
    recordForm(resource, record, phases, async (data) => {
      await onSave(data);
      d.close();
    }),
  );
  return d;
}
