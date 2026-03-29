const test = require("node:test");
const assert = require("node:assert/strict");

process.env.EMAIL_API_URL = "https://email.example";
process.env.EMAIL_API_KEY = "test_key";

const { sendEmail } = require("./emailClient");

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: {
      get(name) {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body,
  };
}

test("valid request -> email sent", async () => {
  global.fetch = async (url, opts) => {
    assert.equal(url, "https://email.example/send");
    assert.equal(opts.headers.Authorization, "Bearer test_key");
    return jsonResponse({ ok: true, id: "msg_1" });
  };

  const result = await sendEmail({ to: "ops@example.com", subject: "x", type: "noise", data: {} });
  assert.equal(result.ok, true);
});

test("wrong api key -> unauthorized", async () => {
  global.fetch = async () => jsonResponse({ ok: false, error: "unauthorized" }, 401);

  const result = await sendEmail({ to: "ops@example.com", subject: "x", type: "noise", data: {} });
  assert.deepEqual(result, { ok: false, error: "unauthorized", status: 401 });
});

test("missing fields -> validation error", async () => {
  global.fetch = async () => jsonResponse({ ok: false, error: "validation_error", missing: ["to"] }, 400);

  const result = await sendEmail({ subject: "x", type: "noise", data: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error, "validation_error");
  assert.equal(result.status, 400);
});
