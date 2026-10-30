const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, imports, env = {}, suffix = '') {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  const context = { module, exports: module.exports, process: { env }, URL, URLSearchParams, Headers, Request,
    TextDecoder, Uint8Array, window: { location: { search: '?next=%2F%2Foutside.invalid' } },
    require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected dependency ${name}`) },
  }
  vm.runInNewContext(source + suffix, context, { filename: file })
  return module.exports
}

const response = { json: (body, options) => ({ body, ...options }) }
async function guards() {
  let outcome = { isHuman: true, isBot: false }, fail = false, received
  const bot = load('utils/bot-protection.server.ts', {
    'server-only': {}, 'next/server': { NextResponse: response },
    'botid/server': { checkBotId: async config => { received = config; if (fail) throw new Error('offline'); return outcome } },
  }, { VERCEL: '1' })
  assert.equal(await bot.enforceBotProtection(), null)
  assert.equal(received.advancedOptions.checkLevel, 'basic')
  outcome = { isHuman: false, isBot: true }
  assert.equal((await bot.enforceBotProtection()).status, 403)
  outcome = { isHuman: false, isBot: false }
  assert.equal((await bot.enforceBotProtection()).status, 403)
  fail = true
  assert.equal((await bot.enforceBotProtection()).status, 503)

  const policy = load('lib/security-policy.ts', {}, { NODE_ENV: 'production', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://backend.example.test', R2_ENDPOINT_URL: 'https://storage.example.test' })
  const privatePolicy = policy.contentSecurityPolicy('test-nonce')
  const script = privatePolicy.split(';').find(value => value.trim().startsWith('script-src '))
  assert.ok(script.includes("'nonce-test-nonce'"))
  assert.ok(script.includes("'strict-dynamic'"))
  assert.ok(!script.includes('unsafe-inline') && !script.includes('unsafe-eval'))
  assert.ok(privatePolicy.includes("frame-ancestors 'none'") && privatePolicy.includes("object-src 'none'"))
  assert.ok(privatePolicy.includes('https://storage.example.test') && privatePolicy.includes('wss://backend.example.test'))
  assert.ok(policy.contentSecurityPolicy().includes("script-src-attr 'none'"))

  const body = load('utils/request-json.server.ts', {})
  const request = value => new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: value })
  assert.equal((await body.readJsonObject(request('{"name":"example"}'))).name, 'example')
  await assert.rejects(body.readJsonObject(request('[]')), error => error.status === 400)
  await assert.rejects(body.readJsonObject(request('{')), error => error.status === 400)
  await assert.rejects(body.readJsonObject(request('"' + 'a'.repeat(20000) + '"')), error => error.status === 413)
}

function loginHarness(existingFactor = false) {
  const state = [], operations = [], destinations = []
  let cursor = 0, effectStarted = false, signedIn = false, aal = 'aal1'
  const runtime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  const pending = { id: 'abandoned', friendly_name: 'Portfolio admin', factor_type: 'totp', status: 'unverified' }
  const other = { id: 'other', friendly_name: 'Another app', factor_type: 'totp', status: 'unverified' }
  const verified = { id: 'verified', factor_type: 'totp', status: 'verified' }
  const supabase = { auth: {
    getSession: async () => ({ data: { session: signedIn ? { access_token: 'test-session' } : null } }),
    signInWithPassword: async values => { operations.push(['password', values.email]); signedIn = true; return { error: null } },
    signOut: async () => { signedIn = false },
    mfa: {
      listFactors: async () => ({ data: { all: existingFactor ? [verified] : [pending, other], totp: existingFactor ? [verified] : [] }, error: null }),
      unenroll: async ({ factorId }) => { operations.push(['remove', factorId]); return { error: null } },
      enroll: async () => { operations.push(['enroll']); return { data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg fill="#000"/>', secret: 'TEST-ONLY-SETUP-KEY' } }, error: null } },
      challengeAndVerify: async ({ factorId, code }) => { operations.push(['verify', factorId]); if (code !== '123456') return { error: new Error('wrong code') }; aal = 'aal2'; return { error: null } },
    },
  } }
  const safe = load('utils/safe-return-path.ts', {})
  const imports = {
    'react/jsx-runtime': runtime,
    'react': {
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }] },
      useEffect(run) { if (!effectStarted) { effectStarted = true; run() } },
    },
    '@/lib/use-document-title': { useDocumentTitle() {} },
    'next/navigation': { useRouter: () => ({ replace: url => destinations.push(url), refresh() {} }) },
    '@/lib/i18n': { I18nProvider: 'provider', useI18n: () => ({ t: text => text, locale: 'en', setLocale() {} }) },
    '@/utils/supabase': { supabase }, '@/utils/safe-return-path': safe,
    '@/components/ui/button': { Button: 'button' }, '@/components/ui/input': { Input: 'input' }, '@/components/ui/label': { Label: 'label' },
  }
  const source = ts.transpileModule(fs.readFileSync('app/login/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(source + '\nmodule.exports.testLogin = LoginInner;', {
    module, exports: module.exports, require: name => { if (!(name in imports)) throw new Error(name); return imports[name] },
    URLSearchParams, window: { location: { search: '?next=%2F%2Foutside.invalid' } },
    fetch: async () => ({ ok: true, json: async () => ({ assuranceLevel: aal }) }),
  })
  const render = () => { cursor = 0; return module.exports.testLogin() }
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  const find = predicate => nodes(render()).find(predicate)
  const input = (id, value) => find(node => node.props?.id === id).props.onChange({ target: { value } })
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  return { render, nodes, find, input, submit, operations, destinations }
}

async function loginFlows() {
  const fresh = loginHarness()
  fresh.render(); await Promise.resolve()
  fresh.input('email', 'admin@example.test'); fresh.input('password', 'test-password')
  await fresh.submit()
  assert.equal(fresh.destinations.length, 0, 'password alone entered admin')
  await fresh.find(node => node.type === 'button' && node.props.onClick && node.props.children === 'Set up authenticator').props.onClick()
  // The event returns void; wait for the bounded mocked enrollment calls.
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.deepEqual(fresh.operations.filter(row => row[0] === 'remove'), [['remove', 'abandoned']])
  assert.ok(fresh.find(node => node.type === 'img').props.src.includes('%23'))
  fresh.input('verification-code', '000000'); await fresh.submit()
  assert.equal(fresh.destinations.length, 0, 'invalid OTP entered admin')
  fresh.input('verification-code', '123456'); await fresh.submit()
  assert.deepEqual(fresh.destinations, ['/admin'], 'unsafe return path escaped the app')

  const returning = loginHarness(true)
  returning.render(); await Promise.resolve()
  returning.input('email', 'admin@example.test'); returning.input('password', 'test-password')
  await returning.submit()
  assert.equal(returning.operations.some(row => row[0] === 'enroll'), false)
  returning.input('verification-code', '123456'); await returning.submit()
  assert.deepEqual(returning.destinations, ['/admin'])
}

async function main() {
  await guards(); await loginFlows()
  console.log('PASS: bot rejection/failure closure, Basic-only mode, private nonce CSP, bounded JSON, MFA enrollment/returning login, invalid OTP rejection and safe redirect.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
