import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../src/utils/jwt.js";

Object.assign(process.env, {
    ACCESS_TOKEN_SECRET: "test-access-secret",
    REFRESH_TOKEN_SECRET: "test-refresh-secret",
    ACCESS_TOKEN_EXPIRES_IN: "15m",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
});
afterEach(() => mock.timers.reset());

test("refresh tokens issued in the same second are distinct", () => {
    mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
    const first = generateRefreshToken({ id: 1 });
    const second = generateRefreshToken({ id: 1 });
    assert.notEqual(first, second, "rotation must invalidate the previous token even within one second");
    const payload = jwt.verify(second, process.env.REFRESH_TOKEN_SECRET!);
    assert.ok(typeof payload !== "string");
    assert.equal(payload.id, 1);
    assert.equal(payload.exp! - payload.iat!, 30 * 86400);
});

test("access tokens preserve identity and expire after the configured duration", () => {
    const token = generateAccessToken({ id: 1, name: "Test", email: "test@example.test" });
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
    assert.ok(typeof payload !== "string");
    assert.equal(payload.email, "test@example.test");
    assert.equal(payload.exp! - payload.iat!, 900);
    assert.throws(() => jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!), /invalid signature/);
    assert.throws(() => jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, { clockTimestamp: payload.exp }), /jwt expired/);
});
