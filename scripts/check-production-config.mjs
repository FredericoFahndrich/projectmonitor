const required = [
  "VITE_API_URL",
  "VITE_BASE_PATH",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) throw Error(`Configuração pendente: ${missing.join(", ")}`);
if (!process.env.VITE_API_URL.startsWith("https://"))
  throw Error("API de produção exige HTTPS");
if (
  !/^\/.*\/$/.test(process.env.VITE_BASE_PATH) &&
  process.env.VITE_BASE_PATH !== "/"
)
  throw Error("Base deve começar e terminar com /");
