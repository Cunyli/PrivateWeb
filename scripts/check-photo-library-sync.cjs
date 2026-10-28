const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const root=path.resolve(__dirname,'..')
const modules=new Map()
let auth={ok:false,status:401,error:'No session'},calls=0,storageCalls=0,embeddingIds=[]
let nextId=4
const stamp='2026-10-28T00:00:00.123456+00:00'
const state={
 picture_sets:[{id:8,title:'Original',cover_image_url:'/picture/responsive/one/original.webp',cover_image_variants:{},is_published:true}],
 pictures:[{id:1,picture_set_id:8,image_url:'/picture/responsive/one/original.webp',is_published:true,updated_at:stamp},{id:2,picture_set_id:8,image_url:'/picture/responsive/two/original.webp',is_published:false,updated_at:stamp},{id:3,picture_set_id:8,image_url:'/picture/responsive/three/original.webp',is_published:true,updated_at:stamp}],
}
const reviews=new Map([[1,{picture_id:1,state:'keep',reviewed_at:stamp}],[2,{picture_id:2,state:'trash',reviewed_at:stamp}]])
const mutations=[]
const client={
 from(table){
  calls++;state[table]??=[]
  let mode='select',values,filters=[],single=false
  const query={select(){return query},eq(key,value){filters.push(row=>row[key]===value);return query},in(key,values){filters.push(row=>values.includes(row[key]));return query},order(){return query},limit(){return query},
   update(value){mode='update';values=value;return query},insert(value){mode='insert';values=Array.isArray(value)?value:[value];return query},upsert(value){mode='upsert';values=Array.isArray(value)?value:[value];return query},delete(){mode='delete';return query},maybeSingle(){single=true;return query},single(){single=true;return query},
   then(resolve,reject){return Promise.resolve().then(()=>{
    const matching=state[table].filter(row=>filters.every(filter=>filter(row)))
    let result=matching
    if(mode==='delete'){
     assert.notEqual(table,'pictures','An ordinary edit must not destroy photo IDs or curation records')
     state[table]=state[table].filter(row=>!matching.includes(row));result=[]
    }else if(mode==='update'){
     mutations.push({table,ids:matching.map(row=>row.id),values})
     matching.forEach(row=>Object.assign(row,values));result=matching
    }else if(mode==='insert'||mode==='upsert'){
     result=values.map(value=>({...value,...(table==='pictures'?{id:nextId++,is_published:true,updated_at:stamp}:{})}));state[table].push(...result)
    }
    const rows=result.map(row=>({...row}))
    return {data:single?rows[0]||null:rows,error:null}
   }).then(resolve,reject)}
  };return query
 },
 async rpc(name,args){
  calls++
  if(name==='portfolio_curation_index')return {data:[...reviews.values()],error:null}
  assert.equal(name,'apply_portfolio_curation')
  for(const change of args.p_changes){
   const photo=state.pictures.find(row=>row.id===change.picture_id)
   assert.equal(change.decision,'trash');assert.equal(change.expected_updated_at,photo.updated_at)
   assert.equal(change.expected_reviewed_at,reviews.get(photo.id)?.reviewed_at||null)
   photo.is_published=false;reviews.set(photo.id,{picture_id:photo.id,state:'trash',reviewed_at:stamp})
  }
  return {data:{changed:args.p_changes.length},error:null}
 }
}
function load(relative){
 const filename=path.join(root,relative);if(modules.has(filename))return modules.get(filename).exports
 const module={exports:{}};modules.set(filename,module)
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowJs:true}}).outputText
 const local=name=>{
  if(name==='server-only')return{}
  if(name==='next/headers')return{headers:()=>new Headers()}
  if(name==='next/server')return{NextResponse:{json:(value,init)=>new Response(JSON.stringify(value),init)}}
  if(name==='next/cache')return{revalidateTag(){},revalidatePath(){}}
  if(name==='@/utils/admin-auth.server')return{requireAdminRequest:async()=>auth}
  if(name==='@/utils/supabaseAdmin')return{supabaseAdmin:client}
  if(name==='@/lib/photo-curation.server')return{photoCurationTag:'portfolio-photo-curation'}
  if(name==='@/utils/r2-assets.server')return{collectImageAssetKeys:()=>new Set(),deleteObjectKeysFromR2:async()=>{storageCalls++;throw Error('Edits cannot purge storage')}}
  if(name==='@/utils/picture-embeddings.server')return{triggerPictureEmbeddingBackfill:ids=>{embeddingIds=ids}}
  const base=name.startsWith('@/')?name.slice(2):name.startsWith('.')?path.join(path.dirname(relative),name):null
  if(base)for(const ext of ['.ts','.js'])if(fs.existsSync(path.join(root,base+ext)))return load(base+ext)
  throw Error('Unexpected dependency '+name)
 }
 vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{console,process:{env:{}},URL,Request,Response,Headers,fetch:()=>{throw Error('Unexpected network call')},setTimeout},{filename})(local,module,module.exports)
 return module.exports
}
async function main(){
 const {planPictureSync}=load('lib/photo-library-sync.ts')
 const existing=state.pictures.map(row=>({...row}))
 const mixed=planPictureSync([{image_url:'/picture/responsive/one/w640.webp'},{id:2,image_url:'/picture/responsive/two/original.webp'},{image_url:'/picture/responsive/new/original.webp'}],existing)
 assert.deepEqual(Array.from(mixed.rows,row=>row.existing?.id),[1,2,undefined])
 assert.deepEqual(Array.from(mixed.omitted,row=>row.id),[3])
 const replacement=planPictureSync([{id:1,image_url:'/picture/responsive/replacement/original.webp'}],existing)
 assert.equal(replacement.rows[0].existing,undefined,'A new photograph must not inherit the old frame rating')
 assert.throws(()=>planPictureSync([{id:99,image_url:existing[0].image_url}],existing))
 assert.throws(()=>planPictureSync([{id:1,image_url:existing[0].image_url},{id:1,image_url:existing[0].image_url}],existing))
 const repeated=planPictureSync([{image_url:'/picture/responsive/new-family-DSC00111/original.webp'}],[{id:8,image_url:'/picture/responsive/old-family-DSC00111/original.webp'}])
 assert.equal(repeated.rows[0].existing,undefined,'Repeated DSC names are not image identity')
 const route=load('app/api/admin/picture-sets/[id]/route.ts')
 const request=payload=>new Request('http://localhost/api/admin/picture-sets/8',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
 assert.equal((await route.PUT(request({}),{params:{id:'8'}})).status,401);assert.equal(calls,0)
 auth={ok:true,user:{id:'00000000-0000-4000-8000-000000000001'}}
 const response=await route.PUT(request({title:'Updated title',position:'up',is_published:true,pictures:[{id:2,image_url:existing[1].image_url,title:'Previously trashed',tags:[]},{id:1,image_url:existing[0].image_url,title:'Existing excellent',tags:[]},{image_url:'/picture/responsive/new/original.webp',title:'New ungraded',tags:[]}]}),{params:{id:'8'}})
 assert.equal(response.status,200,await response.text())
 assert.deepEqual(state.pictures.map(row=>row.id),[1,2,3,4])
 assert.equal(state.pictures.find(row=>row.id===2).is_published,false,'Editing cannot republish a trashed photograph')
 assert.equal(reviews.get(1).state,'keep');assert.equal(reviews.get(1).reviewed_at,stamp)
 assert.equal(reviews.get(2).state,'trash');assert.equal(reviews.get(2).reviewed_at,stamp)
 assert.equal(reviews.get(3).state,'trash','Omitted frames enter recoverable trash')
 assert.equal(reviews.has(4),false,'New photos start ungraded')
 assert.equal(storageCalls,0)
 assert.deepEqual(Array.from(embeddingIds),[4],'Existing frames should not start redundant embedding jobs')
 assert.ok(mutations.filter(row=>row.table==='pictures').every(row=>!Object.hasOwn(row.values,'is_published')))
 console.log(JSON.stringify({authGate:true,stablePhotoIds:true,excellentRatingPreserved:true,trashCannotRepublish:true,newPhotosUngraded:true,removedFramesRecoverable:true,noStoragePurge:true,exactSourceIdentity:true,embeddingJobsOnlyNewFrames:true},null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
