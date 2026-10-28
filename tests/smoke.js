// 冒烟测试：mock 掉 wx 与 Canvas，在 Node 里跑通全部核心逻辑
// 运行： node tests/smoke.js
const path = require('path')
const base = path.join(__dirname, '..', 'utils') + '/'
const mem = {}
global.wx = {
  getStorageSync: (k) => (k in mem ? mem[k] : ''),
  setStorageSync: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)) },
  clearStorageSync: () => { for (const k in mem) delete mem[k] },
  removeStorageSync: (k) => { delete mem[k] }
}
const Store = require(base + 'store.js')
const LLM = require(base + 'llm.js')
const MD = require(base + 'md.js')
const AI = require(base + 'ai.js')
const Draw = require(base + 'render.js')

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); console.log('  PASS  ' + name); pass++ }
  catch (e) { console.log('  FAIL  ' + name + ' → ' + e.message); fail++ }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert failed') }

console.log('\n=== Store：魔方样板 ===')
const MO = Store.getResumes()[0]          // 固定样板，后续断言都用它
const ACTIVE_BEFORE = Store.getActiveId()
t('默认生成「魔方样板」+「我的简历」两份', () => {
  const l = Store.getResumes()
  assert(l.length === 2, 'got ' + l.length)
  assert(l[0].name === '魔方样板', 'name ' + l[0].name)
})
t('魔方样板：宋哈娜 / 高级前端工程师 / 北京市朝阳区', () => {
  const r = Store.getActive()
  assert(r.basic.name === '宋哈娜', r.basic.name)
  assert(r.basic.title === '高级前端工程师', r.basic.title)
  assert(r.basic.city === '北京市朝阳区', r.basic.city)
  assert(r.basic.status === '离职', r.basic.status)
})
t('魔方样板：9 组技能 / 1 段工作 / 3 个项目 / 1 段教育', () => {
  const r = Store.getActive()
  assert(r.skill.length === 9, 'skill ' + r.skill.length)
  assert(r.work.length === 1, 'work ' + r.work.length)
  assert(r.project.length === 3, 'project ' + r.project.length)
  assert(r.education.length === 1, 'education ' + r.education.length)
})
t('魔方样板：九类技能内容完整', () => {
  const r = Store.getActive()
  const names = r.skill.map((s) => s.name)
  ;['前端框架', '开发语言', 'UI / 样式', '状态管理', '工程化工具', '测试工具', '性能优化', '版本控制', '技术管理']
    .forEach((n) => assert(names.indexOf(n) !== -1, '缺少技能组 ' + n))
  const fw = r.skill.find((s) => s.name === '前端框架')
  assert(fw.items.indexOf('React') !== -1 && fw.items.indexOf('Vue.js') !== -1, 'React/Vue 缺失')
})
t('魔方样板：三个项目内容完整', () => {
  const r = Store.getActive()
  const pn = r.project.map((p) => p.name)
  ;['抖音创作者中台', '微信小程序开发者工具', '前端监控平台'].forEach((n) => assert(pn.indexOf(n) !== -1, n))
  assert(r.project[0].bullets.length === 5, 'p1 bullets ' + r.project[0].bullets.length)
})
t('魔方样板：字节跳动经历含 5 条量化描述', () => {
  const r = Store.getActive()
  assert(r.work[0].company === '字节跳动', r.work[0].company)
  assert(r.work[0].bullets.length === 5)
  assert(r.work[0].bullets[1].indexOf('8 分钟') !== -1, '构建时间数字丢失')
})
t('魔方样板：模块顺序沿用 menuSections', () => {
  const r = Store.getActive()
  assert(r.sections.join() === 'basic,skill,work,project,education,cert', r.sections.join())
})
t('模块顺序在渲染层可组装成数组', () => {
  const r = Store.getActive()
  const META = { skill: '专业技能', work: '工作 / 实习经历', project: '项目经历', education: '教育经历', cert: '证书与荣誉' }
  const secs = r.sections.filter((k) => META[k] && r[k].length).map((k) => ({ key: k, title: META[k], items: r[k] }))
  assert(secs.length === 4, 'sections ' + secs.length)
  assert(secs[0].key === 'skill', 'first ' + secs[0].key)
})

