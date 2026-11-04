export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length")) > 65536)
    fail(413, "Conteúdo muito grande");
  const s = await req.text();
  if (s.length > 65536) fail(413, "Conteúdo muito grande");
  try {
    const b = JSON.parse(s);
    if (!b || Array.isArray(b) || typeof b !== "object") throw Error();
    return b;
  } catch {
    fail(400, "JSON inválido");
  }
}
export const now = () => new Date().toISOString();
export const json = (data: unknown, status = 200) =>
  Response.json({ data }, { status });
