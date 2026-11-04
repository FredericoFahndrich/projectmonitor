// TEST ONLY: resolved exclusively by tests/e2e/server.ts; never imported by production.
export const configured = true;
const makeUser = (uid) =>
  uid
    ? {
        uid,
        getIdToken: async () => `local-test:${uid}`,
        reload: async () => {},
      }
    : null;
export const auth = { currentUser: makeUser(localStorage.getItem("test-uid")) };
let callback;
export async function observe(fn) {
  callback = fn;
  fn(auth.currentUser);
}
export async function login(email) {
  const uid = email.split("@")[0];
  localStorage.setItem("test-uid", uid);
  auth.currentUser = makeUser(uid);
  callback(auth.currentUser);
}
export const register = login;
export const google = () => login("google@example.test");
export const reset = async () => {};
export const verifyEmail = async () => {};
export const authError = () => "Falha de autenticação simulada";
export async function logout() {
  localStorage.removeItem("test-uid");
  auth.currentUser = null;
  callback(null);
}
