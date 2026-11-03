const statuses = new Set(["wanted", "researching", "bought", "archived"])

export class ShoppingMemoError extends Error {
  constructor(message, status = 400) { super(message); this.name = "ShoppingMemoError"; this.status = status }
}

function textField(value, name, max, required = false) {
  if (typeof value !== "string") throw new ShoppingMemoError(`${name}格式不正确。`)
  const text = value.trim()
  if (text.length > max || (required && !text)) throw new ShoppingMemoError(`${name}不能为空或超过${max}字。`)
  return text
}

export function normalizeShoppingMemo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ShoppingMemoError("请提交有效的采购备忘录。")
  const id = textField(value.id, "编号", 100, true)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new ShoppingMemoError("编号格式不正确。")
  const memo = {
    id,
    title: textField(value.title, "物品名称", 150, true),
    category: textField(value.category, "分类", 60, true),
    budget: textField(value.budget ?? "", "预算", 100),
    details: textField(value.details ?? "", "备注", 4000),
    url: textField(value.url ?? "", "链接", 2000),
    status: value.status,
  }
  if (!statuses.has(memo.status)) throw new ShoppingMemoError("状态格式不正确。")
  if (memo.url) {
    let url
    try { url = new URL(memo.url) } catch (error) {
      if (!(error instanceof TypeError)) throw error
      throw new ShoppingMemoError("请输入完整的 HTTPS 商品链接。")
    }
    if (url.protocol !== "https:" || url.username || url.password) throw new ShoppingMemoError("只支持不含账号信息的 HTTPS 链接。")
    memo.url = url.href
  }
  return memo
}

export function applyShoppingMemo(catalog, memoInput, expectedUpdatedAt, now) {
  const memo = normalizeShoppingMemo(memoInput)
  const existing = catalog.memos || []
  if (!Array.isArray(existing)) throw new Error("Invalid memo storage")
  const previous = existing.find(item => item.id === memo.id)
  if (previous && (typeof expectedUpdatedAt !== "string" || previous.updatedAt !== expectedUpdatedAt)) {
    throw new ShoppingMemoError("这条备忘录已有更新，请刷新后再保存；当前草稿仍保留。", 409)
  }
  if (!previous && expectedUpdatedAt !== undefined) throw new ShoppingMemoError("这条备忘录已变化，请刷新后重试。", 409)
  if (!previous && existing.length >= 500) throw new ShoppingMemoError("备忘录已满，请先整理现有记录。")
  const saved = { ...memo, createdAt: previous?.createdAt || now, updatedAt: now }
  return { ...catalog, updatedAt: now, memos: previous ? existing.map(item => item.id === memo.id ? saved : item) : [...existing, saved] }
}
