import { z } from "zod";
import type { Env, Actor, Row } from "../types";
import { active, projectAccess } from "../middleware/auth";
import { all, one, stmt } from "../repositories/db";
import { fail, body, json, now } from "../utils/http";
export async function eligible(e: Env, left: string, right: string) {
  if (left === right) return false;
  const people = await all(
    e,
    "SELECT uid,status FROM users WHERE uid IN (?,?)",
    [left, right],
  );
  if (
    people.length !== 2 ||
    people.some((u) => u.uid !== e.ADMIN_FIREBASE_UID && u.status !== "ativa")
  )
    return false;
  if (left === e.ADMIN_FIREBASE_UID || right === e.ADMIN_FIREBASE_UID)
    return true;
  return !!(await one(
    e,
    "SELECT 1 AS ok FROM project_members a JOIN project_members b ON a.project_id=b.project_id WHERE a.uid=? AND b.uid=? AND a.status='ativo' AND b.status='ativo' LIMIT 1",
    [left, right],
  ));
}
export async function conversationAccess(e: Env, a: Actor, id: string) {
  active(a);
  const c = await one(e, "SELECT * FROM conversations WHERE id=?", [id]);
  if (!c) fail(404, "Conversa não encontrada");
  if (c.type === "project") {
    await projectAccess(e, a, c.project_id);
    return c;
  }
  const members = await all(
    e,
    "SELECT uid FROM direct_conversation_members WHERE conversation_id=?",
    [id],
  );
  if (members.length !== 2 || !members.some((m) => m.uid === a.uid))
    fail(404, "Conversa não encontrada");
  const other = members.find((m) => m.uid !== a.uid)!;
  if (!(await eligible(e, a.uid, other.uid)))
    fail(404, "Conversa indisponível");
  return c;
}
function cursor(raw: string | null) {
  if (raw === null) return 0;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    fail(400, "Cursor inválido");
  return Number(raw);
}
export async function chat(
  req: Request,
  e: Env,
  a: Actor,
  p: string[],
  url: URL,
) {
  active(a);
  const method = req.method;
  if (p[1] === "chat" && p[2] === "eligible-users" && method === "GET") {
    const rows = await all(
      e,
      "SELECT uid,public_id,name FROM users WHERE (status='ativa' OR uid=?) AND uid<>?",
      [e.ADMIN_FIREBASE_UID || "", a.uid],
    );
    const result = [];
    for (const u of rows)
      if (await eligible(e, a.uid, u.uid))
        result.push({ public_id: u.public_id, name: u.name });
    return json(result);
  }
  if (!p[2] && method === "GET") {
    const candidates = await all(
      e,
      "SELECT c.* FROM conversations c WHERE c.type='project' OR EXISTS(SELECT 1 FROM direct_conversation_members m WHERE m.conversation_id=c.id AND m.uid=?) ORDER BY c.updated_at DESC,c.id",
      [a.uid],
    );
    const result = [];
    for (const c of candidates) {
      try {
        await conversationAccess(e, a, c.id);
      } catch (err: any) {
        if (err.status === 404) continue;
        throw err;
      }
      const unread = await one(
        e,
        "SELECT count(*) AS n FROM messages WHERE conversation_id=? AND author_uid<>? AND seq>COALESCE((SELECT last_seq FROM conversation_reads WHERE uid=? AND conversation_id=?),0)",
        [c.id, a.uid, a.uid, c.id],
      );
      let title;
      if (c.type === "project")
        title = (
          await one(e, "SELECT name FROM projects WHERE id=?", [c.project_id])
        )?.name;
      else
        title = (
          await one(
            e,
            "SELECT u.name FROM users u JOIN direct_conversation_members m ON m.uid=u.uid WHERE m.conversation_id=? AND u.uid<>?",
            [c.id, a.uid],
          )
        )?.name;
      result.push({ ...c, title, unread: unread!.n });
    }
    return json(result);
  }
  if (p[2] === "direct" && method === "POST") {
    const b = z
      .object({ recipient_public_id: z.string().uuid() })
      .strict()
      .parse(await body(req));
    const u = await one(e, "SELECT uid FROM users WHERE public_id=?", [
      b.recipient_public_id,
    ]);
    if (!u || !(await eligible(e, a.uid, u.uid)))
      fail(404, "Destinatário indisponível");
    const pair = JSON.stringify([a.uid, u.uid].sort()),
      id = crypto.randomUUID(),
      t = now();
    await e.DB.batch([
      stmt(
        e,
        "INSERT OR IGNORE INTO conversations(id,type,pair_key,created_at,updated_at) VALUES(?,'direct',?,?,?)",
        [id, pair, t, t],
      ),
      stmt(
        e,
        "INSERT OR IGNORE INTO direct_conversation_members(conversation_id,uid) SELECT id,? FROM conversations WHERE pair_key=?",
        [a.uid, pair],
      ),
      stmt(
        e,
        "INSERT OR IGNORE INTO direct_conversation_members(conversation_id,uid) SELECT id,? FROM conversations WHERE pair_key=?",
        [u.uid, pair],
      ),
    ]);
    return json(
      await one(e, "SELECT * FROM conversations WHERE pair_key=?", [pair]),
    );
  }
  const id = p[2];
  await conversationAccess(e, a, id);
  if (p[3] === "messages" && method === "GET") {
    const after = cursor(url.searchParams.get("after")),
      before = cursor(url.searchParams.get("before"));
    if (after && before) fail(400, "Use somente um cursor");
    const incremental = url.searchParams.has("after");
    const rows = await all(
      e,
      `SELECT m.id,m.seq,m.author_uid,m.text,m.client_id,m.created_at,u.name AS author_name FROM messages m JOIN users u ON u.uid=m.author_uid WHERE conversation_id=? ${incremental ? "AND seq>?" : before ? "AND seq<?" : ""} ORDER BY seq ${incremental ? "ASC" : "DESC"} LIMIT 51`,
      [id, ...(incremental ? [after] : before ? [before] : [])],
    );
    const has_more = rows.length > 50;
    const selected = rows.slice(0, 50);
    if (!incremental) selected.reverse();
    return json({
      items: selected,
      has_more,
      next_after: selected.at(-1)?.seq || after,
      next_before: selected[0]?.seq || before,
    });
  }
  if (p[3] === "messages" && method === "POST") {
    const b = z
      .object({
        text: z.string().trim().min(1).max(2000),
        client_id: z.string().uuid(),
      })
      .strict()
      .parse(await body(req));
    const previous = await one(
      e,
      "SELECT * FROM messages WHERE conversation_id=? AND author_uid=? AND client_id=?",
      [id, a.uid, b.client_id],
    );
    if (previous) {
      if (previous.text !== b.text)
        fail(409, "Identificador já usado com outro conteúdo");
      return json(previous);
    }
    const t = now(),
      mid = crypto.randomUUID(),
      since = new Date(Date.now() - 60000).toISOString();
    const result = await stmt(
      e,
      `INSERT OR IGNORE INTO messages(id,conversation_id,author_uid,text,client_id,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM messages WHERE author_uid=? AND created_at>?)<30`,
      [mid, id, a.uid, b.text, b.client_id, t, a.uid, since],
    ).run();
    const saved = await one(
      e,
      "SELECT * FROM messages WHERE conversation_id=? AND author_uid=? AND client_id=?",
      [id, a.uid, b.client_id],
    );
    if (!saved)
      fail(
        429,
        "Limite de 30 mensagens por minuto. Aguarde e tente novamente.",
      );
    if (saved.text !== b.text) fail(409, "Identificador já usado");
    if (result.meta.changes)
      await stmt(e, "UPDATE conversations SET updated_at=? WHERE id=?", [
        t,
        id,
      ]).run();
    return json(saved, 201);
  }
  if (p[3] === "read" && method === "PUT") {
    const b = z
      .object({ message_id: z.string().uuid() })
      .strict()
      .parse(await body(req));
    const m = await one(
      e,
      "SELECT seq FROM messages WHERE id=? AND conversation_id=?",
      [b.message_id, id],
    );
    if (!m) fail(404, "Mensagem não encontrada");
    await stmt(
      e,
      "INSERT INTO conversation_reads(uid,conversation_id,last_seq) VALUES(?,?,?) ON CONFLICT(uid,conversation_id) DO UPDATE SET last_seq=MAX(last_seq,excluded.last_seq)",
      [a.uid, id, m.seq],
    ).run();
    return json({ last_seq: m.seq });
  }
  fail(404, "Rota não encontrada");
}
