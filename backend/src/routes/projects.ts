import { schemaFor, tables } from "../../../shared/models.js";
import type { Env, Actor, Row } from "../types";
import { active, admin, projectAccess } from "../middleware/auth";
import { all, one, stmt, insert, update, version } from "../repositories/db";
import { fail, body, json, now } from "../utils/http";
import { summarize, businessToday } from "../services/summary";
import { auditStatement } from "./users";
const resources = tables as Record<string, string>;
export async function managementData(e: Env, id: string) {
  const data: Row = {};
  for (const [key, table] of Object.entries(resources)) {
    if (key === "projects") continue;
    const rows = await all(
      e,
      `SELECT * FROM ${table} WHERE project_id=? ORDER BY created_at,id`,
      [id],
    );
    data[key] = key === "charter" ? rows[0] || null : rows;
  }
  return data;
}
export async function projects(
  req: Request,
  e: Env,
  a: Actor,
  parts: string[],
  url: URL,
) {
  active(a);
  const id = parts[2],
    resource = parts[3],
    rid = parts[4];
  const method = req.method;
  if (!id) {
    if (method === "GET") {
      const archived = url.searchParams.get("archived") === "true";
      const rows = await all(
        e,
        `SELECT p.* FROM projects p WHERE ${archived ? "p.archived_at IS NOT NULL" : "p.archived_at IS NULL"} ${a.admin ? "" : "AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.uid=? AND m.status='ativo')"} ORDER BY p.updated_at DESC`,
        a.admin ? [] : [a.uid],
      );
      for (const p of rows) {
        const t = await all(
          e,
          "SELECT * FROM project_tasks WHERE project_id=?",
          [p.id],
        );
        p.progress = summarize(
          p,
          t,
          [],
          [],
          businessToday(e.BUSINESS_TIMEZONE),
        ).progress;
      }
      return json(rows);
    }
    if (method === "POST") {
      admin(a);
      const data = schemaFor("projects").parse(await body(req));
      const t = now(),
        pid = crypto.randomUUID();
      await e.DB.batch([
        stmt(
          e,
          `INSERT INTO projects(id,owner_uid,name,description,start_date,end_date,status,budget_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
          [
            pid,
            a.uid,
            data.name,
            data.description,
            data.start_date,
            data.end_date,
            data.status,
            data.budget_cents,
            t,
            t,
          ],
        ),
        stmt(
          e,
          "INSERT INTO conversations(id,type,project_id,created_at,updated_at) VALUES(?,'project',?,?,?)",
          [crypto.randomUUID(), pid, t, t],
        ),
        auditStatement(e, a, "project.create", null, pid, {}),
      ]);
      return json(
        await one(e, "SELECT * FROM projects WHERE id=?", [pid]),
        201,
      );
    }
    fail(405, "Método não permitido");
  }
  const action =
    resource === "export"
      ? "export"
      : resource === "archive"
        ? "admin"
        : !resource
          ? method === "GET"
            ? "read"
            : method === "DELETE"
              ? "admin"
              : "edit"
          : method === "GET"
            ? "read"
            : method === "DELETE"
              ? "delete"
              : "write";
  const p = await projectAccess(e, a, id, action);
  if (!resource) {
    if (method === "GET") return json(p);
    if (method === "PATCH") {
      const { version: v, ...raw } = await body(req);
      return json(
        await update(e, "projects", id, schemaFor("projects").parse(raw), v),
      );
    }
    if (method === "DELETE") {
      const b = await body(req);
      const v = version(b.version);
      if (p.version !== v) fail(409, "Projeto alterado. Recarregue.");
      const results = await e.DB.batch([
        stmt(e, "DELETE FROM projects WHERE id=? AND version=?", [id, v]),
        stmt(
          e,
          `INSERT INTO admin_audit_logs(id,actor_uid,action,target_uid,project_id,details,created_at) SELECT ?,?,'project.delete',NULL,?,'{}',? WHERE changes()>0`,
          [crypto.randomUUID(), a.uid, id, now()],
        ),
      ]);
      if (!results[0].meta.changes) fail(409, "Projeto alterado. Recarregue.");
      return json({ deleted: true });
    }
  }
  if (resource === "archive" && method === "PUT") {
    const b = await body(req);
    if (typeof b.archived !== "boolean") fail(400, "Estado inválido");
    const v = version(b.version);
    const results = await e.DB.batch([
      stmt(
        e,
        "UPDATE projects SET archived_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?",
        [b.archived ? now() : null, now(), id, v],
      ),
      stmt(
        e,
        "INSERT INTO admin_audit_logs(id,actor_uid,action,project_id,details,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0",
        [
          crypto.randomUUID(),
          a.uid,
          b.archived ? "project.archive" : "project.restore",
          id,
          "{}",
          now(),
        ],
      ),
    ]);
    if (!results[0].meta.changes) fail(409, "Projeto alterado. Recarregue.");
    return json(await one(e, "SELECT * FROM projects WHERE id=?", [id]));
  }
  if (resource === "summary" && method === "GET") {
    const d = await managementData(e, id);
    return json(
      summarize(
        p,
        d.tasks,
        d.costs,
        d.risks,
        businessToday(e.BUSINESS_TIMEZONE),
      ),
    );
  }
  if (resource === "export" && method === "GET") {
    const { role, ...project } = p;
    return json({
      schema_version: 1,
      exported_at: now(),
      scope:
        "Dados de gestão; não inclui chats, usuários globais ou auditoria.",
      project,
      ...(await managementData(e, id)),
    });
  }
  if (resource === "chat" && method === "GET") {
    const c = await one(e, "SELECT * FROM conversations WHERE project_id=?", [
      id,
    ]);
    if (!c) fail(404, "Conversa não encontrada");
    const unread = await one(
      e,
      "SELECT count(*) AS n FROM messages WHERE conversation_id=? AND author_uid<>? AND seq>COALESCE((SELECT last_seq FROM conversation_reads WHERE uid=? AND conversation_id=?),0)",
      [c.id, a.uid, a.uid, c.id],
    );
    return json({ ...c, unread: unread!.n });
  }
  const table = resources[resource];
  if (!table || resource === "projects") fail(404, "Recurso não encontrado");
  const existing =
    resource === "charter"
      ? await one(e, `SELECT * FROM ${table} WHERE project_id=?`, [id])
      : rid
        ? await one(e, `SELECT * FROM ${table} WHERE project_id=? AND id=?`, [
            id,
            rid,
          ])
        : null;
  if (rid && !existing) fail(404, "Registro não encontrado");
  if (method === "GET")
    return json(
      resource === "charter"
        ? existing
        : rid
          ? existing
          : await all(
              e,
              `SELECT * FROM ${table} WHERE project_id=? ORDER BY ${resource === "phases" ? "position," : ""}created_at,id`,
              [id],
            ),
    );
  if (method === "DELETE" && existing) {
    const b = await body(req);
    if (
      resource === "phases" &&
      (await one(e, "SELECT id FROM project_tasks WHERE phase_id=? LIMIT 1", [
        existing.id,
      ]))
    )
      fail(409, "Mova as atividades antes de excluir esta fase");
    const r = await stmt(
      e,
      `DELETE FROM ${table} WHERE id=? AND project_id=? AND version=?`,
      [existing.id, id, version(b.version)],
    ).run();
    if (!r.meta.changes) fail(409, "Registro alterado. Recarregue.");
    return json({ deleted: true });
  }
  if (
    (method === "POST" && !rid && resource !== "charter") ||
    (method === "PATCH" && existing) ||
    (method === "PUT" && resource === "charter")
  ) {
    const { version: v, ...raw } = await body(req);
    const data: Row = schemaFor(resource).parse(raw);
    if (resource === "tasks") {
      if (
        data.phase_id &&
        !(await one(
          e,
          "SELECT id FROM project_phases WHERE id=? AND project_id=?",
          [data.phase_id, id],
        ))
      )
        fail(400, "Fase inválida");
      data.phase_id = data.phase_id || null;
    }
    if (existing) return json(await update(e, table, existing.id, data, v));
    if (v !== undefined && v !== 0)
      fail(409, "Registro inexistente. Recarregue.");
    const row = {
      id: crypto.randomUUID(),
      project_id: id,
      ...data,
      version: 1,
      created_at: now(),
      updated_at: now(),
    };
    try {
      await insert(e, table, row);
    } catch (error) {
      if (resource === "charter")
        fail(409, "TAP criado por outra pessoa. Recarregue.");
      throw error;
    }
    return json(row, 201);
  }
  fail(405, "Método não permitido");
}
