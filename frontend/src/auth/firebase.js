import { initializeApp } from "@firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  browserLocalPersistence,
  setPersistence,
} from "@firebase/auth";
const env = import.meta.env;
export const configured = !!(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_AUTH_DOMAIN &&
  env.VITE_FIREBASE_PROJECT_ID &&
  env.VITE_FIREBASE_APP_ID
);
export const auth = configured
  ? getAuth(
      initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }),
    )
  : null;
export async function observe(callback) {
  if (!auth) {
    callback(null);
    return;
  }
  await setPersistence(auth, browserLocalPersistence);
  return onAuthStateChanged(auth, callback);
}
export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);
export async function register(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(result.user);
  return result;
}
export const google = () => signInWithPopup(auth, new GoogleAuthProvider());
export const reset = (email) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);
export const verifyEmail = () => sendEmailVerification(auth.currentUser);
export function authError(err) {
  const messages = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "E-mail já cadastrado.",
    "auth/weak-password": "Use uma senha de pelo menos seis caracteres.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/unauthorized-domain":
      "Este domínio ainda não está autorizado no Firebase.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde antes de tentar novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua rede.",
  };
  return (
    messages[err.code] ||
    "Não foi possível autenticar. Verifique os dados e a configuração do Firebase."
  );
}
