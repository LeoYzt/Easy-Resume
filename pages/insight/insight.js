// pages/insight/insight.js —— AI 洞察中心（全部本地运算）
const Store = require('../../utils/store.js')
const AI = require('../../utils/ai.js')
const LLM = require('../../utils/llm.js')
const MD = require('../../utils/md.js')

Page({
  data: {
    statusBarH: 44,
    tab: 'ai',
    tabs: [
      { key: 'ai', name: 'AI 深度分析' },
      { key: 'jd', name: 'JD 雷达' },
      { key: 'ats', name: 'ATS 体检' },
      { key: 'interview', name: '面试官' },
      { key: 'polish', name: 'STAR 改写' }
    ],
    tasks: LLM.TASKS.map((t) => ({ key: t.key, name: t.name, emoji: t.emoji, desc: t.desc })),
    curTask: 'jd',
    aiConfigured: false,
    aiInfo: '',
    aiJd: '',
    aiLoading: false,
    aiText: '',
    aiHtml: '',
    aiErr: '',
    jdText: '',
    jd: null,
    hitRest: 0,
    missRest: 0,
    ats: null,
    questions: [],
    openQ: -1,
    bullets: [],
    curBullet: -1,
    rewrite: null
  },

  onLoad(q) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
    if (q && q.tab) this.setData({ tab: q.tab })
  },

  onShow() {
    // tabBar 页面带参跳转：从中转区取回目标 tab
    const app = getApp()
    if (app && app.takePending) {
      const p = app.takePending('/pages/insight/insight')
      if (p && p.tab) this.setData({ tab: p.tab })
    }
    this.refresh()
  },

  refresh() {
    const cfg = LLM.getConfig()
    const p = LLM.PROVIDER_MAP[cfg.provider]
    this.setData({
      aiConfigured: LLM.isConfigured(),
      aiInfo: (p ? p.name : '') + (cfg.model ? ' · ' + cfg.model : '')
    })
    const r = Store.getActive()
    const ats = AI.atsCheck(r)
    const questions = AI.interview(r).map((x, i) => Object.assign({}, x, { idx: i }))
    const bullets = AI.bulletList(r)
    const jdText = wx.getStorageSync('mr_jd_' + r.id) || ''
    this.setData({
      r, ats, questions, bullets,
      atsColor: ats.score >= 85 ? '#34C759' : ats.score >= 70 ? '#007AFF' : ats.score >= 50 ? '#FF9500' : '#FF3B30',
      jdText, openQ: -1, curBullet: -1, rewrite: null, selected: null
    })
    if (jdText) this.runJD()
  },

  pickTab(e) {
    wx.vibrateShort({ type: 'light' })
    this.setData({ tab: e.currentTarget.dataset.k })
  },

  /* ---------- JD 雷达 ---------- */
  onJDInput(e) {
    this.setData({ jdText: e.detail.value })
    wx.setStorageSync('mr_jd_' + this.data.r.id, e.detail.value)
  },
  runJD() {
    const res = AI.jdRadar(this.data.r, this.data.jdText)
    if (res.empty) {
      this.setData({ jd: null })
      wx.showToast({ title: '没识别出关键词，再多贴一点 JD', icon: 'none' })
      return
    }
    // 只展示前 14 个，其余折叠成「还有 N 个」
    const hit = res.hit.slice(0, 14)
    const miss = res.miss.slice(0, 14)
    this.setData({
      jd: Object.assign({}, res, { hit, miss }),
      hitRest: Math.max(0, res.hit.length - hit.length),
      missRest: Math.max(0, res.miss.length - miss.length),
      jdColor: res.score >= 75 ? '#34C759' : res.score >= 50 ? '#FF9500' : '#FF3B30',
      jdAdvice: res.score >= 75
        ? '关键词覆盖良好，可以放心投递'
        : res.score >= 50
          ? '补齐下方缺失词，匹配度通常能快速拉到 70% 以上'
          : '缺词较多，建议先针对性补技能再做投递'
    })
  },
  pasteDemo() {
    this.setData({
      jdText: '岗位职责：\n1. 负责公司核心产品的前端开发与迭代，保证页面性能与交互体验；\n2. 参与技术方案设计，推动组件库与工程化建设；\n3. 关注线上性能数据，持续优化首屏加载与渲染效率。\n任职要求：\n1. 熟练掌握 JavaScript、TypeScript、React，理解其底层原理；\n2. 熟悉性能优化、工程化、Git 协作流程；\n3. 有大型互联网项目经验者优先，具备良好的沟通协作能力。'
    })
    wx.setStorageSync('mr_jd_' + this.data.r.id, this.data.jdText)
    this.runJD()
  },
  // 创新点：一键把缺失关键词补进技能区
  fillMissing() {
    const miss = (this.data.jd && this.data.jd.miss) || []
    if (!miss.length) return
    Store.updateActive((r) => {
      r.skill = r.skill || []
      const grp = r.skill.find((g) => g.name === '岗位关键词') || { id: Store.uid(), name: '岗位关键词', items: [], _hidden: false }
      grp.items = Array.from(new Set((grp.items || []).concat(miss.slice(0, 10))))
      if (!r.skill.find((g) => g.id === grp.id)) r.skill.push(grp)
      return r
    })
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已补进技能区，请核对真实性', icon: 'none', duration: 2000 })
    setTimeout(() => this.refresh(), 400)
  },

  adopt(e) {
    const txt = e.currentTarget.dataset.t
    const b = this.data.bullets[this.data.curBullet]
    if (!b) return
    Store.updateActive((r) => {
      const host = (r[b.mod] || []).find((x) => x.id === b.id)
      if (host) host.bullets = (host.bullets || []).map((t) => (t === b.text ? txt : t))
      return r
    })
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已采纳', icon: 'none' })
    setTimeout(() => this.refresh(), 300)
  },
  tapQ(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ openQ: this.data.openQ === i ? -1 : i })
  },

  /* ---------- STAR 改写 ---------- */
  pickBullet(e) {
    const i = Number(e.currentTarget.dataset.i)
    const curBullet = this.data.curBullet === i ? -1 : i
    if (curBullet < 0) { this.setData({ curBullet: -1, rewrite: null }); return }
    const res = AI.starRewrite(this.data.bullets[i].text)
    wx.vibrateShort({ type: 'light' })
    this.setData({ curBullet: i, rewrite: res, selected: this.data.bullets[i] })
  },
  /* ---------- AI 深度分析 ---------- */
  pickTask(e) {
    this.setData({ curTask: e.currentTarget.dataset.k, aiText: '', aiHtml: '', aiErr: '' })
  },
  onAiJdInput(e) { this.setData({ aiJd: e.detail.value }) },
  openAISettings() { wx.navigateTo({ url: '/pages/ai/ai' }) },

  async runAI() {
    if (this.data.aiLoading) return
    if (!LLM.isConfigured()) {
      this.setData({ aiErr: '还没有配置 AI 服务商，先去设置页填一下 API Key' })
      return
    }
    const task = LLM.TASKS.find((t) => t.key === this.data.curTask)
    if (!task) return
    const r = Store.getActive()
    const resumeText = AI.resumeToText(r) || '（简历还是空的）'
    const prompt = task.prompt(resumeText, this.data.aiJd)

    this.setData({ aiLoading: true, aiText: '', aiHtml: '', aiErr: '' })
    wx.vibrateShort({ type: 'light' })

    LLM.chat(
      [{ role: 'system', content: '你是一位资深中文简历顾问，回答简洁具体，用 Markdown 排版，不要寒暄。' },
       { role: 'user', content: prompt }],
      {
        temperature: 0.6,
        max_tokens: 2048,
        onChunk: (t) => {
          const text = this.data.aiText + t
          this.setData({ aiText: text, aiHtml: MD.mdToHtml(text) })
        }
      },
      (err, text) => {
        this.setData({ aiLoading: false })
        if (err) {
          this.setData({ aiErr: err.message })
          return
        }
        if (text) {
          const full = this.data.aiText + text
          this.setData({ aiText: full, aiHtml: MD.mdToHtml(full) })
        } else if (!this.data.aiText) {
          this.setData({ aiErr: '模型没有返回内容，换个模型或稍后再试' })
        }
      }
    )
  },

  copyAI() {
    if (!this.data.aiText) return
    wx.setClipboardData({ data: this.data.aiText, success: () => wx.showToast({ title: '已复制', icon: 'none' }) })
  },
  clearAI() { this.setData({ aiText: '', aiHtml: '', aiErr: '' }) },

  goEdit() { wx.navigateTo({ url: '/pages/editor/editor' }) },
  goPreview() { wx.navigateTo({ url: '/pages/preview/preview' }) }
})