console.log('\n=== Store：CRUD ===')
t('新增 / 更新 / 排序 / 删除条目', () => {
  Store.addItem('work')
  const r = Store.getActive()
  const n = r.work.length
  const id = r.work[n - 1].id
  Store.updateItem('work', id, { company: '字节跳动' })
  assert(Store.getActive().work[n - 1].company === '字节跳动')
  Store.moveItem('work', id, -1)
  assert(Store.getActive().work[n - 2].id === id, 'move failed')
  Store.removeItem('work', id)
  assert(Store.getActive().work.length === n - 1)
})
t('按 id 读取与更新指定版本', () => {
  const other = Store.addResume('前端岗', false)
  const got = Store.getById(other.id)
  assert(got && got.id === other.id)
  Store.updateById(other.id, (r) => { r.basic.name = '张三'; return r })
  assert(Store.getById(other.id).basic.name === '张三')
  assert(Store.getActiveId() === other.id, '新版本应成为当前')
})
t('多版本 / 复制 / 删除', () => {
  const before = Store.getResumes().length
  const dup = Store.duplicateResume(Store.getActiveId())
  assert(Store.getResumes().length === before + 1)
  Store.removeResume(dup.id)
  assert(Store.getResumes().length === before)
})
t('投递追踪 CRUD', () => {
  Store.addTrace({ company: '腾讯', role: '前端' })
  const id = Store.getTrace()[0].id
  Store.updateTraceStage(id, 'offer')
  assert(Store.getTrace()[0].stage === 'offer')
  Store.removeTrace(id)
})
t('微信身份存取', () => {
  Store.setUser({ nickName: '小明', avatarUrl: 'wxfile://tmp/a.jpg' })
  assert(Store.getUser().nickName === '小明')
  Store.clearUser()
  assert(Store.getUser() === null || Store.getUser() === '')
})

console.log('\n=== AI：关键词引擎 ===')
t('英文技术词能抽出', () => {
  const k = AI.extractKeywords('熟练掌握 JavaScript、TypeScript、React，熟悉性能优化与工程化')
  const terms = k.map((x) => x.term)
  assert(terms.indexOf('javascript') !== -1, terms.join())
  assert(terms.indexOf('react') !== -1)
})
t('中文 n-gram 能抽出有意义词', () => {
  const k = AI.extractKeywords('负责 Shopify 独立站搭建、页面装修、产品上架与网站基础配置')
  const terms = k.map((x) => x.term)
  assert(terms.indexOf('独立站') !== -1, terms.join())
  assert(terms.indexOf('页面装修') !== -1, terms.join())
})
t('不抽出停用词与碎片', () => {
  const k = AI.extractKeywords('岗位职责：负责完成客户网站交付，配合销售。任职要求：熟悉WordPress')
  const terms = k.map((x) => x.term)
  assert(terms.indexOf('岗位职责') === -1, terms.join())
  assert(terms.indexOf('任职要求') === -1, terms.join())
  assert(!terms.some((t) => t.indexOf('客户网站') === 0 && t.length > 4), '有碎片: ' + terms.join())
})
t('JD 雷达：技术岗高匹配', () => {
  const r = MO
  const jd = '熟练掌握 JavaScript、TypeScript、React，熟悉性能优化、工程化、组件库与 Git 协作流程'
  const res = AI.jdRadar(r, jd)
  assert(res.score > 60, 'score ' + res.score)
  assert(res.hit.length >= 5, 'hit ' + res.hit.length)
})
t('JD 雷达：完全无关的岗位低匹配', () => {
  const r = MO
  const jd = '负责 WordPress、Shopify 独立站搭建、页面装修、产品上架，要求有建站经验'
  const res = AI.jdRadar(r, jd)
  assert(res.score < 45, 'score ' + res.score)
  assert(res.miss.length > 0)
})
t('JD 雷达：空输入安全', () => {
  assert(AI.jdRadar(MO, '').empty === true)
})
t('JD 雷达：命中项一定出现在简历文本里', () => {
  const r = MO
  const res = AI.jdRadar(r, '熟练掌握 React 与性能优化，了解 Kubernetes')
  const txt = AI.resumeToText(r).toLowerCase()
  res.hit.forEach((h) => assert(txt.indexOf(h.toLowerCase()) !== -1, '假命中 ' + h))
})

