const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const modules = new Map()
let auth = { ok: false, status: 401, error: 'No session' }
let calls = 0, stale = false, applied, invalidated = []
let textureFetches=0
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
    if(name==='portfolio_curation_catalog')return {data:{ids:[2],assets:[],photos:[{id:1,src:'/picture/responsive/approved/original.webp'},{id:2,src:'/picture/responsive/deleted/original.webp'},{id:3,src:'https://unapproved.example.invalid/private.webp'}]},error:null}
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
    if(name==='next/server')return {NextResponse:class extends Response{static json(body,init){return new Response(JSON.stringify(body),{...init,headers:{'content-type':'application/json',...(init?.headers||{})}})}}}
    if(name==='next/cache')return {unstable_cache:fn=>fn,revalidateTag:tag=>invalidated.push(tag),revalidatePath:value=>invalidated.push(value)}
    if(name==='@/utils/admin-auth.server')return {requireAdminRequest:async()=>auth}
    if(name==='@/utils/supabaseAdmin')return {supabaseAdmin:client}
    const base=name.startsWith('@/')?name.slice(2):name.startsWith('.')?path.join(path.dirname(relative),name):null
    if(base){
      if(base.endsWith('.json'))return JSON.parse(fs.readFileSync(path.join(root,base),'utf8'))
      for(const ext of ['', '.ts','.tsx','.js','.mjs'])if(fs.existsSync(path.join(root,base+ext)) && fs.statSync(path.join(root,base+ext)).isFile())return load(base+ext)
    }
    throw new Error(`Unexpected dependency ${name}`)
  }
  vm.runInNewContext(`(function(require,module,exports){${output}\n})`,{console,process:{env:{NEXT_PUBLIC_BUCKET_URL:'https://images.example.invalid'}},URL,Request,Response,Headers,AbortSignal,fetch:async(url,options)=>{textureFetches++;assert.equal(new URL(url).origin,'https://images.example.invalid');assert.equal(options.redirect,'error');return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/webp',etag:'"texture-test"'}})}},{filename})(requireLocal,module,module.exports)
  return module.exports
}
const request=body=>new Request('https://portfolio.example.invalid/api/admin/photo-curation',{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)})
async function main(){
  const {DisplayFrameBudget}=load('lib/display-frame-budget.ts')
  for(const hz of [60,90,120,144,240]){
    const budget=new DisplayFrameBudget(); let now=100
    for(let i=0;i<120;i++){now+=1000/hz;budget.observe(now)}
    assert.ok(Math.abs(budget.milliseconds-1000/hz)<.01)
    for(let i=0;i<90;i++){now+=1000/30;budget.observe(now)}
    assert.ok(Math.abs(budget.milliseconds-1000/hz)<.01,'Overload must not lower a demonstrated display target')
    budget.resume(); budget.observe(now+10000)
    assert.ok(Math.abs(budget.milliseconds-1000/hz)<.01,'A hidden-tab interval is not a display sample')
  }
  const jitter=new DisplayFrameBudget(); let time=100
  for(const ms of [...Array(6).fill(6),...Array.from({length:120},(_,i)=>[16.67,17,16,18][i%4])]){time+=ms;jitter.observe(time)}
  assert.equal(jitter.milliseconds,1000/60,'Startup callback bursts must not be mistaken for a 165Hz display')
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
  const empty={ids:[],featuredIds:[],keptPortraits:[],featuredAssets:[],covers:{},selectedCover:null}
  const fixturePhoto={id:999,src:'/picture/responsive/favorite/original.webp',title:'Favorite',width:640,height:960,setId:9,tags:['model:Example','location:helsinki'],order:0}
  const featured={...empty,featuredIds:[999],keptPortraits:[fixturePhoto]}
  assert.equal(helper.curationFeatured(empty,fixturePhoto),false,'Unrated images must not enter a showcase')
  assert.equal(helper.curationFeatured(featured,fixturePhoto),true)
  assert.equal(helper.curationFeatured({...featured,ids:[999]},fixturePhoto),false,'Trash overrides stale approved IDs')
  assert.equal(helper.curationFeatured(featured,{src:'/unknown.webp'}),false,'Unknown sources must not become fallback photos')
  assert.equal(helper.curationFeatured(featured,{src:'https://images.example.invalid/picture/responsive/favorite/w640.webp'}),true)
  const curated={id:'curated-shoot',title:'Example',place:'Helsinki',note:'',tags:[],curated:true,photos:[{id:'portrait-999',src:fixturePhoto.src,title:'',place:'',note:'',tags:[],alt:'Favorite'},{id:'portrait-998',src:'/unrated.webp',title:'',place:'',note:'',tags:[],alt:'Unrated'}]}
  assert.equal(selector.selectMomentSeries([], 'zh', empty).length,0,'No old static booking series may be resurrected')
  const strictSeries=selector.selectMomentSeries([curated], 'zh', featured)
  assert.deepEqual(Array.from(strictSeries[0].photos,photo=>photo.id),['portrait-999'])
  assert.equal(selector.bookingPortraitGroups(featured,'https://images.example.invalid').length,0,'One lone frame must not become a standalone shoot')
  const shootPhotos=[
    {...fixturePhoto,id:910,tags:['model:A','series:full','location:stockholm']},
    {...fixturePhoto,id:911,tags:['model:A','series:full','location:stockholm']},
    {...fixturePhoto,id:912,tags:['model:B','series:single-b','location:helsinki']},
    {...fixturePhoto,id:913,tags:['model:C','series:single-c','location:appenzell']},
    {...fixturePhoto,id:914,tags:['model:D','series:unrated']},
  ]
  const groupedState={...empty,featuredIds:[910,911,912,913],keptPortraits:shootPhotos}
  const grouped=selector.bookingPortraitGroups(groupedState,'https://images.example.invalid')
  assert.deepEqual(Array.from(grouped,group=>group.photos.length),[2,2],'Complete shoots stay together and single frames share one selection')
  assert.equal(grouped[1].kind,'highlights')
  assert.deepEqual(Array.from(grouped[1].photos,photo=>[photo.id,photo.title,photo.place]),[['portrait-912','B','Helsinki'],['portrait-913','C','Appenzell']],'Mixed selection must preserve per-photo person and place')
  assert.equal(new Set(grouped.flatMap(group=>group.photos.map(photo=>photo.id))).size,4,'Selections must not duplicate a frame')
  const recull=selector.bookingPortraitGroups({...groupedState,ids:[913]},'https://images.example.invalid')
  assert.deepEqual(Array.from(recull,group=>Array.from(group.photos,photo=>photo.id)),[['portrait-910','portrait-911']],'After a cull, neither removed frames nor a single-photo heading may return')
  const presentation=load('lib/booking-photo-presentation.ts')
  const owner={...fixturePhoto,id:300,tags:['model:Lijie','series:personal','display:booking-intro-2']}
  const withdrawn={...fixturePhoto,id:301,tags:['model:Hongjia','series:swiss','display:exclude-booking']}
  const hero={...fixturePhoto,id:302,tags:['model:Junjie','series:travel','display:booking-hero']}
  const process={...fixturePhoto,id:303,tags:['series:florence','display:booking-process']}
  const remainder={...fixturePhoto,id:304,tags:['model:Xiya','series:stockholm']}
  const placementState={...empty,featuredIds:[300,301,302,303,304],keptPortraits:[owner,withdrawn,hero,process,remainder]}
  const placement=presentation.bookingPlacement(placementState)
  assert.deepEqual(Array.from(placement.photos,p=>p.id),[302,304],'Booking samples exclude the owner and withdrawn series')
  assert.equal(placement.hero.id,302);assert.equal(placement.process.id,303)
  const ownProcess={...fixturePhoto,id:305,tags:['model:Lijie','display:booking-process','display:booking-process-1']}
  const orderedProcess=presentation.bookingPlacement({...placementState,featuredIds:[...placementState.featuredIds,305],keptPortraits:[...placementState.keptPortraits,ownProcess]})
  assert.deepEqual(Array.from(orderedProcess.processPhotos,p=>p.id),[305,303],'Explicit Why me placements must allow the owner without entering client casework')
  assert.deepEqual(Array.from(orderedProcess.gallery,p=>p.id),[304])
  const master1={id:-2,src:'/photo-session/optimized/master1-1280.webp',source:'/private/master1.jpg',previewUrl:'/photo-session/optimized/master1-640.webp',title:'master1',width:640,height:960}
  const withMaster={...placementState,featuredIds:[...placementState.featuredIds,-2],featuredAssets:[master1]}
  assert.deepEqual(Array.from(presentation.bookingPlacement(withMaster).processPhotos,p=>p.id),[303,-2],'The selected fixed asset must keep its identity and follow the chosen Why me sequence')
  assert.deepEqual(Array.from(presentation.bookingPlacement({...withMaster,ids:[-2]}).processPhotos,p=>p.id),[303],'Removed master1 must never return through a fixed placement')
  const {paperPixelRatio}=load('lib/soft-page-resolution.ts')
  assert.equal(paperPixelRatio(1379,808,2,8192),2,'A Retina book must retain native density')
  assert.equal(paperPixelRatio(700,420,3,4096),3,'A small phone book must retain 3x density')
  const largeRatio=paperPixelRatio(4000,1800,2,4096)
  assert.ok(4000*1800*largeRatio*largeRatio<=6_000_001 && 4000*largeRatio<=4096,'Large canvases must stay within pixel and GPU limits')
  assert.deepEqual(Array.from(placement.intro,p=>p.id),[300],'Only explicitly chosen, approved intro portraits may appear in the introduction')
  const hiddenGallery={...placementState,keptPortraits:placementState.keptPortraits.map(p=>p.id===304?{...p,tags:[...p.tags,'display:exclude-booking-gallery']}:p)}
  assert.equal(presentation.bookingPlacement(hiddenGallery).gallery.length,0,'A withdrawn series must stay out of gallery without hiding its hero')
  const joined=selector.bookingPortraitGroups({...empty,featuredIds:[920,921],keptPortraits:[
    {...fixturePhoto,id:920,tags:['model:Burong','model:Yujun','series:one','display:booking-group:lijiang']},
    {...fixturePhoto,id:921,tags:['model:Junjie','series:two','display:booking-group:lijiang']},
  ]},'https://images.example.invalid')
  assert.equal(joined.length,1);assert.equal(joined[0].title,'Junjie, Burong, Yujun');assert.equal(joined[0].place,'Lijiang')
  assert.deepEqual(Array.from(joined[0].photos,p=>p.title),['Burong & Yujun','Junjie'],'Authored groupings must retain original person metadata')
  assert.deepEqual(Array.from(placement.gallery,p=>p.id),[304],'Hero and process photographs must not repeat in the gallery')
  const source=load('lib/viewer-photo-source.ts')
  const rendition=source.viewerPhotoDimensions({id:'portrait-2886',url:'/picture/responsive/image-1782610139773-17-f53f0e0c-9932-4fd3-8d5e-aa8d4024f76a-DSC07258/original.jpg'})
  assert.ok(rendition && rendition.width>1280,'Booking lightbox IDs must resolve their full display rendition')
  const book=load('lib/curated-portrait-book.ts')
  assert.equal(book.curatedPortraitBookPages(empty,'https://images.example.invalid').flat().length,0,'Empty approved pool must not restore the old book')
  const preferred=book.curatedPortraitBookPages(featured,'https://images.example.invalid')
  assert.equal(preferred.flat().length,1)
  assert.equal(preferred[0][0].height,960)
  assert.ok(preferred[0][0].src.includes('pictureId=999&width=640'),'WebGL book images must use the approved same-origin texture endpoint')
  const varied=[...Array.from({length:6},(_,i)=>({...fixturePhoto,id:100+i,tags:['model:A']})),...Array.from({length:6},(_,i)=>({...fixturePhoto,id:200+i,tags:['model:B']}))]
  assert.deepEqual(Array.from(selector.showcasePortraits(varied,4),photo=>photo.tags[0]),['model:A','model:B','model:A','model:B'],'Book pages should sample different tagged shoots before repeating one person')
  const catalog=load('lib/photo-curation-catalog.ts')
  const visibility=catalog.catalogVisibility({ids:[4],assets:[],photos:[
    {...fixturePhoto,id:1,setId:1,setPublished:true,booking:false,setCoverSrc:'/unrated-cover.webp',tags:[],order:0},
    {...fixturePhoto,id:2,setId:1,setPublished:true,booking:false,setCoverSrc:'/unrated-cover.webp',tags:['display:cover'],order:1},
    {...fixturePhoto,id:3,setId:2,setPublished:false,booking:true,setCoverSrc:null,tags:[],order:0},
    {...fixturePhoto,id:4,setId:1,setPublished:true,booking:false,setCoverSrc:null,tags:[],order:0}]})
  assert.equal(visibility.covers[1].id,2)
  assert.equal(visibility.covers[2],undefined,'Private portrait parent must not become a normal public collection')
  assert.ok(!visibility.featuredIds.includes(4))
  const covers=catalog.withFeaturedCovers([{id:1,cover_image_url:'/old.webp'},{id:8,cover_image_url:'/unrated.webp'}],visibility)
  assert.equal(covers[0].cover_image_url,fixturePhoto.src)
  assert.equal(covers[0].cover_image_width,640,'Cover dimensions must be available before lazy image loading')
  assert.equal(covers[0].cover_image_height,960)
  assert.equal(covers[1].cover_image_url,'','Unrated-only collections must have no photo cover')
  assert.equal(helper.curationVisible(visibility,{id:998}),true,'Unrated photos remain available to ordinary portfolio views')
  assert.equal(catalog.selectedCollection(visibility).id,0)
  const {initialStylePreviews}=load('lib/photography-style-previews.ts')
  const previewPhoto={...fixturePhoto,id:1,setId:1,order:0,createdAt:stamp,booking:false,setPublished:true,tags:['Landscape'],translations:{en:{title:'Original'},zh:{title:'原文'}}}
  const previewCatalog={ids:[4],assets:[],photos:[previewPhoto,{...previewPhoto,id:3,setPublished:false},{...previewPhoto,id:4}]}
  const previewInitial={pictureSets:[{id:1,title:'Original',subtitle:'',cover_image_url:fixturePhoto.src}],transMap:{}}
  const previewSeed=initialStylePreviews(previewCatalog,previewInitial,{1:['大师'],3:['大师'],4:['大师']})
  assert.equal(previewSeed.landscape.pictures[0].id,1,'Master categories as well as tags must seed first-load previews')
  assert.ok(!Object.values(previewSeed).flatMap(style=>style.pictures).some(photo=>[3,4].includes(photo.id)),'Private and deleted photographs cannot enter the seed')
  const {portfolioEntryPhotos}=load('lib/portfolio-entry-preview.ts')
  const entryCover=(id,frame)=>({id,src:`/picture/responsive/${frame}/original.webp`,width:2400,height:1600})
  const entryVisibility={...helper.emptyCuration,ids:[3],featuredIds:[1,2,3,5,6],keptPortraits:[{id:2}],covers:{
    110:entryCover(1,'scenery-a'),98:entryCover(2,'client'),95:entryCover(3,'removed'),101:entryCover(4,'unrated'),108:entryCover(5,'scenery-b'),107:{...entryCover(6,'scenery-a'),src:'/picture/responsive/scenery-a/w1280.webp'},
  }}
  assert.deepEqual(Array.from(portfolioEntryPhotos(entryVisibility),photo=>photo.id),[1,5],'The portfolio doorway must exclude removed, unrated, portrait and duplicate frames')
  assert.equal(portfolioEntryPhotos({...entryVisibility,ids:[1,2,3,4,5,6]}).length,0,'An empty approved pool must not restore static images')
  const series=load('lib/photo-series.ts')
  assert.equal(series.curationGroup(112,'Portrait Booking Samples','',['model:A']).id,'portrait-pool')
  assert.equal(series.curationGroup(120,'Other title','',['portrait-library','model:B']).id,'portrait-pool')
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
  const texture=load('app/api/photo-texture/route.ts')
  const textureRequest=params=>new Request('https://portfolio.example.invalid/api/photo-texture?'+params)
  assert.equal((await texture.GET(textureRequest('pictureId=1&width=9999'))).status,400)
  assert.equal((await texture.GET(textureRequest('pictureId=-1'))).status,400)
  assert.equal((await texture.GET(textureRequest('pictureId=2'))).status,404)
  assert.equal((await texture.GET(textureRequest('pictureId=3'))).status,404,'Texture endpoint must not fetch arbitrary origins')
  assert.equal((await texture.GET(textureRequest('pictureId=999'))).status,404)
  assert.equal(textureFetches,0)
  const image=await texture.GET(textureRequest('pictureId=1&width=640&src=http://127.0.0.1/private'))
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp')
  assert.equal(image.headers.get('cross-origin-resource-policy'),'same-origin');assert.equal(textureFetches,1)
  console.log(JSON.stringify({authenticatedOnly:true,invalidBatchesRejected:true,unmarkedIdsUntouched:true,zeroTrashOneExcellent:true,staticCopiesBoundToExactRecords:true,libraryPagination:'1001 DB + 1 static',tagPagination:true,bookingOnlyRatedOne:true,noStaticFallback:true,coversOnlyRatedOne:true,portfolioEntryApprovedOnly:true,unratedArchivePreserved:true,pooledPortraitLibrary:true,balancedShowcase:true,sameOriginTexturesApprovedOnly:true,textureProxyCannotFetchArbitraryUrls:true,concurrentChangeConflict:409,publicCacheInvalidation:true},null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
