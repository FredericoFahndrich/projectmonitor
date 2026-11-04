import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { Miniflare } from "miniflare";
import { createHandler } from "../../backend/src/index";
import { HttpError } from "../../backend/src/utils/http";
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: "2026-01-01",
  d1Databases: ["DB"],
});
const DB = await mf.getD1Database("DB");
for (const file of ["0001_core.sql", "0002_chat.sql"])
  await DB.exec(await readFile(`backend/migrations/${file}`, "utf8"));
const env = {
  DB,
  FIREBASE_PROJECT_ID: "",
  FIREBASE_WEB_API_KEY: "",
  ADMIN_FIREBASE_UID: "admin",
  ALLOWED_ORIGINS: "http://127.0.0.1:5178",
  BUSINESS_TIMEZONE: "America/Sao_Paulo",
};
const handler = createHandler(async (req) => {
  const uid = req.headers
    .get("authorization")
    ?.match(/^Bearer local-test:([a-z]+)$/)?.[1];
  if (!uid) throw new HttpError(401, "Teste: sessão ausente");
  return { uid, email: `${uid}@example.test`, name: uid, emailVerified: true };
});
const server = createHttpServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const content = Buffer.concat(chunks);
    const r = await handler(
      new Request(`http://127.0.0.1:8788${req.url}`, {
        method: req.method,
        headers: req.headers as any,
        body: content.length ? content : undefined,
      }),
      env as any,
    );
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
  } catch {
    res.writeHead(500);
    res.end("Falha no servidor de teste");
  }
}).listen(8788, "127.0.0.1");
const vite = await createServer({
  root: resolve("frontend"),
  configFile: false,
  base: "/project-monitor/",
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:8788"),
  },
  plugins: [
    {
      name: "test-identity-only",
      enforce: "pre",
      resolveId(source) {
        if (source.endsWith("/auth/firebase.js"))
          return resolve("tests/e2e/auth-mock.js");
      },
      transformIndexHtml(html) {
        return html.replace(
          "<body>",
          '<body><div style="background:#fff3cd;padding:8px;text-align:center">TESTE LOCAL · identidade simulada · D1 emulado</div>',
        );
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
});
await vite.listen();
console.log("TEST HARNESS READY http://127.0.0.1:5178/project-monitor/");
async function close() {
  await vite.close();
  server.close();
  await mf.dispose();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
