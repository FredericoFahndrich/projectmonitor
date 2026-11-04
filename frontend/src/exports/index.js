import { models } from "../../../shared/models.js";
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s\uFEFF]*[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function csv(resource, records) {
  const fields = models[resource].fields;
  return (
    "\uFEFF" +
    [
      Object.values(fields).map((v) => v[0]),
      ...records.map((r) =>
        Object.keys(fields).map((k) =>
          k.endsWith("_cents")
            ? (r[k] / 100).toFixed(2).replace(".", ",")
            : r[k],
        ),
      ),
    ]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n")
  );
}
export function charterTxt(project, charter) {
  return (
    `TERMO DE ABERTURA DO PROJETO\r\n${project.name}\r\n\r\n` +
    Object.entries(models.charter.fields)
      .map(
        ([k, [label]]) =>
          `${label}\r\n${k.endsWith("_cents") ? ((charter?.[k] || 0) / 100).toFixed(2) : charter?.[k] || "Não informado"}\r\n`,
      )
      .join("\r\n")
  );
}
export function projectJson(data) {
  return JSON.stringify(data, null, 2);
}
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
