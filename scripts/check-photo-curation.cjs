const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const modules = new Map()
let auth = { ok: false, status: 401, error: 'No session' }
let calls = 0, stale = false, applied, invalidated = []
const stamp = '2026-10-28T01:00:00.123456+00:00'
const tables = {
  pictures: Array.from({length:1001},(_,index)=>({ id:index+1,picture_set_id:8,title:`Original ${index+1}`,image_url:`/picture/responsive/frame-${index+1}-DSC00111/original.webp`,is_published:true,updated_at:stamp,order_index:index })),
  picture_sets: [{id:8,title:'Original series',subtitle:'Original subtitle',is_published:true}],
  picture_set_translations: [{picture_set_id:8,locale:'zh',title:'原系列',subtitle:'原副标题'}],
  picture_taggings: [...Array.from({length:1000},(_,index)=>({picture_id:1,tag_id:index,tag:{name:'landscape',type:'topic'}})),{picture_id:1001,tag_id:1001,tag:{name:'model:Rico',type:'topic'}}],
}
const client = {
  from(name) {
    calls++
    assert.ok(tables[name],`Unexpected table ${name}`)
    let start=0,end=100000,filters=[]
    const query={
      select(){return query},order(){return query},range(a,b){start=a;end=b+1;return query},eq(key,value){filters.push([key,value]);return query},
      then(resolve,reject){return Promise.resolve({data:tables[name].filter(row=>filters.every(([key,value])=>row[key]===value)).slice(start,end),error:null}).then(resolve,reject)},
    }
    return query
  },
  async rpc(name,args) {
    calls++
    if(name==='portfolio_curation_index')return {data:[{picture_id:1,state:'keep',reviewed_at:stamp,image_width:640,image_height:960}],error:null}
    if(name==='portfolio_curation_assets_index')return {data:[{id:-1,source_url:'/photo-session/cover.jpg',preview_url:'/photo-session/cover-640.webp',detail_url:'/photo-session/cover-1280.webp',title:'cover',updated_at:stamp,reviewed_at:null,state:'unreviewed',image_width:640,image_height:426}],error:null}
    if(name==='apply_portfolio_curation'){applied=args;return stale?{data:null,error:{code:'40001'}}:{data:{changed:args.p_changes.length},error:null}}
    throw new Error(`Unexpected RPC ${name}`)
  },
}
function load(relative) {
  const filename=path.join(root,relative)
  if(modules.has(filename))return modules.get(filename).exports
  const module={exports:{}};modules.set(filename,module)
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowJs:true}}).outputText
  const requireLocal=name=>{
    if(name==='server-only')return {}
    if(name==='next/server')return {NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),{...init,headers:{'content-type':'application/json',...(init?.headers||{})}})}}
    if(name==='next/cache')return {unstable_cache:fn=>fn,revalidateTag:tag=>invalidated.push(tag),revalidatePath:value=>invalidated.push(value)}
    if(name==='@/utils/admin-auth.server')return {requireAdminRequest:async()=>auth}
    if(name==='@/utils/supabaseAdmin')return {supabaseAdmin:client}
    const base=name.startsWith('@/')?name.slice(2):name.startsWith('.')?path.join(path.dirname(relative),name):null
    if(base){for(const ext of ['.ts','.tsx','.js'])if(fs.existsSync(path.join(root,base+ext)))return load(base+ext)}
    throw new Error(`Unexpected dependency ${name}`)
  }
  vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{console,process:{env:{NEXT_PUBLIC_BUCKET_URL:'https://images.example.invalid'}},URL,Request,Response,Headers},{filename})(requireLocal,module,module.exports)
  return module.exports
}
const request=body=>new Request('https://portfolio.example.invalid/api/admin/photo-curation',{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)})
async function main(){
  const helper=load('lib/photo-curation.ts')
  const row={pictureId:1,decision:'keep',expectedUpdatedAt:stamp,expectedReviewedAt:null,width:640,height:960}
  assert.equal(helper.parseCurationChanges({changes:[row]})[0].expectedUpdatedAt,stamp)
  assert.equal(helper.parseCurationChanges({changes:[{...row,pictureId:-1}]})[0].pictureId,-1)
  for(const bad of [null,{}, {changes:[]},{changes:[row,row]},{changes:[{...row,pictureId:0}]},{changes:[{...row,pictureId:1.5}]},{changes:[{...row,decision:'delete-everything'}]},{changes:[{...row,expectedUpdatedAt:'bad'}]},{changes:[{...row,width:0}]},{changes:Array(2001).fill(row)}])assert.throws(()=>helper.parseCurationChanges(bad))
  assert.equal(helper.curationVisible({ids:[2829],keptPortraits:[]},{id:'portrait-2829',src:'/unknown'}),false)
  assert.equal(helper.curationVisible({ids:[2829],keptPortraits:[]},{src:'/photo-session/optimized/dsc04140-640.webp'}),false)
  assert.equal(helper.curationVisible({ids:[2829],keptPortraits:[]},{id:999,src:'/photo-session/optimized/dsc04140-640.webp'}),true,'An explicit different DB record must not be rejected merely for a repeated filename')
  assert.equal(helper.curationVisible({ids:[-2],keptPortraits:[]},{src:'/photo-session/optimized/master1-1280.webp'}),false)
  assert.notEqual(helper.curationAssetFamily('/picture/responsive/a-DSC00111/w640.webp'),helper.curationAssetFamily('/picture/responsive/b-DSC00111/w640.webp'))
  const selector=load('lib/photo-session-series.ts')
  const empty={ids:[],keptPortraits:[]}
  const baseline=selector.selectMomentSeries([], 'zh', empty)
  const ziyang=baseline.find(group=>group.id==='ziyang-stockholm')
  const untouched=ziyang.photos.filter(photo=>photo.id!=='portrait-2829').map(photo=>photo.id)
  const curated={id:'curated-shoot',title:'Ziyang',place:'Stockholm',note:'',tags:[],curated:true,replaces:['ziyang-stockholm'],photos:[{id:'portrait-999',src:'/new.webp',sourceName:'NEW-FRAME',title:'',place:'Stockholm',note:'',tags:[],alt:'New favorite'}]}
  const merged=selector.selectMomentSeries([curated],'zh',{ids:[2829],keptPortraits:[]}).find(group=>group.id==='curated-shoot')
  assert.ok(merged.photos.some(photo=>photo.id==='portrait-999'))
  for(const id of untouched)assert.ok(merged.photos.some(photo=>photo.id===id),'Excellent picks suppressed an unmarked photograph')
  assert.ok(!merged.photos.some(photo=>photo.id==='portrait-2829'))
  const book=load('lib/curated-portrait-book.ts')
  assert.equal(book.curatedPortraitBookPages(empty,'https://images.example.invalid').flat().length,12)
  const hiddenBook=book.curatedPortraitBookPages({ids:[2830],keptPortraits:[]},'https://images.example.invalid').flat()
  assert.equal(hiddenBook.length,11)
  assert.ok(!hiddenBook.some(photo=>photo.src.includes('DSC04154')))
  const preferred=book.curatedPortraitBookPages({ids:[],keptPortraits:[{id:999,src:'/picture/responsive/favorite/original.webp',title:'Favorite',width:640,height:960}]},'https://images.example.invalid')
  assert.equal(preferred[0][0].height,960)
  assert.ok(preferred[0][0].src.includes('favorite/w640.webp'))
  const series=load('lib/photo-series.ts')
  assert.equal(series.photoSeries(9,'','',['model:David','series:same-trip','location:appenzell']).id,series.photoSeries(9,'','',['model:David','series:same-trip','location:switzerland']).id)
  assert.notEqual(series.photoSeries(9,'','',['model:Hongjia','series:cherry']).id,series.photoSeries(9,'','',['model:Hongjia','series:alps']).id)
  const route=load('app/api/admin/photo-curation/route.ts')
  assert.equal((await route.GET(new Request('https://portfolio.example.invalid/api/admin/photo-curation'))).status,401)
  assert.equal((await route.POST(request('bad json'))).status,401)
  assert.equal(calls,0,'Unauthenticated requests touched the library')
  auth={ok:false,status:403,error:'Not an administrator'}
  assert.equal((await route.POST(request({changes:[row]}))).status,403)
  assert.equal(calls,0)
  auth={ok:true,user:{id:'00000000-0000-4000-8000-000000000001'}}
  const libraryResponse=await route.GET(new Request('https://portfolio.example.invalid/api/admin/photo-curation'))
  assert.equal(libraryResponse.status,200)
  const library=await libraryResponse.json()
  assert.equal(library.items.length,1002,'Photos after the Supabase 1000-row limit are missing')
  assert.equal(library.items.find(photo=>photo.id===1001).groupTitle,'Rico','Tags after the 1000-row limit are missing')
  assert.ok(library.groups.some(group=>group.id==='fixed-assets'))
  assert.equal(libraryResponse.headers.get('cache-control'),'private, no-store')
  assert.equal((await route.POST(request('bad json'))).status,400)
  assert.equal((await route.POST(request({changes:[]}))).status,400)
  const result=await route.POST(request({changes:[row,{...row,pictureId:-1,decision:'trash'}]}))
  assert.equal(result.status,200)
  assert.deepEqual(Array.from(applied.p_changes,change=>change.picture_id),[1,-1],'Unmarked IDs must not be added to a batch')
  assert.equal(applied.p_changes[0].decision,'keep')
  assert.equal(applied.p_changes[1].decision,'trash')
  assert.equal(applied.p_reviewer,auth.user.id)
  assert.ok(invalidated.includes('portfolio-photo-curation')&&invalidated.includes('/'))
  stale=true
  assert.equal((await route.POST(request({changes:[row]}))).status,409)
  console.log(JSON.stringify({authenticatedOnly:true,invalidBatchesRejected:true,unmarkedIdsUntouched:true,zeroTrashOneExcellent:true,staticCopiesBoundToExactRecords:true,libraryPagination:'1001 DB + 1 static',tagPagination:true,concurrentChangeConflict:409,publicCacheInvalidation:true},null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
