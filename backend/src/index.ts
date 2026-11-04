import { ZodError } from "zod";
import type { Env, Identity } from "./types";
import { verifyIdentity, actorFromIdentity } from "./middleware/auth";
import { projects } from "./routes/projects";
import { users, auditStatement } from "./routes/users";
import { chat } from "./routes/chat";
import { HttpError, json } from "./utils/http";
export function createHandler(
  verify: (r: Request, e: Env) => Promise<Identity> = verifyIdentity,
) {
  return async (req: Request, e: Env) => {
    const origin = req.headers.get("origin");
    const allowed = e.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    });
    if (origin && !allowed.includes(origin))
      return Response.json(
        { error: { message: "Origem não autorizada" } },
        { status: 403, headers },
      );
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    let result: Response;
    try {
      const url = new URL(req.url),
        p = url.pathname.split("/").filter(Boolean);
      if (p[0] !== "api") throw new HttpError(404, "Rota não encontrada");
      if (p[1] === "health" && req.method === "GET")
        result = json({ status: "ok", service: "project-monitor" });
      else {
        const a = await actorFromIdentity(await verify(req, e), e);
        if (p[1] === "me" && req.method === "GET")
          result = json({
            ...a,
            status: a.admin ? "ativa" : a.status,
            admin_configured: !!e.ADMIN_FIREBASE_UID,
          });
        else if (p[1] === "projects")
          result = await projects(req, e, a, p, url);
        else if (p[1] === "admin") result = await users(req, e, a, p, url);
        else if (["conversations", "chat"].includes(p[1]))
          result = await chat(req, e, a, p, url);
        else throw new HttpError(404, "Rota não encontrada");
        if (a.admin && req.method === "GET" && p[1] !== "me")
          await auditStatement(
            e,
            a,
            "admin.read",
            null,
            p[1] === "projects" ? p[2] || null : null,
            {
              resource: p[1],
              section: p[1] === "admin" ? p[2] : p[3] || "list",
            },
          ).run();
      }
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof ZodError
            ? 400
            : 500;
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : "Não foi possível concluir a operação";
      result = Response.json({ error: { message } }, { status });
    }
    for (const [key, value] of headers) result.headers.set(key, value);
    if (result.status === 429) result.headers.set("Retry-After", "60");
    return result;
  };
}
export default { fetch: createHandler() };
