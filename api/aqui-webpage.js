import { createHash, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { parse } from 'parse5';

export const config = { api: { bodyParser: false }, maxDuration: 15 };
export const limits = Object.freeze({ request: 4096, download: 1024 * 1024, text: 4500, redirects: 3, milliseconds: 8000 });
class PageError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new PageError(code); };
const closedCodes = new Set(['invalidURL','blockedDestination','redirectLimit','tooLarge','unsupportedContent','unreadable','unavailable','timeout']);
const denied4 = ['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.88.99.0/24','192.168.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/3'].map(x => ipaddr.parseCIDR(x));
const denied6 = ['2001::/23','2001:db8::/32','2002::/16','3fff::/20'].map(x => ipaddr.parseCIDR(x));
export function publicIP(address) {
  if (typeof address !== 'string' || address.includes('%') || !ipaddr.isValid(address)) return false;
  const ip = ipaddr.parse(address);
  if (ip.kind() === 'ipv4') return ip.range() === 'unicast' && !denied4.some(r => ip.match(r));
  return ip.range() === 'unicast' && ip.match(ipaddr.parseCIDR('2000::/3')) && !denied6.some(r => ip.match(r));
}
export function safeURL(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\x00-\x20\x7f\\]/.test(input)) fail('invalidURL');
  let url; try { url = new URL(input); } catch { fail('invalidURL'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port) fail('invalidURL');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host.endsWith('.') || /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion)$/.test(host)) fail('blockedDestination');
  if (ipaddr.isValid(host)) { if (!publicIP(host)) fail('blockedDestination'); }
  else if (!host.includes('.')) fail('blockedDestination');
  url.hash = '';
  if (url.href.length > 2048) fail('invalidURL');
  return url;
}
export async function resolvePublic(url, resolve = lookup) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const records = ipaddr.isValid(host) ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }] : await resolve(host, { all: true, verbatim: true });
  if (!records.length || records.some(r => !publicIP(r.address) || ![4,6].includes(r.family))) fail('blockedDestination');
  return records;
}
// Connect only to the validated addresses. No second DNS lookup / proxy / pooled socket.
export function pinnedLookup(records) {
  return (_host, options, callback) => options?.all
    ? callback(null, records) : callback(null, records[0].address, records[0].family);
}
export function getHop(url, records, signal, request = url.protocol === 'https:' ? https.request : http.request) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', agent: false, lookup: pinnedLookup(records), signal,
      maxHeaderSize: 16384,
      headers: { Accept: 'text/html, text/plain;q=0.9', 'Accept-Encoding': 'identity', 'User-Agent': 'AQUI-Webpage/1.0' } }, res => {
      const status = res.statusCode;
      if ([301,302,303,307,308].includes(status)) { const location = res.headers.location; res.destroy(); resolve({ status, location }); return; }
      try {
        if (status !== 200) fail('unavailable');
        if (res.headers['content-encoding'] && res.headers['content-encoding'].toLowerCase() !== 'identity') fail('unsupportedContent');
        if (res.headers['content-disposition']) fail('unsupportedContent');
        const type = res.headers['content-type'] || '';
        if (!/^text\/(html|plain)(?:\s*;|$)/i.test(type) || (/charset=/i.test(type) && !/charset\s*=\s*"?(?:utf-8|us-ascii)"?(?:\s*;|$)/i.test(type))) fail('unsupportedContent');
        if (res.headers['content-length'] && (!/^\d+$/.test(res.headers['content-length']) || Number(res.headers['content-length']) > limits.download)) fail('tooLarge');
        let size = 0; const chunks = [];
        res.on('data', chunk => {
          size += chunk.length;
          if (size > limits.download) { reject(new PageError('tooLarge')); res.destroy(); req.destroy(); return; }
          chunks.push(Buffer.from(chunk));
        });
        res.on('end', () => resolve({ status, type, body: Buffer.concat(chunks) }));
        res.on('error', reject);
        res.on('aborted', () => reject(new PageError('unavailable')));
      } catch (error) { res.destroy(); reject(error); }
    });
    req.on('error', reject);
    req.end();
  });
}
function cut(text, max) {
  let result = ''; let size = 0;
  for (const char of text) { const bytes = Buffer.byteLength(char); if (size + bytes > max) break; result += char; size += bytes; }
  return result;
}
export function extract(body, type) {
  let source; try { source = new TextDecoder('utf-8', { fatal: true }).decode(body); } catch { fail('unsupportedContent'); }
  if (/^\s*%PDF-/.test(source)) fail('unsupportedContent');
  let title = ''; let text = source;
  if (/^text\/html/i.test(type)) {
    const root = parse(source); const titles = []; const main = []; const all = [];
    const stack = [{ node: root, content: false, title: false }];
    const skip = new Set(['script','style','noscript','svg','template','nav','footer','header','form']);
    while (stack.length) {
      const { node, content, title: inTitle } = stack.pop();
      if (skip.has(node.tagName) || node.attrs?.some(a => a.name === 'hidden' || (a.name === 'aria-hidden' && a.value === 'true') || (a.name === 'style' && /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(a.value)))) continue;
      const isMain = content || ['main','article'].includes(node.tagName);
      const isTitle = inTitle || node.tagName === 'title';
      if (node.nodeName === '#text') { (isTitle ? titles : all).push(node.value); if (isMain) main.push(node.value); }
      for (const child of [...(node.childNodes || [])].reverse()) stack.push({ node: child, content: isMain, title: isTitle });
    }
    title = titles.join(' '); text = (main.length ? main : all).join(' ');
  }
  const clean = value => value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim();
  text = clean(text); title = cut(clean(title), 240);
  if (text.length < 80) fail('unreadable');
  return { title, content: cut(text, limits.text), partial: Buffer.byteLength(text) > limits.text };
}
async function abortable(promise, signal) {
  signal.throwIfAborted();
  let listener;
  try { return await Promise.race([promise, new Promise((_, reject) => { listener = () => reject(new PageError('timeout')); signal.addEventListener('abort', listener, { once: true }); })]); }
  finally { signal.removeEventListener('abort', listener); }
}
export async function readPage(input, { resolve = lookup, hop = getHop, signal = AbortSignal.timeout(limits.milliseconds) } = {}) {
  let url = safeURL(input);
  for (let count = 0; count <= limits.redirects; count++) {
    const records = await abortable(resolvePublic(url, resolve), signal);
    const result = await abortable(hop(url, records, signal), signal);
    if ([301,302,303,307,308].includes(result.status)) {
      if (count === limits.redirects) fail('redirectLimit');
      if (typeof result.location !== 'string') fail('unavailable');
      const next = safeURL(new URL(result.location, url).href);
      if (url.protocol === 'https:' && next.protocol !== 'https:') fail('blockedDestination');
      url = next; continue;
    }
    return { source: url.href, ...extract(result.body, result.type) };
  }
}
// Preview test protection only: state is NOT shared across instances or cold starts.
export function createAdmissionGuard(now = () => performance.now()) {
  let active = false;
  let admitted = [];
  let last = -Infinity;
  return () => {
    const time = now();
    if (!Number.isFinite(time) || time < last) throw new Error('guardUnavailable');
    last = time;
    admitted = admitted.filter(t => time - t < 60000);
    if (active || admitted.length >= 2) return { retryAfter: active ? 8 : Math.max(1, Math.ceil((60000 - (time - admitted[0])) / 1000)) };
    admitted.push(time);
    active = true;
    let released = false;
    return { release() { if (!released) { released = true; active = false; } } };
  };
}
export function createHandler({ read = readPage, admit = createAdmissionGuard() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const error = (status, code) => res.status(status).json({ error: code });
    if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'codex/aqui-native-realtime') return error(503, 'unavailable');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return error(405, 'method'); }
    const expected = process.env.AQUI_NATIVE_DEV_TOKEN;
    if (!/^[A-Za-z0-9_-]{43}$/.test(expected || '')) return error(503, 'unavailable');
    const supplied = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
    const hash = x => createHash('sha256').update(x).digest();
    if (!supplied || !timingSafeEqual(hash(supplied[1]), hash(expected))) return error(401, 'unauthorized');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') ||
        (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) return error(415, 'unsupportedContent');
    const length = req.headers['content-length'];
    if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > limits.request)) return error(413, 'tooLarge');
    let admission;
    try {
      admission = admit();
      if (Number.isInteger(admission?.retryAfter) && admission.retryAfter > 0) {
        res.setHeader('Retry-After', String(admission.retryAfter));
        return error(429, 'rateLimited');
      }
      if (typeof admission?.release !== 'function') throw new Error('guardUnavailable');
    } catch { return error(503, 'unavailable'); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.milliseconds);
    const closed = () => controller.abort();
    req.once('aborted', closed); res.once?.('close', closed);
    try {
      const body = await abortable((async () => {
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > limits.request) fail('tooLarge'); chunks.push(Buffer.from(chunk)); }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      })(), controller.signal);
      if (!body || typeof body !== 'object' || Object.keys(body).join() !== 'url') fail('invalidURL');
      const url = safeURL(body.url);
      const page = await abortable(read(url.href, { signal: controller.signal }), controller.signal);
      return res.status(200).json(page);
    } catch (e) { return error(controller.signal.aborted ? 504 : 422, controller.signal.aborted ? 'timeout' : closedCodes.has(e.code) ? e.code : 'unavailable'); }
    finally { clearTimeout(timer); req.off('aborted', closed); res.off?.('close', closed); admission.release(); }
  };
}
export default createHandler();
