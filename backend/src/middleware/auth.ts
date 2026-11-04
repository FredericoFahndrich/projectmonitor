import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import type { Env, Identity, Actor, Row } from "../types";
import { fail, now } from "../utils/http";
import { one, stmt } from "../repositories/db";
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export async function verifyIdentity(
  req: Request,
  e: Env,
  keySet: JWTVerifyGetKey = keys,
  lookup: typeof fetch = fetch,
): Promise<Identity> {
  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) fail(401, "Autenticação necessária");
  if (!e.FIREBASE_PROJECT_ID || !e.FIREBASE_WEB_API_KEY)
    fail(503, "Autenticação ainda não configurada");
  let p;
  try {
    ({ payload: p } = await jwtVerify(token, keySet, {
      algorithms: ["RS256"],
      audience: e.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${e.FIREBASE_PROJECT_ID}`,
      requiredClaims: ["exp", "iat", "auth_time", "sub"],
    }));
  } catch {
    fail(401, "Sessão inválida ou expirada");
  }
  const seconds = Math.floor(Date.now() / 1000);
  if (
    !p.sub ||
    p.sub.length > 128 ||
    typeof p.auth_time !== "number" ||
    p.auth_time > seconds ||
    !p.iat ||
    p.iat > seconds
  )
    fail(401, "Identidade inválida");
  // Online validation on EVERY request: no positive identity/authorization cache.
  let response;
  try {
    response = await lookup(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(e.FIREBASE_WEB_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    fail(503, "Não foi possível validar a sessão. Tente novamente.");
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429)
      fail(503, "Validação de identidade indisponível");
    fail(401, "Sessão revogada ou conta indisponível");
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    fail(503, "Validação de identidade indisponível");
  }
  const u = data.users?.[0];
  validateAccount(p, u);
  return {
    uid: p.sub,
    email: u.email || "",
    name: u.displayName || u.email || "Usuário",
    emailVerified: u.emailVerified === true,
  };
}
export function validateAccount(p: any, u: any) {
  if (
    !u ||
    u.localId !== p.sub ||
    u.disabled ||
    !/^\d+$/.test(String(u.validSince)) ||
    p.auth_time < Number(u.validSince)
  )
    fail(401, "Sessão revogada ou conta indisponível");
}
export async function actorFromIdentity(i: Identity, e: Env): Promise<Actor> {
  const t = now();
  await stmt(
    e,
    `INSERT INTO users(uid,public_id,name,email,status,created_at,updated_at,last_seen_at) VALUES(?,?,?,?, 'pendente',?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen_at=excluded.last_seen_at`,
    [i.uid, crypto.randomUUID(), i.name, i.email, t, t, t],
  ).run();
  const u = await one(e, "SELECT * FROM users WHERE uid=?", [i.uid]);
  return {
    ...i,
    admin: !!e.ADMIN_FIREBASE_UID && i.uid === e.ADMIN_FIREBASE_UID,
    status: u!.status,
    version: u!.version,
  };
}
export function active(a: Actor) {
  if (a.admin) return;
  if (a.status !== "ativa")
    fail(
      403,
      a.status === "bloqueada"
        ? "Sua conta está bloqueada"
        : "Sua conta aguarda aprovação",
    );
  if (!a.emailVerified)
    fail(403, "Verifique seu e-mail para acessar os projetos");
}
export function admin(a: Actor) {
  if (!a.admin) fail(403, "Ação exclusiva do administrador");
}
export async function projectAccess(
  e: Env,
  a: Actor,
  id: string,
  action = "read",
): Promise<Row> {
  active(a);
  const p = await one(e, "SELECT * FROM projects WHERE id=?", [id]);
  const m = a.admin
    ? null
    : await one(
        e,
        "SELECT role FROM project_members WHERE project_id=? AND uid=? AND status='ativo'",
        [id, a.uid],
      );
  if (!p || (!a.admin && !m)) fail(404, "Projeto não encontrado");
  const role = a.admin ? "admin" : m!.role;
  const allowed: Record<string, string[]> = {
    read: ["admin", "gestor", "colaborador", "leitor"],
    write: ["admin", "gestor", "colaborador"],
    edit: ["admin", "gestor"],
    delete: ["admin", "gestor"],
    export: ["admin", "gestor"],
    admin: ["admin"],
  };
  if (!(allowed[action] || []).includes(role))
    fail(403, "Seu perfil não permite esta operação");
  if (p.archived_at && ["write", "edit", "delete"].includes(action))
    fail(409, "Restaure o projeto antes de alterar seu conteúdo");
  return { ...p, role };
}
