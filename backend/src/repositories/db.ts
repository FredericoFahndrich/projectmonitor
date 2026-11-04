import type { Env, Row } from "../types";
import { fail, now } from "../utils/http";
export const stmt = (e: Env, sql: string, args: any[] = []) =>
  e.DB.prepare(sql).bind(...args);
export const one = (e: Env, sql: string, args: any[] = []) =>
  stmt(e, sql, args).first<Row>();
export async function all(e: Env, sql: string, args: any[] = []) {
  return (await stmt(e, sql, args).all<Row>()).results;
}
export async function insert(e: Env, table: string, data: Row) {
  const keys = Object.keys(data);
  await stmt(
    e,
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    Object.values(data),
  ).run();
  return data;
}
export function version(v: unknown) {
  if (!Number.isSafeInteger(v) || Number(v) < 1)
    fail(400, "Versão obrigatória");
  return Number(v);
}
export async function update(
  e: Env,
  table: string,
  id: string,
  data: Row,
  v: unknown,
) {
  if (v === 0)
    fail(409, "Registro já criado por outra pessoa. Recarregue e revise.");
  const changes = { ...data, updated_at: now() };
  const r = await stmt(
    e,
    `UPDATE ${table} SET ${Object.keys(changes)
      .map((k) => `${k}=?`)
      .join(",")},version=version+1 WHERE id=? AND version=?`,
    [...Object.values(changes), id, version(v)],
  ).run();
  if (!r.meta.changes)
    fail(409, "Registro alterado por outra pessoa. Recarregue e revise.");
  return one(e, `SELECT * FROM ${table} WHERE id=?`, [id]);
}
