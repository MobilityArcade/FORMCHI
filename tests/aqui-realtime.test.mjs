import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

// Load the ESM route without changing the legacy project's package.json.
const source = await readFile(new URL('../api/aqui-realtime.js', import.meta.url), 'utf8');
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const offer = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 TEST\r\n';
const token = randomBytes(32).toString('base64url'); // Ephemeral test fixture only.

async function run({ method = 'POST', auth = `Bearer ${token}`, body = offer, headers = {}, chunks } = {}) {
  const req = Readable.from(chunks || [Buffer.from(body)]);
  req.method = method;
  req.headers = { authorization: auth, 'content-type': 'application/sdp', ...headers };
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.value = v; return this; }, send(v) { this.value = v; return this; } };
  await handler(req, res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  return res;
}

test('native session route: isolated, non-networked contract and failure cases', async t => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.AQUI_NATIVE_DEV_TOKEN;
  const originalKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  const fakeKey = randomBytes(32).toString('hex');
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`);
    assert.equal(options.headers['OpenAI-Beta'], undefined);
    assert.equal(options.body.get('sdp'), offer);
    const session = JSON.parse(options.body.get('session'));
    assert.equal(session.type, 'realtime');
    assert.equal(session.audio.output.voice, 'marin');
    assert.equal(session.max_output_tokens, 500);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(offer, { status: 201 });
  };
  try {
    process.env.AQUI_NATIVE_DEV_TOKEN = token;
    process.env.OPENAI_API_KEY = fakeKey;
    await t.test('method, auth, content type, size and malformed SDP rejected before upstream', async () => {
      assert.equal((await run({ method: 'GET' })).code, 405);
      for (const auth of ['', 'Bearer wrong', `Bearer ${randomBytes(32).toString('base64url')}`]) assert.equal((await run({ auth })).code, 401);
      assert.equal((await run({ headers: { 'content-type': 'application/json' } })).code, 415);
      assert.equal((await run({ headers: { 'content-length': '65537' } })).code, 413);
      assert.equal((await run({ chunks: [Buffer.alloc(40000), Buffer.alloc(40000)] })).code, 413);
      assert.equal((await run({ body: 'v=0\n' })).code, 400);
      assert.equal((await run({ body: offer + 'm=video 9 UDP/TLS/RTP/SAVPF 96\n' })).code, 400);
      assert.equal((await run({ headers: { 'content-encoding': 'gzip' } })).code, 415);
      assert.equal(calls, 0);
    });
    await t.test('missing configuration fails closed', async () => {
      delete process.env.AQUI_NATIVE_DEV_TOKEN;
      assert.equal((await run()).code, 503);
      process.env.AQUI_NATIVE_DEV_TOKEN = token;
      delete process.env.OPENAI_API_KEY;
      assert.equal((await run()).code, 503);
      process.env.OPENAI_API_KEY = fakeKey;
      assert.equal(calls, 0);
    });
    await t.test('valid offer returns only SDP', async () => {
      const res = await run();
      assert.equal(res.code, 200);
      assert.equal(res.headers['Content-Type'], 'application/sdp');
      assert.equal(res.value, offer);
      assert.equal(calls, 1);
    });
    await t.test('upstream errors and timeouts are sanitized', async () => {
      for (const [status, expected] of [[401, 502], [500, 502], [429, 429]]) {
        globalThis.fetch = async () => new Response('sensitive upstream details', { status });
        const res = await run();
        assert.equal(res.code, expected);
        assert.ok(!JSON.stringify(res.value).includes('sensitive'));
      }
      globalThis.fetch = async () => { throw new DOMException('private details', 'TimeoutError'); };
      assert.equal((await run()).code, 504);
      globalThis.fetch = async () => { throw new Error('private details'); };
      assert.equal((await run()).code, 502);
      globalThis.fetch = async () => new Response('not SDP');
      assert.equal((await run()).code, 502);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.AQUI_NATIVE_DEV_TOKEN; else process.env.AQUI_NATIVE_DEV_TOKEN = originalToken;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});
