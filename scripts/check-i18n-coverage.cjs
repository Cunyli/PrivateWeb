const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')

function constant(file,name){
  const source=ts.createSourceFile(file,fs.readFileSync(path.join(process.cwd(),file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let value
  ts.forEachChild(source,node=>{if(ts.isVariableStatement(node))for(const entry of node.declarationList.declarations)if(entry.name.getText(source)===name)value=entry.initializer.getText(source)})
  assert.ok(value,`${file}: missing ${name}`)
  return vm.runInNewContext(ts.transpileModule(`result=${value}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{})
}
function parity(zh,en,key=''){
  assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort(),`${key}: locale keys differ`)
  for(const field of Object.keys(zh)){
    const next=key?`${key}.${field}`:field,a=zh[field],b=en[field]
    assert.equal(typeof a,typeof b,`${next}: locale types differ`)
    if(a&&typeof a==='object')parity(a,b,next)
    else if(typeof a==='string'){
      assert.equal(!!a.trim(),!!b.trim(),`${next}: one-sided empty text`)
      if(next!=='languageButton')assert.equal(/[\u3400-\u9fff]/.test(b),false,`${next}: Chinese text in English copy`)
    }
  }
}
const dicts=constant('lib/i18n.tsx','dicts')
parity(dicts.zh,dicts.en)
const booking=constant('components/helsinki-photo-session.tsx','photoSessionCopy')
parity(booking.zh,booking.en)
const feedSource=fs.readFileSync('lib/feed-interface-copy.ts','utf8')
const feedModule={exports:{}}
vm.runInNewContext(ts.transpileModule(feedSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:feedModule,exports:feedModule.exports})
assert.equal(feedModule.exports.feedInterfaceText('它讲什么','en'),'What it covers')
assert.equal(feedModule.exports.feedInterfaceText('公开源','en'),'Public source')
assert.equal(feedModule.exports.feedInterfaceText('Admin only','zh'),'仅管理员')
assert.equal(feedModule.exports.feedInterfaceText('原始内容不应改写','en'),'原始内容不应改写')
const source=ts.createSourceFile('feed.tsx',fs.readFileSync('components/ai-intel-feed.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let translatedLabels=0
function scan(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='ui'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){const value=node.arguments[0].text;if(/[\u3400-\u9fff]/.test(value)){assert.notEqual(feedModule.exports.feedInterfaceText(value,'en'),value,`Missing feed interface translation: ${value}`);translatedLabels++}}ts.forEachChild(node,scan)}scan(source)
const photoSource=ts.createSourceFile('photo.ts',fs.readFileSync('lib/booking-photo-presentation.ts','utf8'),ts.ScriptTarget.Latest,true)
const portraitFunction=photoSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name.text==='portraitTitle')
const portraitScope={}
vm.runInNewContext(ts.transpileModule(portraitFunction.getText(photoSource),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText.replace(/^export /m,''),Object.assign(portraitScope,{exports:{}}))
const title=portraitScope.portraitTitle
assert.equal(title({title:'Original',titles:{zh:'中文标题',en:'English title'}},'en','Photograph'),'English title')
assert.equal(title({title:'Original',titles:{zh:'中文标题',en:'English title'}},'zh','摄影作品'),'中文标题')
assert.equal(title({title:'中文原文'},'en','Photograph'),'Photograph')
assert.equal(title({title:'English only'},'zh','摄影作品'),'摄影作品')
const fill=JSON.parse(fs.readFileSync('docs/i18n-content-fills-20261030.json','utf8'))
assert.ok(fill.updates.every(row=>Object.values(row.before).every(value=>!String(value||'').trim())),'Content fills may only target empty fields')
assert.ok(fill.updates.every(row=>['locations','picture_set_translations','picture_translations'].includes(row.table)),'Fills must not modify photos or ratings')
console.log(JSON.stringify({dictionaryKeys:Object.keys(dicts.en).length,bookingLocaleParity:true,feedInterfaceLabels:translatedLabels,originalFeedTextPreserved:true,localizedPhotoTitles:true,fillRecords:fill.updates.length}))

// Late framework metadata must not replace the selected language. A single
// active owner also prevents nested page/loading views from fighting titles.
const titleSource=fs.readFileSync('lib/use-document-title.ts','utf8'),titleModule={exports:{}},cleanups=[]
const fakeDocument={title:'Server title',head:{}}
let titleObserver
class FakeTitleObserver{
  constructor(callback){this.callback=callback;titleObserver=this;this.disconnected=false}
  observe(){}
  disconnect(){this.disconnected=true}
}
vm.runInNewContext(ts.transpileModule(titleSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:titleModule,exports:titleModule.exports,document:fakeDocument,MutationObserver:FakeTitleObserver,Symbol,require(name){assert.equal(name,'react');return {useEffect(callback){cleanups.push(callback())}}}})
titleModule.exports.useDocumentTitle('English page')
fakeDocument.title='流式原始标题';titleObserver.callback();assert.equal(fakeDocument.title,'English page')
titleModule.exports.useDocumentTitle('Next page');assert.equal(fakeDocument.title,'Next page')
cleanups.pop()();assert.equal(fakeDocument.title,'English page')
cleanups.pop()();assert.equal(titleObserver.disconnected,true)

const React=require('react'),ReactDOMServer=require('react-dom/server')
for(const locale of ['en','zh']){
  const errorModule={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/global-error.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:errorModule,exports:errorModule.exports,require(name){if(name==='@/lib/i18n')return {I18nProvider:({children})=>children,useI18n:()=>({locale,setLocale(){}})};if(name==='@/lib/use-document-title')return {useDocumentTitle(){}};return require(name)}})
  const html=ReactDOMServer.renderToStaticMarkup(React.createElement(errorModule.exports.default,{error:new Error('private-backend-debug-text'),reset(){}}))
  assert.ok(html.includes(locale==='en'?'Try again':'重新载入'))
  assert.equal(html.includes('private-backend-debug-text'),false)
}
console.log('PASS: localized browser titles survive streamed metadata; nested owners clean up; standalone error UI supports both languages without exposing raw errors.')