console.log('\n=== AI：体检与改写 ===')
t('ATS 13 项，权重合计合理', () => {
  const a = AI.atsCheck(MO)
  assert(a.checks.length === 14, 'checks ' + a.checks.length)
  assert(a.score >= 0 && a.score <= 100)
  console.log('        → 魔方样板 ATS ' + a.score + ' 分，' + a.words + ' 字')
})
t('ATS 对空简历低分', () => {
  const empty = Store.newResume('空', false)
  assert(AI.atsCheck(empty).score < 40, AI.atsCheck(empty).score)
})
t('「负责」开头会被判定为弱动词', () => {
  const weak = Store.newResume('w', false)
  weak.work = [{ id: 'x', company: 'A', role: 'B', start: '2020.01', end: '2021.01',
    bullets: ['负责用户模块开发', '参与项目开发', '协助测试工作'] }]
  const a = AI.atsCheck(weak)
  const v = a.checks.find((c) => c.key === 'verb')
  assert(v && !v.pass, '弱动词应不通过')
})
t('「主导」开头会被判定为强动词', () => {
  const ok = Store.newResume('s', false)
  ok.work = [{ id: 'x', company: 'A', role: 'B', start: '2020.01', end: '2021.01',
    bullets: ['主导用户中心重构，性能提升 40%', '主导组件库建设，复用率 70%', '主导性能优化，P95 降低 30ms'] }]
  const a = AI.atsCheck(ok)
  const v = a.checks.find((c) => c.key === 'verb')
  assert(v && v.pass, '强动词应通过')
})
t('面试官生成 10 题', () => {
  const qs = AI.interview(MO)
  assert(qs.length === 10, 'q ' + qs.length)
  assert(qs[0].point && qs[0].q)
})
t('STAR 改写产出 3 候选 + 诊断', () => {
  const out = AI.starRewrite('负责用户模块的开发工作')
  assert(out.better.length === 3)
  assert(out.notes.length > 0)
  assert(out.better[0].text.indexOf('主导') === 0 || out.better[0].text.indexOf('牵头') === 0, out.better[0].text)
})
t('STAR 改写空输入安全', () => assert(AI.starRewrite('').better.length === 0))
t('时间线检测倒序', () => {
  const r = MO
  r.project = r.project.slice().reverse()
  const iss = AI.timelineCheck(r)
  assert(iss.some((i) => i.text.indexOf('倒序') !== -1), JSON.stringify(iss))
})
t('时间线检测空档', () => {
  const mk = { basic: {}, summary: '', work: [
    { id: 'a', company: 'A', start: '2019.01', end: '2019.06', bullets: [] },
    { id: 'b', company: 'B', start: '2021.01', end: '2021.06', bullets: [] }
  ], education: [], project: [], skill: [], cert: [] }
  assert(AI.timelineCheck(mk).some((i) => i.text.indexOf('空档') !== -1))
})
t('完成度与建议', () => {
  assert(AI.completion(MO) === 100)
  assert(AI.suggestions(MO).length >= 1)
})
t('徽章 8 枚', () => {
  const b = AI.badges(MO, [])
  assert(b.length === 8)
  assert(b.every((x) => x.name && x.emoji && x.hint))
})

console.log('\n=== Render ===')
t('Markdown 导出包含关键段落', () => {
  const md = Draw.toMarkdown(MO)
  assert(md.indexOf('# 宋哈娜') !== -1)
  assert(md.indexOf('## 专业技能') !== -1)
  assert(md.indexOf('## 工作经历') !== -1)
  assert(md.indexOf('## 项目经历') !== -1)
  assert(md.indexOf('## 教育经历') !== -1)
})
t('Canvas 绘制跑通并返回高度', () => {
  const ctx = new Proxy({
    measureText: (t) => ({ width: String(t).length * 11 }),
    createLinearGradient: () => ({ addColorStop() {} })
  }, { get(o, k) { return k in o ? o[k] : (() => {}) } })
  const h = Draw.drawResume(ctx, MO, { privacy: true, watermark: '投字节专用', density: 'compact' })
  assert(h > 500 && h < 6000, 'h ' + h)
  console.log('        → 画布高度 ' + h + 'px')
})
t('隐私脱敏函数', () => {
  assert(Draw.maskPhone('13812345678') === '138****5678')
  assert(Draw.maskEmail('abc@x.com').indexOf('***') !== -1)
})

