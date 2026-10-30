const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const {createRequire}=require('node:module')
const project=path.resolve(__dirname,'..')
const requireProject=createRequire(project+'/package.json')
const ts=requireProject('typescript')
function load(relative,imports,env={}){
 const output=ts.transpileModule(fs.readFileSync(path.join(project,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
 const module={exports:{}}
 const requireMock=name=>{if(name in imports)return imports[name];throw new Error('Unexpected dependency '+name)}
 vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{URL,Headers,Request,process:{env}},{filename:relative})(requireMock,module,module.exports)
 return module.exports
}
async function main(){
 let calls=0,user=null,providerError=null,receivedToken='',aal='aal1',claimSubject='owner-id',claimsError=null
 const imports={'@/utils/supabaseAdmin':{supabaseAdmin:{auth:{async getUser(token){calls++;receivedToken=token;return{data:{user},error:providerError}},async getClaims(){return {data:{claims:{aal,sub:claimSubject}},error:claimsError}}}}}}
 const env={ADMIN_EMAILS:'owner@example.test'}
 const auth=load('utils/admin-auth.server.ts',imports,env)
 const req=token=>new Request('http://localhost/api/admin/session',{headers:token?{authorization:token}:{}})
 assert.equal((await auth.requireAdminRequest(req())).status,401);assert.equal(calls,0)
 assert.equal((await auth.requireAdminRequest(req('Bearer invalid'))).status,401)
 user={email:'outsider@example.test',email_confirmed_at:'2026-01-01'}
 assert.equal((await auth.requireAdminRequest(req('Bearer test'))).status,403)
 user={email:'owner@example.test',email_confirmed_at:null}
 assert.equal((await auth.requireAdminRequest(req('Bearer test'))).status,403)
 user={id:'owner-id',email:'Owner@Example.Test',email_confirmed_at:'2026-01-01'}
 assert.equal((await auth.requireAdminIdentity(req('Bearer verified-test-token'))).ok,true)
 assert.equal((await auth.requireAdminRequest(req('Bearer verified-test-token'))).status,403)
 aal='aal2'
 assert.equal((await auth.requireAdminRequest(req('Bearer verified-test-token'))).ok,true)
 assert.equal(receivedToken,'verified-test-token')
 claimSubject='someone-else'
 assert.equal((await auth.requireAdminRequest(req('Bearer verified-test-token'))).status,401)
 claimSubject='owner-id';claimsError={message:'bad signature'}
 assert.equal((await auth.requireAdminRequest(req('Bearer tampered-test-token'))).status,401)
 claimsError=null
 const publicOnly=load('utils/admin-auth.server.ts',imports,{NEXT_PUBLIC_ADMIN_EMAILS:'owner@example.test'})
 assert.equal((await publicOnly.requireAdminRequest(req('Bearer test'))).status,500)
 const {safeReturnPath}=load('utils/safe-return-path.ts',{})
 for(const value of ['https://outside.test','//outside.test','/\\outside.test','/%5coutside.test','/%2f%2foutside.test','javascript:alert(1)','/admin%0aLocation:outside','/%'])assert.equal(safeReturnPath(value),'/admin',value)
 for(const value of ['/admin','/admin/portraits','/ai-feed?mode=reading#today'])assert.equal(safeReturnPath(value),value)
 let budgetData=[{allowed:true,retry_after:0}],budgetError=null,budgetCall
 const budgets=load('utils/public-request-budget.server.ts',{
  'server-only':{},
  'node:crypto':require('node:crypto'),
  'node:net':require('node:net'),
  'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},
  '@/utils/supabaseAdmin':{supabaseAdmin:{async rpc(name,args){budgetCall={name,args};return{data:budgetData,error:budgetError}}}}
 },{SUPABASE_SERVICE_ROLE_KEY:'test-only-hmac-secret',VERCEL:'1'})
 const visitor=new Request('https://example.test/api',{headers:{'x-vercel-forwarded-for':'192.0.2.10'}})
 assert.equal(await budgets.enforcePublicRequestBudget('booking',visitor),null)
 assert.equal(budgetCall.name,'consume_portfolio_request_budget')
 assert.equal(budgetCall.args.route_name,'booking')
 assert.match(budgetCall.args.client_key,/^[a-f0-9]{64}$/)
 assert.equal(budgetCall.args.client_key.includes('192.0.2.10'),false)
 const different=new Request('https://example.test/api',{headers:{'x-vercel-forwarded-for':'192.0.2.11'}})
 assert.notEqual(budgets.requestClientKey(visitor),budgets.requestClientKey(different))
 const spoofed=new Request('https://example.test/api',{headers:{'x-forwarded-for':'192.0.2.10'}})
 assert.equal((await budgets.enforcePublicRequestBudget('booking',spoofed)).status,503)
 budgetData=[{allowed:false,retry_after:42}]
 const limited=await budgets.enforcePublicRequestBudget('semantic-search',visitor)
 assert.equal(limited.status,429);assert.equal(limited.headers['Retry-After'],'42')
 budgetData=null;budgetError={code:'TEST_UNAVAILABLE',message:'private provider detail'}
 const unavailable=await budgets.enforcePublicRequestBudget('booking',visitor)
 assert.equal(unavailable.status,503)
 assert.equal(JSON.stringify(unavailable.body).includes('private provider detail'),false)
 console.log(JSON.stringify({sharedBudgetAllowed:true,sharedBudgetLimited:true,budgetFailureClosed:true,missingTokenRejected:true,invalidSessionRejected:true,outsiderRejected:true,unverifiedEmailRejected:true,verifiedPrivateAllowlistAccepted:true,mfaRequiredForPrivateData:true,bootstrapWithoutMfaAllowed:true,invalidClaimsRejected:true,clientIpPseudonymized:true,untrustedIpRejected:true,publicAllowlistCannotAuthorize:true,externalRedirectPayloadsRejected:8,validLocalReturnsPreserved:true},null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
