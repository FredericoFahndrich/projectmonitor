export const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (v || 0) / 100,
  );
export const date = (v) =>
  v ? String(v).slice(0, 10).split("-").reverse().join("/") : "Não informado";
export const time = (v) => new Date(v).toLocaleString("pt-BR");
export function cents(v) {
  const s = String(v).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw Error("Valor monetário inválido. Use até duas casas decimais.");
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw Error("Valor muito grande");
  return n;
}
