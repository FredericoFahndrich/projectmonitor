import { auth } from "../auth/firebase.js";
let epoch = 0;
const controllers = new Set();
export function clearRequests() {
  epoch++;
  for (const c of controllers) c.abort();
  controllers.clear();
}
export async function api(path, method = "GET", body) {
  const generation = epoch,
    c = new AbortController();
  controllers.add(c);
  try {
    if (!auth?.currentUser) throw Error("Autenticação necessária");
    const token = await auth.currentUser.getIdToken();
    if (generation !== epoch) throw new DOMException("Cancelado", "AbortError");
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8787"}/api${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: c.signal,
      },
    );
    const data = await response.json();
    if (generation !== epoch) throw new DOMException("Cancelado", "AbortError");
    if (!response.ok) {
      const error = Object.assign(
        Error(data.error?.message || "Falha na operação"),
        { status: response.status },
      );
      if ([401, 403, 404].includes(response.status))
        window.dispatchEvent(new CustomEvent("access-lost", { detail: error }));
      throw error;
    }
    return data.data;
  } catch (error) {
    if (error instanceof TypeError)
      throw Error("Falha de rede. Verifique a conexão e tente novamente.");
    throw error;
  } finally {
    controllers.delete(c);
  }
}