console.log('\n=== AI 接入 ===')
t('LLM 厂商表完整', () => {
  assert(LLM.PROVIDERS.length >= 6, 'providers ' + LLM.PROVIDERS.length)
  assert(LLM.PROVIDER_MAP.deepseek.base.indexOf('api.deepseek.com') !== -1)
  assert(LLM.PROVIDER_MAP.deepseek.models.length > 0)
})
t('未配置时 isConfigured 为 false', () => {
  LLM.clearConfig()
  assert(LLM.isConfigured() === false)
})
t('保存配置后可读取', () => {
  LLM.saveConfig({ provider: 'deepseek', apiKey: 'sk-test-1234567890', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
  const c = LLM.getConfig()
  assert(c.provider === 'deepseek' && c.apiKey === 'sk-test-1234567890' && c.model === 'deepseek-chat')
  assert(LLM.isConfigured() === true)
})
t('Key 脱敏显示', () => {
  assert(LLM.maskKey('sk-abcdefghijklmnop') === 'sk-a••••••mnop', LLM.maskKey('sk-abcdefghijklmnop'))
})
t('自定义厂商切换', () => {
  LLM.saveConfig({ provider: 'custom', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' })
  const c = LLM.getConfig()
  assert(c.provider === 'custom' && c.baseUrl.indexOf('11434') !== -1)
  LLM.clearConfig()
})
t('5 个预设任务都有 prompt', () => {
  assert(LLM.TASKS.length === 5, 'tasks ' + LLM.TASKS.length)
  LLM.TASKS.forEach((tk) => {
    const p = tk.prompt('简历内容', 'JD 内容')
    assert(typeof p === 'string' && p.length > 60, tk.key + ' prompt 太短')
    assert(p.indexOf('简历内容') !== -1, tk.key + ' 未包含简历')
  })
})

console.log('\n=== Markdown 渲染 ===')
t('标题带内联样式（rich-text 不继承页面样式）', () => {
  const html = MD.mdToHtml('## 标题')
  assert(html.indexOf('<h4 style="font-size:') !== -1, html)
  assert(html.indexOf('font-weight:600') !== -1, html)
})
t('列表降级为带前缀段落', () => {
  const html = MD.mdToHtml('- 一\n- 二')
  assert(html.indexOf('• 一') !== -1, html)
  assert(html.indexOf('• 二') !== -1, html)
  assert(html.indexOf('<ul>') === -1, '不应再用 ul')
})
t('有序列表保留序号', () => {
  const html = MD.mdToHtml('1. 第一步\n2. 第二步')
  assert(html.indexOf('1. 第一步') !== -1, html)
  assert(html.indexOf('2. 第二步') !== -1, html)
})
t('粗体与行内代码带内联样式', () => {
  const html = MD.mdToHtml('**粗体** 与 `代码`')
  assert(html.indexOf('font-weight:600') !== -1, html)
  assert(html.indexOf('>粗体<') !== -1, html)
  assert(html.indexOf('Menlo') !== -1, html)
  assert(html.indexOf('>代码<') !== -1, html)
})
t('连续文本合并成一段，空行分段', () => {
  const html = MD.mdToHtml('第一行\n第二行\n\n第三段')
  assert(html.indexOf('第一行<br/>第二行') !== -1, html)
  assert(html.indexOf('第三段') !== -1, html)
  assert(html.split('<p ').length === 3, '应为两段，实际: ' + html)
})
t('引用带左边框样式', () => {
  const html = MD.mdToHtml('> 一句提醒')
  assert(html.indexOf('border-left:3px solid') !== -1, html)
  assert(html.indexOf('一句提醒') !== -1, html)
})
t('代码块保留换行且转义尖括号', () => {
  const html = MD.mdToHtml('```\nconst a = 1 < 2;\nconst b = 3;\n```')
  const A = String.fromCharCode(38)
  assert(html.indexOf(A + 'lt;') !== -1, '未转义 <: ' + html)
  assert(html.indexOf('<br/>') !== -1, '多行未保留换行: ' + html)
  assert(html.indexOf('font-family:Menlo') !== -1, '缺等宽字体: ' + html)
})
t('HTML 注入被转义', () => {
  const html = MD.mdToHtml('<script>alert(1)</script>')
  assert(html.indexOf('<script>') === -1, '危险标签未转义: ' + html)
  const A = String.fromCharCode(38)
  assert(html.indexOf(A + 'lt;script' + A + 'gt;') !== -1, '未看到转义实体: ' + html)
})
t('空输入安全', () => assert(typeof MD.mdToHtml('') === 'string'))

console.log('\n=== 大模型请求构造 ===')
function captureRequest(then) {
  const captured = []
  global.wx.request = (opt) => {
    captured.push(opt)
    const task = { onChunkReceived: (cb) => { task._cb = cb } }
    if (then) then(opt, task)
    return task
  }
  return captured
}

t('请求 URL / 鉴权头 / payload 正确', () => {
  LLM.saveConfig({ provider: 'deepseek', apiKey: 'sk-abc123', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
  const cap = captureRequest()
  LLM.chat([{ role: 'user', content: 'hi' }], { temperature: 0.3 }, () => {})
  const o = cap[0]
  assert(o.url === 'https://api.deepseek.com/v1/chat/completions', o.url)
  assert(o.method === 'POST', o.method)
  assert(o.header.Authorization === 'Bearer sk-abc123', o.header.Authorization)
  assert(o.data.model === 'deepseek-chat', o.data.model)
  assert(o.data.temperature === 0.3)
  assert(o.data.stream === false)
  assert(o.data.messages.length === 1)
})
t('baseUrl 末尾斜杠不会双拼', () => {
  LLM.saveConfig({ baseUrl: 'https://api.deepseek.com/v1/', model: 'deepseek-chat' })
  const cap = captureRequest()
  LLM.chat([{ role: 'user', content: 'x' }], {}, () => {})
  assert(cap[0].url === 'https://api.deepseek.com/v1/chat/completions', cap[0].url)
})
t('无 Key 时直接报错不发请求', () => {
  LLM.clearConfig()
  const cap = captureRequest()
  let err = null
  LLM.chat([{ role: 'user', content: 'x' }], {}, (e) => { err = e })
  assert(cap.length === 0, '不该发请求')
  assert(err && err.message.indexOf('API Key') !== -1, err && err.message)
})
t('流式模式 stream=true 且开启 chunked', () => {
  LLM.saveConfig({ provider: 'deepseek', apiKey: 'sk-abc', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
  const cap = captureRequest()
  LLM.chat([{ role: 'user', content: 'x' }], { onChunk: () => {} }, () => {})
  assert(cap[0].data.stream === true)
  assert(cap[0].enableChunked === true)
})
t('SSE 增量解析：字符串 chunk', () => {
  LLM.saveConfig({ provider: 'deepseek', apiKey: 'sk-abc', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
  let out = ''
  let task = null
  captureRequest((opt, t) => { task = t })
  LLM.chat([{ role: 'user', content: 'x' }], { onChunk: (s) => { out += s } }, () => {})
  task._cb({ data: 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n' })
  task._cb({ data: 'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n' })
  task._cb({ data: 'data: [DONE]\n\n' })
  assert(out === '你好，世界', '实际: ' + out)
})
t('SSE 增量解析：一行被切在两个 chunk 之间', () => {
  let out = ''
  let task = null
  captureRequest((opt, t) => { task = t })
  LLM.chat([{ role: 'user', content: 'x' }], { onChunk: (s) => { out += s } }, () => {})
  task._cb({ data: 'data: {"choices":[{"delta":{"cont' })   // 半包
  task._cb({ data: 'ent":"完整了"}}]}\n\n' })              // 后半
  assert(out === '完整了', '跨包解析失败: ' + out)
})
t('SSE 增量解析：ArrayBuffer chunk（真机格式）', () => {
  let out = ''
  let task = null
  captureRequest((opt, t) => { task = t })
  LLM.chat([{ role: 'user', content: 'x' }], { onChunk: (s) => { out += s } }, () => {})
  const payload = 'data: {"choices":[{"delta":{"content":"字节流"}}]}\n\n'
  const bytes = Buffer.from(payload, 'utf8')
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  task._cb({ data: ab })
  assert(out === '字节流', 'ArrayBuffer 解析失败: ' + out)
})
t('UTF-8 解码器正确处理中文与 emoji', () => {
  const s = '中文🎉abc'
  const bytes = Buffer.from(s, 'utf8')
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  assert(LLM._internal.toStr(ab) === s, LLM._internal.toStr(ab))
})
t('非 data: 行与损坏 JSON 被忽略', () => {
  assert(LLM._internal.pickDelta('') === '')
  assert(LLM._internal.pickDelta(': keep-alive') === '')
  assert(LLM._internal.pickDelta('data: {broken') === '')
  assert(LLM._internal.pickDelta('data: [DONE]') === '')
})
t('模型列表请求走 /models', () => {
  LLM.saveConfig({ provider: 'deepseek', apiKey: 'sk-abc', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' })
  const cap = captureRequest()
  LLM.listModels({}, () => {})
  assert(cap[0].url === 'https://api.deepseek.com/v1/models', cap[0].url)
  assert(cap[0].method === 'GET', cap[0].method)
})
LLM.clearConfig()

console.log('\n────────────────────────────')
console.log(`通过 ${pass} 项，失败 ${fail} 项`)
process.exit(fail ? 1 : 0)
