import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { verifyIdentity } from "../src/middleware/auth";
test("assinatura RS256, claims Firebase e consulta online obrigatória por requisição", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256"),
    jwk = await exportJWK(publicKey),
    keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "local" }] });
  const now = Math.floor(Date.now() / 1000),
    env: any = {
      FIREBASE_PROJECT_ID: "local-test",
      FIREBASE_WEB_API_KEY: "public-test-key",
    };
  const payload = {
    sub: "alice",
    aud: "local-test",
    iss: "https://securetoken.google.com/local-test",
    iat: now,
    exp: now + 3600,
    auth_time: now - 100,
  };
  const sign = (p: any = payload, key = privateKey) =>
    new SignJWT(p).setProtectedHeader({ alg: "RS256", kid: "local" }).sign(key);
  const req = (token: string) =>
    new Request("http://local", {
      headers: { Authorization: `Bearer ${token}` },
    });
  let calls = 0;
  const lookup: any = async () => {
    calls++;
    return Response.json({
      users: [
        {
          localId: "alice",
          email: "alice@example.test",
          displayName: "Alice",
          emailVerified: true,
          validSince: String(now - 200),
        },
      ],
    });
  };
  const token = await sign();
  assert.equal(
    (await verifyIdentity(req(token), env, keys, lookup)).uid,
    "alice",
  );
  await verifyIdentity(req(token), env, keys, lookup);
  assert.equal(calls, 2);
  for (const patch of [
    { aud: "other" },
    { iss: "https://evil.test" },
    { exp: now - 1 },
    { iat: now + 10 },
    { auth_time: now + 10 },
    { sub: "" },
    { auth_time: undefined },
  ])
    await assert.rejects(
      () =>
        sign({ ...payload, ...patch }).then((t) =>
          verifyIdentity(req(t), env, keys, lookup),
        ),
      (e: any) => e.status === 401,
    );
  const other = await generateKeyPair("RS256");
  await assert.rejects(
    () =>
      sign(payload, other.privateKey).then((t) =>
        verifyIdentity(req(t), env, keys, lookup),
      ),
    (e: any) => e.status === 401,
  );
  assert.equal(calls, 2);
  for (const account of [
    { localId: "alice", disabled: true, validSince: "0" },
    { localId: "alice", validSince: String(now) },
    null,
  ])
    await assert.rejects(
      () =>
        verifyIdentity(req(token), env, keys, (async () =>
          Response.json({ users: account ? [account] : [] })) as any),
      (e: any) => e.status === 401,
    );
  await assert.rejects(
    () =>
      verifyIdentity(req(token), env, keys, (async () => {
        throw Error("offline");
      }) as any),
    (e: any) => e.status === 503,
  );
  await assert.rejects(
    () =>
      verifyIdentity(
        req(token),
        env,
        keys,
        (async () => new Response("{}", { status: 400 })) as any,
      ),
    (e: any) => e.status === 401,
  );
  await assert.rejects(
    () =>
      verifyIdentity(
        req(token),
        env,
        keys,
        (async () => new Response("{}", { status: 500 })) as any,
      ),
    (e: any) => e.status === 503,
  );
});
