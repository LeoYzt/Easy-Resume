// pages/preview/preview.js —— 预览与导出
const Store = require('../../utils/store.js')
const AI = require('../../utils/ai.js')
const Draw = require('../../utils/render.js')

const ONE_PAGE_CHARS = 1600

Page({
  data: {
    statusBarH: 44,
    vm: null,
    template: 'classic',
    density: 'comfort',
    privacy: false,
    watermark: '',
    accent: '#007AFF',
    pages: 1,
    words: 0,
    exporting: false,
    viewId: '',
    viewName: '',
    isGuest: false,
    tplList: Store.THEMES.map((t) => ({ key: t.key, name: t.name })),
    densityList: [{ key: 'comfort', name: '宽松' }, { key: 'compact', name: '紧凑' }],
    tplMeta: null
  },

  onLoad(q) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
    if (q && q.id) {
      this.viewId = q.id
    }
    if (q && q.tpl) this._tplOverride = q.tpl
  },

  onShow() { this.refresh() },

  refresh() {
    const active = Store.getActive()
    const guest = this.viewId && this.viewId !== Store.getActiveId()
    const r = guest ? (Store.getById(this.viewId) || active) : active

    const hidden = (a) => (a || []).filter((x) => !x._hidden)
    const b = r.basic || {}
    const contacts = []
    if (b.phone) contacts.push({ t: this.data.privacy ? Draw.maskPhone(b.phone) : b.phone, ic: '☎' })
    if (b.email) contacts.push({ t: this.data.privacy ? Draw.maskEmail(b.email) : b.email, ic: '✉' })
    if (b.city) contacts.push({ t: b.city, ic: '⌖' })
    if (b.site) contacts.push({ t: b.site, ic: '⌘' })
    ;(b.customFields || []).forEach((c) => {
      if (c.value) contacts.push({ t: c.label ? c.label + ' ' + c.value : c.value, ic: '◇' })
    })

    const words = AI.resumeToText(r).replace(/\s/g, '').length
    const pages = Math.max(1, Math.ceil(words / ONE_PAGE_CHARS))
    const order = r.sections || ['basic', 'skill', 'work', 'project', 'education', 'cert']
    const SECTION_META = {
      skill: '专业技能', work: '工作 / 实习经历', project: '项目经历',
      education: '教育经历', cert: '证书与荣誉'
    }
    // 组装成有序数组：WXML 不支持 obj[dynamicKey] 取值
    const sections = []
    order.forEach((k) => {
      if (!SECTION_META[k]) return
      const items = hidden(r[k])
      if (!items.length) return
      sections.push({ key: k, title: SECTION_META[k], items })
    })

    this.setData({
      r,
      accent: r.accent || '#007AFF',
      template: this._tplOverride || r.template || 'classic',
      density: r.density || 'comfort',
      tplMeta: Store.THEMES.find((t) => t.key === (this._tplOverride || r.template || 'classic')),
      words, pages,
      viewId: this.viewId || '',
      viewName: guest ? r.name : '',
      isGuest: !!guest,
      vm: {
        basic: b, contacts,
        status: b.status || '',
        photo: b.photo || '',
        summary: r.summary || '',
        sections
      }
    })
  },

  pickTpl(e) {
    this._tplOverride = null
    const k = e.currentTarget.dataset.k
    if (this.data.isGuest) {
      wx.showToast({ title: '先把它设为当前版本', icon: 'none' })
      return
    }
    Store.updateActive((r) => { r.template = k; return r })
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },
  pickDensity(e) {
    const k = e.currentTarget.dataset.k
    if (this.data.isGuest) {
      wx.showToast({ title: '先把它设为当前版本', icon: 'none' })
      return
    }
    Store.updateActive((r) => { r.density = k; return r })
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },
  togglePrivacy() {
    const v = !this.data.privacy
    this.setData({ privacy: v })
    Store.setSetting({ privacyMode: v })
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },
  editWatermark(e) {
    this.setData({ watermark: e.detail.value })
  },
  goEdit() {
    if (this.data.isGuest) {
      wx.showToast({ title: '先把它设为当前版本', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/editor/editor' })
  },
  setAsCurrent() {
    if (!this.viewId) return
    Store.setActiveId(this.viewId)
    this.viewId = ''
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已设为当前简历', icon: 'none' })
    this.refresh()
  },

  /* ---------- 导出 ---------- */
  async doExport() {
    if (this.data.exporting) return
    this.setData({ exporting: true })
    wx.showLoading({ title: '正在排版' })
    try {
      const r = this.data.r
      const opts = {
        privacy: this.data.privacy,
        watermark: this.data.watermark,
        density: this.data.density,
        accent: this.data.accent
      }
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = Math.min(info.pixelRatio || 2, 3)
      const query = wx.createSelectorQuery().in(this)
      const res = await new Promise((resolve) => {
        query.select('#cv').fields({ node: true, size: true }).exec(resolve)
      })
      const canvas = res[0] && res[0].node
      if (!canvas) throw new Error('canvas not ready')

      const ctx = canvas.getContext('2d')
      // 第一遍：给足高度，量出真实高度
      canvas.width = Draw.A4_W * dpr
      canvas.height = 7000 * dpr
      ctx.scale(dpr, dpr)
      let h = Draw.drawResume(ctx, r, opts)
      // 第二遍：按真实高度重绘
      canvas.width = Draw.A4_W * dpr
      canvas.height = Math.ceil(h) * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      h = Draw.drawResume(ctx, r, opts)

      const file = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0, y: 0, width: Draw.A4_W * dpr, height: Math.ceil(h) * dpr,
          destWidth: Draw.A4_W * dpr, destHeight: Math.ceil(h) * dpr,
          fileType: 'png',
          success: resolve, fail: reject
        })
      })
      wx.hideLoading()
      this._lastFile = file.tempFilePath
      this.setData({ exporting: false })
      wx.previewImage({ urls: [file.tempFilePath], current: file.tempFilePath })
    } catch (err) {
      wx.hideLoading()
      this.setData({ exporting: false })
      wx.showToast({ title: '导出失败，请重试', icon: 'none' })
      console.error(err)
    }
  },

  copyText() {
    const md = Draw.toMarkdown(this.data.r)
    wx.setClipboardData({
      data: md,
      success: () => wx.showToast({ title: 'Markdown 已复制', icon: 'none' })
    })
  },

  goInsight() { wx.navigateTo({ url: '/pages/insight/insight?tab=ats' }) }
})
