import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicRepositoryReader, repositoryInput, assessmentKey, STATIC_DISCLAIMER } from '../services/distribution/assessment';
import { gitHash } from '@launchgate/source-analysis';
const commit='a'.repeat(40),tree='b'.repeat(40);
function fixture(options:{private?:boolean;size?:number;status?:number;binary?:boolean;path?:string;mode?:string;dependencies?:object;truncated?:boolean}={}) {
 const bytes=options.binary?Buffer.from([0,1,2]):Buffer.from(JSON.stringify({dependencies:options.dependencies??{next:'15',stripe:'1'}})),blob=gitHash(bytes);let requests=0;
 const transport:typeof fetch=async(input,init)=>{requests++;assert.equal(init?.redirect,'error');assert.ok(String(input).startsWith('https://api.github.com/repos/'));
  if(options.status)return new Response('',{status:options.status});const url=String(input);
  return Response.json(url.includes('/commits/')?{sha:commit,commit:{tree:{sha:tree}}}:url.includes('/git/trees/')?{sha:tree,truncated:options.truncated??false,tree:[{path:options.path??'package.json',type:'blob',mode:options.mode??'100644',sha:blob,size:bytes.length}]}:url.includes('/git/blobs/')?{sha:blob,encoding:'base64',content:bytes.toString('base64'),size:bytes.length}:{id:42,full_name:'owner/repo',private:options.private??false,visibility:options.private?'private':'public',size:options.size??1,default_branch:'main'});
 };return {reader:new PublicRepositoryReader(transport),requests:()=>requests};
}
test('public assessment uses immutable commit and contains no dynamic decision',async()=>{const f=fixture(),identity=await f.reader.resolve('https://github.com/owner/repo');const result=await f.reader.analyze(identity);assert.equal(result.commitSha,commit);assert.equal(result.disclaimer,STATIC_DISCLAIMER);assert.ok(result.stack.some(s=>s.name==='Next.js'&&s.status==='DETECTED'));assert.ok(!JSON.stringify(result).includes('SHIP'));assert.equal(f.requests(),4);});
for(const input of ['http://github.com/owner/repo','https://evil.test/owner/repo','https://github.com@127.0.0.1/a/b','https://github.com/a/b?url=http://localhost','owner/../secret','owner/repo;curl','https://github.com/a/b/tree/main'])test(`repository URL rejects ${input}`,()=>assert.throws(()=>repositoryInput(input)));
for(const status of [403,404,429,500])test(`public provider ${status} fails safely`,async()=>{await assert.rejects(fixture({status}).reader.resolve('owner/repo'));});
for(const options of [{private:true},{size:20481}])test(`public assessment rejects ${JSON.stringify(options)}`,async()=>{await assert.rejects(fixture(options).reader.resolve('owner/repo'));});
for(const options of [{binary:true},{path:'../../secret'},{mode:'120000'},{mode:'160000'}])test(`hostile/binary source excluded ${JSON.stringify(options)}`,async()=>{const f=fixture(options),result=await f.reader.analyze(await f.reader.resolve('owner/repo'));assert.equal(result.coverage.status,'PARTIAL');assert.equal(result.recommendations.length,0);});
test('unsupported stack is not promoted to verified',async()=>{const f=fixture({dependencies:{unknown:'1'}}),result=await f.reader.analyze(await f.reader.resolve('owner/repo'));assert.ok(result.stack.every(s=>s.status==='NOT_DETECTED'));});
test('cache key binds canonical ID, exact commit, analyzer and schema policy',()=>{assert.notEqual(assessmentKey(42,commit),assessmentKey(43,commit));assert.notEqual(assessmentKey(42,commit),assessmentKey(42,'c'.repeat(40)));assert.notEqual(assessmentKey(42,commit),assessmentKey(42,commit,'lg-static-2'));});
test('truncated repository tree is rejected',async()=>{const f=fixture({truncated:true});await assert.rejects(f.reader.analyze(await f.reader.resolve('owner/repo')));});
