import { z } from "zod";
import type { Env, Actor, Row } from "../types";
import { admin } from "../middleware/auth";
import { all, one, stmt, version } from "../repositories/db";
import { fail, body, json, now } from "../utils/http";
export function auditStatement(
  e: Env,
  a: Actor,
  action: string,
  target: string | null,
  project: string | null,
  details: Row,
) {
  return stmt(
    e,
    "INSERT INTO admin_audit_logs(id,actor_uid,action,target_uid,project_id,details,created_at) VALUES(?,?,?,?,?,?,?)",
    [
      crypto.randomUUID(),
      a.uid,
      action,
      target,
      project,
      JSON.stringify(details),
      now(),
    ],
  );
}
export async function users(
  req: Request,
  e: Env,
  a: Actor,
  p: string[],
  url: URL,
) {
  admin(a);
  const method = req.method;
  const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(1000000)
      .parse(url.searchParams.get("page") || 1),
    offset = (page - 1) * 20;
  if (p[2] === "users" && !p[3] && method === "GET") {
    const q = `%${(url.searchParams.get("q") || "").slice(0, 200)}%`,
      status = url.searchParams.get("status") || "";
    const args = [q, q, status, status];
    const list = await all(
      e,
      "SELECT * FROM users WHERE (name LIKE ? OR email LIKE ?) AND (?='' OR status=?) ORDER BY created_at,uid LIMIT 20 OFFSET ?",
      [...args, offset],
    );
    for (const u of list) {
      u.is_admin = u.uid === e.ADMIN_FIREBASE_UID;
      u.memberships = await all(
        e,
        "SELECT m.*,p.name FROM project_members m JOIN projects p ON p.id=m.project_id WHERE m.uid=?",
        [u.uid],
      );
    }
    return json({
      items: list,
      page,
      total: (await one(
        e,
        "SELECT count(*) AS n FROM users WHERE (name LIKE ? OR email LIKE ?) AND (?='' OR status=?)",
        args,
      ))!.n,
    });
  }
  if (p[2] === "audit-logs" && method === "GET")
    return json({
      items: await all(
        e,
        "SELECT * FROM admin_audit_logs ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",
        [offset],
      ),
      page,
    });
  if (p[2] === "users" && p[3] && p[4] === "status" && method === "PATCH") {
    const uid = decodeURIComponent(p[3]);
    if (uid === e.ADMIN_FIREBASE_UID)
      fail(403, "O administrador não pode ser alterado pelo painel");
    const old = await one(e, "SELECT * FROM users WHERE uid=?", [uid]);
    if (!old) fail(404, "Usuário não encontrado");
    const b = z
      .object({
        status: z.enum(["pendente", "ativa", "bloqueada"]),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(await body(req));
    const auditId = crypto.randomUUID();
    // Audit existence guards revocation if the optimistic update conflicts.
    const results = await e.DB.batch([
      stmt(
        e,
        "UPDATE users SET status=?,version=version+1,updated_at=? WHERE uid=? AND version=?",
        [b.status, now(), uid, b.version],
      ),
      stmt(
        e,
        "INSERT INTO admin_audit_logs(id,actor_uid,action,target_uid,details,created_at) SELECT ?,?,'user.status',?,?,? WHERE changes()>0",
        [
          auditId,
          a.uid,
          uid,
          JSON.stringify({ from: old.status, to: b.status }),
          now(),
        ],
      ),
      stmt(
        e,
        "UPDATE project_members SET status='revogado',revoked_at=?,version=version+1 WHERE uid=? AND status='ativo' AND ?<>'ativa' AND EXISTS(SELECT 1 FROM admin_audit_logs WHERE id=?)",
        [now(), uid, b.status, auditId],
      ),
    ]);
    if (!results[0].meta.changes) fail(409, "Conta alterada. Recarregue.");
    return json(await one(e, "SELECT * FROM users WHERE uid=?", [uid]));
  }
  if (p[2] === "projects" && p[3] && p[4] === "members") {
    const id = p[3];
    if (!(await one(e, "SELECT id FROM projects WHERE id=?", [id])))
      fail(404, "Projeto não encontrado");
    if (method === "GET")
      return json(
        await all(
          e,
          "SELECT m.*,u.name,u.email FROM project_members m JOIN users u ON u.uid=m.uid WHERE project_id=?",
          [id],
        ),
      );
    const uid = decodeURIComponent(p[5] || "");
    const target = await one(e, "SELECT * FROM users WHERE uid=?", [uid]);
    if (!target) fail(404, "Usuário não encontrado");
    if (uid === e.ADMIN_FIREBASE_UID)
      fail(400, "Administrador já possui acesso global");
    const old = await one(
      e,
      "SELECT * FROM project_members WHERE project_id=? AND uid=?",
      [id, uid],
    );
    const b = await body(req);
    if (method === "PUT") {
      const parsed = z
        .object({
          role: z.enum(["gestor", "colaborador", "leitor"]),
          version: z.number().int().min(0),
        })
        .strict()
        .parse(b);
      if (target.status !== "ativa")
        fail(409, "Aprove a conta antes de conceder acesso");
      if ((old?.version || 0) !== parsed.version)
        fail(409, "Vínculo alterado. Recarregue.");
      const t = now();
      const result = await e.DB.batch([
        stmt(
          e,
          `INSERT INTO project_members(project_id,uid,role,status,granted_by,granted_at) SELECT ?,?,?,'ativo',?,? WHERE EXISTS(SELECT 1 FROM users WHERE uid=? AND status='ativa') ON CONFLICT(project_id,uid) DO UPDATE SET role=excluded.role,status='ativo',granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_at=NULL,version=project_members.version+1 WHERE project_members.version=?`,
          [id, uid, parsed.role, a.uid, t, uid, parsed.version],
        ),
        stmt(
          e,
          "INSERT INTO admin_audit_logs(id,actor_uid,action,target_uid,project_id,details,created_at) SELECT ?,?,'member.grant',?,?,?,? WHERE changes()>0",
          [
            crypto.randomUUID(),
            a.uid,
            uid,
            id,
            JSON.stringify({ from: old?.role || null, to: parsed.role }),
            t,
          ],
        ),
      ]);
      if (!result[0].meta.changes) fail(409, "Vínculo alterado. Recarregue.");
      return json({ saved: true });
    }
    if (method === "DELETE") {
      const v = version(b.version);
      const results = await e.DB.batch([
        stmt(
          e,
          "UPDATE project_members SET status='revogado',revoked_at=?,version=version+1 WHERE project_id=? AND uid=? AND version=?",
          [now(), id, uid, v],
        ),
        stmt(
          e,
          "INSERT INTO admin_audit_logs(id,actor_uid,action,target_uid,project_id,details,created_at) SELECT ?,?,'member.revoke',?,?,'{}',? WHERE changes()>0",
          [crypto.randomUUID(), a.uid, uid, id, now()],
        ),
      ]);
      if (!results[0].meta.changes) fail(409, "Vínculo alterado. Recarregue.");
      return json({ revoked: true });
    }
  }
  fail(404, "Rota não encontrada");
}
