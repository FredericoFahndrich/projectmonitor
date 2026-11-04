import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createHandler } from "../src/index";
import { HttpError } from "../src/utils/http";
import { validateAccount, verifyIdentity } from "../src/middleware/auth";
import { summarize, businessToday } from "../src/services/summary";
import type { Env } from "../src/types";
let mf: Miniflare, e: Env;
const handler = createHandler(async (req) => {
  const uid = req.headers.get("x-test-user");
  if (!uid || uid === "invalid")
    throw new HttpError(401, "Identidade inválida");
  return {
    uid,
    email: `${uid}@example.test`,
    name: uid,
    emailVerified: uid !== "unverified",
  };
});
async function request(uid: string, path: string, method = "GET", data?: any) {
  const response = await handler(
    new Request(`http://local/api${path}`, {
      method,
      headers: { "x-test-user": uid, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    e,
  );
  const result = (await response.json()) as any;
  return { status: response.status, ...result };
}
async function ok(uid: string, path: string, method = "GET", data?: any) {
  const r = await request(uid, path, method, data);
  assert.ok(
    r.status >= 200 && r.status < 300,
    `${method} ${path}: ${JSON.stringify(r)}`,
  );
  return r.data;
}
async function approve(uid: string) {
  const me = await ok(uid, "/me");
  return ok("admin", `/admin/users/${uid}/status`, "PATCH", {
    status: "ativa",
    version: me.version,
  });
}
async function grant(pid: string, uid: string, role = "leitor", version = 0) {
  return ok("admin", `/admin/projects/${pid}/members/${uid}`, "PUT", {
    role,
    version,
  });
}
const projectData = { name: "Projeto de teste", status: "Planejamento" };
before(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: "2026-01-01",
    d1Databases: ["DB"],
  });
  const db = await mf.getD1Database("DB");
  for (const file of ["0001_core.sql", "0002_chat.sql"])
    await db.exec(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  e = {
    DB: db as unknown as D1Database,
    FIREBASE_PROJECT_ID: "",
    FIREBASE_WEB_API_KEY: "",
    ADMIN_FIREBASE_UID: "admin",
    ALLOWED_ORIGINS: "http://localhost:5173",
    BUSINESS_TIMEZONE: "America/Sao_Paulo",
  };
});
after(async () => {
  await mf?.dispose();
});
test("identidade: sem token, inválido, conta excluída, desativada e sessão revogada", async () => {
  assert.equal((await request("", "/projects")).status, 401);
  assert.equal((await request("invalid", "/projects")).status, 401);
  await assert.rejects(
    () => verifyIdentity(new Request("http://local"), e),
    (err: any) => err.status === 401,
  );
  await assert.rejects(
    () =>
      verifyIdentity(
        new Request("http://local", {
          headers: { Authorization: "Bearer fake" },
        }),
        { ...e, FIREBASE_PROJECT_ID: "test", FIREBASE_WEB_API_KEY: "test" },
      ),
    (err: any) => err.status === 401,
  );
  for (const account of [
    null,
    { localId: "u", disabled: true, validSince: "0" },
    { localId: "u", validSince: "101" },
    { localId: "other", validSince: "0" },
    { localId: "u" },
  ])
    assert.throws(() => validateAccount({ sub: "u", auth_time: 100 }, account));
  validateAccount(
    { sub: "u", auth_time: 100 },
    { localId: "u", validSince: "100" },
  );
});
test("cadastro pendente, UID administrativo explícito, aprovação sem vínculo e e-mail não verificado", async () => {
  const me = await ok("new", "/me");
  assert.equal(me.status, "pendente");
  assert.equal(me.admin, false);
  assert.equal((await request("new", "/projects")).status, 403);
  assert.equal((await request("new", "/admin/users")).status, 403);
  await approve("new");
  assert.deepEqual(await ok("new", "/projects"), []);
  assert.equal((await ok("admin", "/me")).admin, true);
  const noAdmin = await createHandler(async () => ({
    uid: "admin",
    name: "x",
    email: "x",
    emailVerified: true,
  }))(new Request("http://local/api/me"), { ...e, ADMIN_FIREBASE_UID: "" });
  assert.equal(((await noAdmin.json()) as any).data.admin, false);
  await approve("unverified");
  assert.equal((await request("unverified", "/projects")).status, 403);
  assert.equal(
    (
      await request("new", "/projects", "POST", {
        ...projectData,
        owner_uid: "admin",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("admin", "/projects", "POST", {
        ...projectData,
        owner_uid: "new",
      })
    ).status,
    400,
  );
});
test("CRUD, matriz de perfis, isolamento, conflitos, arquivamento e exportação", async () => {
  for (const uid of ["manager", "collab", "reader", "outsider"])
    await approve(uid);
  const p = await ok("admin", "/projects", "POST", projectData);
  await grant(p.id, "manager", "gestor");
  await grant(p.id, "collab", "colaborador");
  await grant(p.id, "reader");
  assert.equal((await request("outsider", `/projects/${p.id}`)).status, 404);
  assert.equal((await request("reader", `/projects/${p.id}`)).status, 200);
  for (const uid of ["manager", "collab", "reader"])
    assert.equal(
      (await request(uid, "/projects", "POST", projectData)).status,
      403,
    );
  assert.equal(
    (
      await request("collab", `/projects/${p.id}`, "PATCH", {
        ...projectData,
        version: 1,
      })
    ).status,
    403,
  );
  const edited = await ok("manager", `/projects/${p.id}`, "PATCH", {
    ...projectData,
    name: "Editado",
    version: 1,
  });
  assert.equal(edited.version, 2);
  assert.equal(
    (
      await request("manager", `/projects/${p.id}`, "PATCH", {
        ...projectData,
        version: 1,
      })
    ).status,
    409,
  );
  const phase = await ok("collab", `/projects/${p.id}/phases`, "POST", {
    title: "Preparação",
    position: 1,
  });
  assert.equal(
    (
      await request("reader", `/projects/${p.id}/phases`, "POST", {
        title: "x",
      })
    ).status,
    403,
  );
  const task = await ok("collab", `/projects/${p.id}/tasks`, "POST", {
    title: "Atividade",
    phase_id: phase.id,
    status: "Não iniciada",
    kind: "atividade",
  });
  const other = await ok("admin", "/projects", "POST", projectData);
  assert.equal(
    (await request("admin", `/projects/${other.id}/tasks/${task.id}`)).status,
    404,
  );
  assert.equal(
    (
      await request("admin", `/projects/${other.id}/tasks`, "POST", {
        title: "cross",
        phase_id: phase.id,
        status: "Não iniciada",
        kind: "atividade",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("collab", `/projects/${p.id}/tasks/${task.id}`, "DELETE", {
        version: 1,
      })
    ).status,
    403,
  );
  await ok("manager", `/projects/${p.id}/tasks/${task.id}`, "PATCH", {
    title: "Atividade",
    phase_id: phase.id,
    status: "Concluída",
    completed_date: "2026-01-01",
    kind: "atividade",
    version: 1,
  });
  await ok("collab", `/projects/${p.id}/charter`, "PUT", {
    objective: "Objetivo persistido",
    version: 0,
  });
  assert.equal(
    (await ok("reader", `/projects/${p.id}/charter`)).objective,
    "Objetivo persistido",
  );
  assert.equal(
    (
      await request("collab", `/projects/${p.id}/charter`, "PUT", {
        objective: "Conflito",
        version: 0,
      })
    ).status,
    409,
  );
  const cost = await ok("collab", `/projects/${p.id}/costs`, "POST", {
    category: "Teste",
    description: "Custo",
    actual_cents: 12345,
    planned_cents: 15000,
  });
  assert.equal(cost.actual_cents, 12345);
  await ok("collab", `/projects/${p.id}/risks`, "POST", {
    code: "R01",
    description: "Risco",
    probability: "Alta",
    impact: "Alta",
    status: "Em tratamento",
  });
  const summary = await ok("reader", `/projects/${p.id}/summary`);
  assert.equal(summary.progress, 100);
  assert.equal(summary.actual_cents, 12345);
  assert.equal(summary.high_risks.length, 1);
  for (const uid of ["collab", "reader"])
    assert.equal((await request(uid, `/projects/${p.id}/export`)).status, 403);
  const exported = await ok("manager", `/projects/${p.id}/export`);
  assert.equal(exported.schema_version, 1);
  assert.equal(exported.tasks[0].project_id, p.id);
  for (const forbidden of [
    "messages",
    "users",
    "conversations",
    "admin_audit_logs",
  ])
    assert.equal(exported[forbidden], undefined);
  assert.equal(
    (
      await request("manager", `/projects/${p.id}/archive`, "PUT", {
        archived: true,
        version: 2,
      })
    ).status,
    403,
  );
  await ok("admin", `/projects/${p.id}/archive`, "PUT", {
    archived: true,
    version: 2,
  });
  assert.ok(!(await ok("admin", "/projects")).some((r: any) => r.id === p.id));
  assert.ok(
    (await ok("reader", "/projects?archived=true")).some(
      (r: any) => r.id === p.id,
    ),
  );
  assert.equal(
    (
      await request("manager", `/projects/${p.id}/tasks`, "POST", {
        title: "x",
      })
    ).status,
    409,
  );
  await ok("admin", `/projects/${p.id}/archive`, "PUT", {
    archived: false,
    version: 3,
  });
  await ok("manager", `/projects/${p.id}/tasks/${task.id}`, "DELETE", {
    version: 2,
  });
  await ok("manager", `/projects/${p.id}/phases/${phase.id}`, "DELETE", {
    version: 1,
  });
  await ok("admin", `/projects/${p.id}`, "DELETE", { version: 4 });
  assert.equal((await request("admin", `/projects/${p.id}`)).status, 404);
});
test("CRUD de qualidade, partes interessadas, documentos; validação e datas", async () => {
  const p = await ok("admin", "/projects", "POST", projectData);
  for (const [resource, data] of Object.entries({
    quality: { code: "Q1", requirement: "Inspeção", status: "Pendente" },
    stakeholders: { name: "Pessoa", interest: "Alta", influence: "Baixa" },
    documents: { name: "Referência", url: "https://example.test/á" },
  })) {
    const row = await ok(
      "admin",
      `/projects/${p.id}/${resource}`,
      "POST",
      data,
    );
    assert.equal(
      (await ok("admin", `/projects/${p.id}/${resource}`)).length,
      1,
    );
    await ok("admin", `/projects/${p.id}/${resource}/${row.id}`, "PATCH", {
      ...data,
      version: 1,
    });
    await ok("admin", `/projects/${p.id}/${resource}/${row.id}`, "DELETE", {
      version: 2,
    });
    assert.deepEqual(await ok("admin", `/projects/${p.id}/${resource}`), []);
  }
  assert.equal(
    (
      await request("admin", `/projects/${p.id}/documents`, "POST", {
        name: "XSS",
        url: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("admin", "/projects", "POST", {
        ...projectData,
        start_date: "2026-02-30",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("admin", "/projects", "POST", {
        ...projectData,
        start_date: "2026-02-20",
        end_date: "2026-01-01",
      })
    ).status,
    400,
  );
});
test("chat direto privado, revogação imediata, idempotência, paginação, leitura e rate limit", async () => {
  for (const uid of ["alice", "bob", "charlie"]) await approve(uid);
  const p = await ok("admin", "/projects", "POST", projectData);
  await grant(p.id, "alice");
  await grant(p.id, "bob");
  await grant(p.id, "charlie");
  const eligible = await ok("alice", "/chat/eligible-users");
  assert.ok(eligible.every((u: any) => !u.email && !u.uid));
  const recipient = eligible.find((u: any) => u.name === "bob");
  const c = await ok("alice", "/conversations/direct", "POST", {
    recipient_public_id: recipient.public_id,
  });
  assert.equal(
    (
      await ok("alice", "/conversations/direct", "POST", {
        recipient_public_id: recipient.public_id,
      })
    ).id,
    c.id,
  );
  for (const uid of ["admin", "charlie"])
    assert.equal(
      (await request(uid, `/conversations/${c.id}/messages`)).status,
      404,
    );
  const payload = {
    text: "<img src=x onerror=alert(1)>",
    client_id: crypto.randomUUID(),
  };
  const m = await ok(
    "alice",
    `/conversations/${c.id}/messages`,
    "POST",
    payload,
  );
  assert.equal(
    (await ok("alice", `/conversations/${c.id}/messages`, "POST", payload)).id,
    m.id,
  );
  assert.equal(
    (await ok("bob", `/conversations/${c.id}/messages`)).items.length,
    1,
  );
  assert.equal(
    (
      await request("alice", `/conversations/${c.id}/messages`, "POST", {
        ...payload,
        text: "diferente",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("alice", `/conversations/${c.id}/messages`, "POST", {
        text: " ",
        client_id: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("alice", `/conversations/${c.id}/messages`, "POST", {
        text: "x".repeat(2001),
        client_id: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (await ok("bob", "/conversations")).find((r: any) => r.id === c.id).unread,
    1,
  );
  await ok("bob", `/conversations/${c.id}/read`, "PUT", { message_id: m.id });
  assert.equal(
    (await ok("bob", "/conversations")).find((r: any) => r.id === c.id).unread,
    0,
  );
  const collective = await ok("alice", `/projects/${p.id}/chat`);
  const pm = await ok(
    "admin",
    `/conversations/${collective.id}/messages`,
    "POST",
    { text: "Projeto", client_id: crypto.randomUUID() },
  );
  assert.equal(
    (
      await request("bob", `/conversations/${c.id}/read`, "PUT", {
        message_id: pm.id,
      })
    ).status,
    404,
  );
  for (let i = 0; i < 29; i++)
    await ok("alice", `/conversations/${c.id}/messages`, "POST", {
      text: `A${i}`,
      client_id: crypto.randomUUID(),
    });
  assert.equal(
    (
      await request("alice", `/conversations/${c.id}/messages`, "POST", {
        text: "limite",
        client_id: crypto.randomUUID(),
      })
    ).status,
    429,
  );
  for (let i = 0; i < 25; i++)
    await ok("bob", `/conversations/${c.id}/messages`, "POST", {
      text: `B${i}`,
      client_id: crypto.randomUUID(),
    });
  const latest = await ok("bob", `/conversations/${c.id}/messages`);
  assert.equal(latest.items.length, 50);
  assert.equal(latest.has_more, true);
  const previous = await ok(
    "bob",
    `/conversations/${c.id}/messages?before=${latest.next_before}`,
  );
  assert.equal(previous.items.length, 5);
  assert.equal(
    new Set([...previous.items, ...latest.items].map((m) => m.id)).size,
    55,
  );
  const inc = await ok("bob", `/conversations/${c.id}/messages?after=0`);
  assert.equal(inc.has_more, true);
  const inc2 = await ok(
    "bob",
    `/conversations/${c.id}/messages?after=${inc.next_after}`,
  );
  assert.equal(inc2.items.length, 5);
  await ok("admin", `/admin/projects/${p.id}/members/bob`, "DELETE", {
    version: 1,
  });
  assert.equal(
    (await request("bob", `/conversations/${collective.id}/messages`)).status,
    404,
  );
  for (const uid of ["alice", "bob"]) {
    assert.equal(
      (await request(uid, `/conversations/${c.id}/messages`)).status,
      404,
    );
    assert.ok(
      !(await ok(uid, "/conversations")).some((r: any) => r.id === c.id),
    );
  }
  await grant(p.id, "bob", "leitor", 2);
  assert.equal(
    (await ok("bob", `/conversations/${c.id}/messages`)).items.length,
    50,
  );
  const b = await ok("bob", "/me");
  await ok("admin", "/admin/users/bob/status", "PATCH", {
    status: "bloqueada",
    version: b.version,
  });
  assert.equal((await request("bob", `/projects/${p.id}`)).status, 403);
  assert.equal(
    (await request("alice", `/conversations/${c.id}/messages`)).status,
    404,
  );
  const blocked = await ok("bob", "/me");
  await ok("admin", "/admin/users/bob/status", "PATCH", {
    status: "ativa",
    version: blocked.version,
  });
  assert.equal((await request("bob", `/projects/${p.id}`)).status, 404);
  await ok("admin", `/projects/${p.id}`, "DELETE", { version: 1 });
  assert.equal(
    (
      await e.DB.prepare("SELECT count(*) AS n FROM conversations WHERE id=?")
        .bind(c.id)
        .first<any>()
    ).n,
    1,
  );
  assert.equal(
    (
      await e.DB.prepare("SELECT count(*) AS n FROM conversations WHERE id=?")
        .bind(collective.id)
        .first<any>()
    ).n,
    0,
  );
  const audit = await ok("admin", "/admin/audit-logs");
  assert.ok(audit.items.length);
  assert.ok(!JSON.stringify(audit).includes(payload.text));
});
test("indicadores: canceladas, marcos, janela inclusiva de sete dias e fuso", () => {
  const tasks = [
    { kind: "atividade", status: "Concluída" },
    { kind: "atividade", status: "Cancelada" },
    { kind: "marco", status: "Concluída" },
    { kind: "atividade", status: "Bloqueada", end_date: "2026-11-01" },
    { kind: "atividade", status: "Não iniciada", end_date: "2026-11-02" },
    { kind: "atividade", status: "Em andamento", end_date: "2026-11-09" },
    { kind: "atividade", status: "Em andamento", end_date: "2026-11-10" },
  ];
  const s = summarize(
    {},
    tasks,
    [
      { actual_cents: 10, planned_cents: 20 },
      { actual_cents: 20, planned_cents: 30 },
    ],
    [],
    "2026-11-02",
  );
  assert.equal(s.progress, 20);
  assert.equal(s.overdue.length, 1);
  assert.equal(s.due_soon.length, 2);
  assert.equal(s.actual_cents, 30);
  assert.equal(summarize({}, [], [], [], "2026-11-02").progress, null);
  assert.equal(
    businessToday("America/Sao_Paulo", new Date("2026-11-02T01:00:00Z")),
    "2026-11-01",
  );
});
