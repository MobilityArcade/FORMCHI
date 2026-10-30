import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

const source = await readFile(new URL('../api/aqui-realtime.js', import.meta.url), 'utf8');
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const offer = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 PRIVATE_SDP\r\n';
const privateText = 'sk-PRIVATE_KEY Bearer PRIVATE_BEARER PRIVATE_OIDC ' + offer;
const errorBody = (type, code, message) => JSON.stringify({error:{type,code,message}});
const cases = [
  {name:'key rejection redacts echoed credentials',body:errorBody('invalid_request_error','invalid_api_key','Incorrect API key provided: '+privateText),message:'api_key_rejected',code:'invalid_api_key'},
  {name:'unknown fields cannot inject secrets or newlines',body:errorBody(privateText,privateText,privateText),message:'unclassified_upstream_error',code:'unrecognized'},
  {name:'project rejection category',body:errorBody('authentication_error','invalid_project','Project PRIVATE_PROJECT rejected '+privateText),message:'project_related_rejection',code:'invalid_project'},
  {name:'missing authentication category',body:errorBody('authentication_error','missing_api_key','Missing bearer '+privateText),message:'authentication_missing'},
  {name:'revocation category',body:errorBody('authentication_error','invalid_api_key','Revoked key '+privateText),message:'credential_revoked_or_expired'},
  {name:'non-JSON body',body:privateText,bodyState:'unreadable_or_invalid'},
  {name:'invalid JSON shape',body:JSON.stringify({error:privateText}),bodyState:'invalid_shape'},
  {name:'null JSON',body:'null',bodyState:'invalid_shape'},
  {name:'oversized error',body:'x'.repeat(8193),bodyState:'oversized'},
  {name:'absent body',body:null,bodyState:'absent'},
  {name:'body read failure',broken:true,bodyState:'unreadable_or_invalid'},
  {name:'stalled body deadline',stalled:true,bodyState:'unreadable_or_invalid'},
  {name:'429 mapping preserved',status:429,body:errorBody('rate_limit_error','rate_limit_exceeded',privateText),expected:429},
  {name:'500 mapping preserved',status:500,body:privateText,expected:502},
  {name:'logger failure preserves result',body:privateText,loggerFails:true},
  {name:'success path unchanged',status:201,body:offer,expected:200}
];
for (const c of cases) test(c.name, async () => {
  const oldFetch=globalThis.fetch, oldLog=console.info;
  const oldToken=process.env.AQUI_NATIVE_DEV_TOKEN,oldKey=process.env.AQUI_NATIVE_OPENAI_API_KEY;
  const logs=[];
  process.env.AQUI_NATIVE_DEV_TOKEN='a'.repeat(43);
  process.env.AQUI_NATIVE_OPENAI_API_KEY='sk-PRIVATE_SERVER_KEY';
  let cancelled=false;
  try {
    console.info=line=>{if(c.loggerFails)throw Error(privateText);logs.push(JSON.parse(line));};
    globalThis.fetch=async()=>new Response(c.broken||c.stalled ? new ReadableStream({
      start(controller){if(c.broken)controller.error(Error(privateText));},
      cancel(){cancelled=true;}
    }):c.body,{status:c.status??401,headers:{'x-request-id':c.name.startsWith('key rejection')?'req_'+'a'.repeat(32):privateText.replace(/[\r\n]/g,' ')}});
    const req=Readable.from([Buffer.from(offer)]);req.method='POST';req.headers={authorization:'Bearer '+'a'.repeat(43),'content-type':'application/sdp'};
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.value=v;return this;},send(v){this.value=v;return this;}};
    await handler(req,res);
    assert.equal(res.code,c.expected??502);
    if(c.expected===200){assert.equal(res.value,offer);assert.ok(!logs.some(x=>x.stage.startsWith('upstream_error')));}
    else assert.ok(!JSON.stringify(res.value).includes('PRIVATE'));
    assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
    assert.ok(!JSON.stringify(logs).includes('a'.repeat(43)));
    if(c.message)assert.ok(logs.some(x=>x.stage==='upstream_error_message'&&x.result===c.message));
    if(c.code)assert.ok(logs.some(x=>x.stage==='upstream_error_code'&&x.result===c.code));
    if(c.bodyState)assert.ok(logs.some(x=>x.stage==='upstream_error_body'&&x.result===c.bodyState));
    if(c.stalled)assert.ok(cancelled);
    if(c.name.startsWith('key rejection'))assert.ok(logs.some(x=>x.stage==='upstream_request_id'&&x.result==='req_'+'a'.repeat(32)));
    else assert.ok(!logs.some(x=>x.stage==='upstream_request_id'));
  } finally {
    globalThis.fetch=oldFetch;console.info=oldLog;
    if(oldToken===undefined)delete process.env.AQUI_NATIVE_DEV_TOKEN;else process.env.AQUI_NATIVE_DEV_TOKEN=oldToken;
    if(oldKey===undefined)delete process.env.AQUI_NATIVE_OPENAI_API_KEY;else process.env.AQUI_NATIVE_OPENAI_API_KEY=oldKey;
  }
});
