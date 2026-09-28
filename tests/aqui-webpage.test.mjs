import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
let source = await readFile(new URL('../api/aqui-webpage.js', import.meta.url), 'utf8');
for (const name of ['ipaddr.js','parse5']) source = source.replace(`'${name}'`, `'${import.meta.resolve(name)}'`);
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const content = 'Public fixture article. '.repeat(30);
const records = [{ address:'93.184.216.34', family:4 }];
const resolve = async () => records;
const hop = async () => ({status:200,type:'text/plain',body:Buffer.from(content)});
const token = 'x'.repeat(43); // Disposable fixture, never valid production access.

test('public address policy rejects local, reserved, mapped and transition networks', () => {
 for (const ip of ['127.0.0.1','10.1.2.3','0.0.0.0','169.254.169.254','100.64.0.1','172.16.2.1','192.168.1.1','192.0.0.8','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.1.2.3','255.255.255.255','::1','::','fc00::1','fe80::1','::ffff:8.8.8.8','64:ff9b::808:808','2001:db8::1','2002:0808:0808::1','3fff::1','bad']) assert.equal(m.publicIP(ip),false,ip);
 for (const ip of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111']) assert.equal(m.publicIP(ip),true,ip);
});
test('URL validation normalizes IP encodings before blocking and restricts schemes/ports/credentials', () => {
 for (const url of ['file:///etc/passwd','ftp://host.com/a','http://user:pass@host.com','http://host.com:8080','http://localhost','http://x.local','http://2130706433','http://0x7f000001','http://127.1','http://[::1]','http://host.com./','http://host.com\\@127.0.0.1','https://host.com/\n']) assert.throws(()=>m.safeURL(url));
 assert.equal(m.safeURL('https://example.com/a#fragment').href,'https://example.com/a');
 assert.throws(()=>m.safeURL('https://example.com/'+'🍋'.repeat(300)),{code:'invalidURL'});
});
test('all DNS answers checked and approved address pinned without second resolution', async () => {
 await assert.rejects(m.resolvePublic(m.safeURL('https://example.com'),async()=>[...records,{address:'10.0.0.1',family:4}]));
 await assert.rejects(m.resolvePublic(m.safeURL('https://example.com'),async()=>[]));
 const fixed=await m.resolvePublic(m.safeURL('https://example.com'),resolve);
 m.pinnedLookup(fixed)('ignored',{},(e,ip,family)=>{assert.equal(e,null);assert.equal(ip,records[0].address);assert.equal(family,4)});
 m.pinnedLookup(fixed)('ignored',{all:true},(e,ips)=>assert.deepEqual(ips,records));
});
test('redirects revalidate each hop, reject downgrade/private targets and cap chains', async () => {
 let calls=0;
 const page=await m.readPage('https://example.com/a',{resolve,hop:async()=> ++calls===1 ? {status:302,location:'/b'} : hop()});
 assert.equal(page.source,'https://example.com/b');assert.equal(calls,2);
 for (const location of ['http://example.com','http://127.0.0.1','https://user:pass@example.com','https://[::1]']) await assert.rejects(m.readPage('https://example.com',{resolve,hop:async()=>({status:302,location})}));
 await assert.rejects(m.readPage('https://example.com',{resolve,hop:async()=>({status:302,location:'/again'})}),{code:'redirectLimit'});
 let dns=0;
 await assert.rejects(m.readPage('https://example.com',{resolve:async()=>++dns===1?records:[{address:'127.0.0.1',family:4}],hop:async()=>({status:302,location:'https://other.com/'})}),{code:'blockedDestination'});
});
test('global deadline includes hung DNS and retrieval', async () => {
 for (const deps of [{resolve:()=>new Promise(()=>{}),hop},{resolve,hop:()=>new Promise(()=>{})}]) {
  const c=new AbortController(); const timer=setTimeout(()=>c.abort(),10);
  await assert.rejects(m.readPage('https://example.com',{...deps,signal:c.signal}),{code:'timeout'});clearTimeout(timer);
 }
});
test('HTML extraction removes non-content, decodes entities and bounds Unicode output', () => {
 const page=m.extract(Buffer.from(`<title>A &amp; B</title><nav>NO_NAV</nav><script>NO_SCRIPT</script><main>${content}<p hidden>NO_HIDDEN</p><p aria-hidden="true">NO_ARIA</p></main>`),'text/html');
 assert.equal(page.title,'A & B');assert.ok(!page.content.includes('NO_'));assert.equal(page.partial,false);
 const long=m.extract(Buffer.from('🍋'.repeat(5000)),'text/plain');assert.equal(long.partial,true);assert.ok(Buffer.byteLength(long.content)<=4500);assert.ok(!long.content.includes('�'));
 assert.throws(()=>m.extract(Buffer.from('<script>nothing</script>'),'text/html'),{code:'unreadable'});
 assert.throws(()=>m.extract(Buffer.from([255]),'text/plain'),{code:'unsupportedContent'});
});
function fakeRequest({headers={},status=200,chunks=[Buffer.from(content)]}, inspect=()=>{}) {
 return (url,options,callback)=>{
  inspect(options);const req=new EventEmitter();req.destroy=()=>{};
  req.end=()=>queueMicrotask(()=>{const res=Readable.from(chunks);res.headers={'content-type':'text/plain',...headers};res.statusCode=status;callback(res)});
  return req;
 };
}
test('transport sends only fixed public headers and bounds downloads, encoding and types', async()=>{
 const url=m.safeURL('https://example.com');const signal=new AbortController().signal;
 await m.getHop(url,records,signal,fakeRequest({},options=>{
  assert.deepEqual(Object.keys(options.headers).sort(),['Accept','Accept-Encoding','User-Agent']);
  assert.equal(options.agent,false);assert.equal(options.signal,signal);assert.equal(options.headers['Accept-Encoding'],'identity');
 }));
 for(const headers of [{'content-type':'application/pdf'},{'content-type':'image/png'},{'content-type':'text/html; charset=iso-8859-1'},{'content-encoding':'gzip'},{'content-disposition':'attachment'},{'content-length':String(m.limits.download+1)}]) await assert.rejects(m.getHop(url,records,signal,fakeRequest({headers})));
 await assert.rejects(m.getHop(url,records,signal,fakeRequest({chunks:[Buffer.alloc(m.limits.download),Buffer.alloc(1)]})),{code:'tooLarge'});
 await assert.rejects(m.getHop(url,records,signal,fakeRequest({status:403})),{code:'unavailable'});
});
test('protected Preview handler, body limits, no secret forwarding and closed errors',async()=>{
 const prior={...process.env};Object.assign(process.env,{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/aqui-native-realtime',AQUI_NATIVE_DEV_TOKEN:token});
 let calls=0;
 const handler=m.createHandler({read:async(url,options)=>{calls++;assert.deepEqual(Object.keys(options),['signal']);return {source:url,title:'Fixture',content,partial:false}}});
 async function run({method='POST',auth=`Bearer ${token}`,body=JSON.stringify({url:'https://example.com'}),headers={},route=handler}={}){
  const req=Readable.from([Buffer.from(body)]);req.method=method;req.headers={authorization:auth,'content-type':'application/json',...headers};
  const res=new EventEmitter();res.setHeader=()=>{};res.status=n=>{res.code=n;return res};res.json=x=>{res.value=x;return res};await route(req,res);return res;
 }
 try {
  assert.equal((await run({auth:'Bearer wrong'})).code,401);assert.equal(calls,0);
  assert.equal((await run({method:'GET'})).code,405);
  assert.equal((await run({headers:{'content-type':'text/plain'}})).code,415);
  assert.equal((await run({headers:{'content-encoding':'gzip'}})).code,415);
  assert.equal((await run({body:'x'.repeat(4097)})).value.error,'tooLarge');
  assert.equal((await run({body:JSON.stringify({url:'https://example.com',context:'PRIVATE'})})).value.error,'invalidURL');
  assert.equal((await run()).code,200);assert.equal(calls,1);
  assert.equal((await run({route:m.createHandler({read:async()=>{throw new Error('PRIVATE_SECRET_URL_BODY')}})})).value.error,'unavailable');
  process.env.VERCEL_ENV='production';assert.equal((await run()).code,503);
  process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_REF='other';assert.equal((await run()).code,503);
  process.env.VERCEL_GIT_COMMIT_REF='codex/aqui-native-realtime';delete process.env.AQUI_NATIVE_DEV_TOKEN;assert.equal((await run()).code,503);
 } finally { for(const k of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','AQUI_NATIVE_DEV_TOKEN']) {if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]} }
});

test('client disconnect aborts retrieval and returns only a closed code', async()=>{
 const keys=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','AQUI_NATIVE_DEV_TOKEN'];const before=keys.map(k=>process.env[k]);
 Object.assign(process.env,{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/aqui-native-realtime',AQUI_NATIVE_DEV_TOKEN:token});
 try {
  const req=Readable.from([Buffer.from(JSON.stringify({url:'https://example.com'}))]);req.method='POST';req.headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  const res=new EventEmitter();res.setHeader=()=>{};res.status=n=>{res.code=n;return res};res.json=v=>{res.value=v;return res};
  let signal;
  const handler=m.createHandler({read:async(_url,options)=>{signal=options.signal;queueMicrotask(()=>res.emit('close'));return new Promise(()=>{})}});
  await handler(req,res);assert.equal(signal.aborted,true);assert.deepEqual(res.value,{error:'timeout'});
 } finally {keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]);}
});
test('PDF disguised as text and hidden CSS are not treated as useful page content',()=>{
 assert.throws(()=>m.extract(Buffer.from('%PDF-1.7 '+content),'text/plain'),{code:'unsupportedContent'});
 const page=m.extract(Buffer.from(`<main><p style="display: none">HIDDEN_INSTRUCTION</p><p>${content}</p></main>`),'text/html');
 assert.ok(!page.content.includes('HIDDEN_INSTRUCTION'));
});
