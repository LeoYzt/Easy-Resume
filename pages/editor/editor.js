// pages/editor/editor.js —— 简历编辑器
const Store = require('../../utils/store.js')
const AI = require('../../utils/ai.js')

Page({
  data: {
    statusBarH: 44,
    avatar: '',
    modules: [],
    basicText: '',
    summary: '',
    comp: 0,
    sheet: { open: false, mode: '', key: '', id: '', title: '' },
    fields: [],
    form: {},
    bulletsText: '',
    bulletsKey: '',
    hasBullets: false,
    issues: []
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
  },

  onShow() { this.refresh() },

  refresh() {
    const r = Store.getActive()
    const mods = Store.MODULES.map((m) => {
      const items = (r[m.key] || []).map((it) => ({
        id: it.id,
        label: m.itemLabel(it) || '未填写',
        sub: m.itemSub(it),
        hidden: !!it._hidden,
        count: it.bullets ? it.bullets.length : (it.items ? it.items.length : 0)
      }))
      return { key: m.key, title: m.title, tint: m.tint, glyph: m.glyph, items }
    })
    const b = r.basic || {}
    this.setData({
      r,
      avatar: b.photo || '',
      modules: mods,
      basicText: [b.name, b.title].filter(Boolean).join(' · ') || '点击填写基本信息',
      contactText: [b.phone, b.email, b.city].filter(Boolean).join(' · ') || '联系方式未填写',
      summary: r.summary || '',
      comp: AI.completion(r),
      issues: AI.timelineCheck(r)
    })
  },

  /* ---------- 头像 ---------- */
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    Store.updateActive((r) => { r.basic.photo = avatarUrl; return r })
    wx.vibrateShort({ type: 'light' })
    this.setData({ avatar: avatarUrl })
  },
  clearAvatar() {
    Store.updateActive((r) => { r.basic.photo = ''; return r })
    this.setData({ avatar: '' })
  },

  /* ---------- 基本信息 / 简介 ---------- */
  openBasic() {
    const r = Store.getActive()
    this._open('basic', '', '', '基本信息', Store.BASIC_FIELDS, Object.assign({}, r.basic))
  },
  openSummary() {
    this._open('summary', '', '', '个人简介', [], { summary: Store.getActive().summary || '' })
  },

  /* ---------- 模块条目 ---------- */
  openModule(e) {
    const key = e.currentTarget.dataset.key
    const id = e.currentTarget.dataset.id
    const m = Store.MODULE_MAP[key]
    const r = Store.getActive()
    const it = (r[key] || []).find((x) => x.id === id)
    if (!it) return
    const form = {}
    m.fields.forEach((f) => {
      const v = it[f.k]
      form[f.k] = Array.isArray(v) ? v : (v === undefined ? '' : v)
    })
    this._open('module', key, id, it.name || it.school || it.company || m.title, m.fields, form)
  },

  addItem(e) {
    const key = e.currentTarget.dataset.key
    Store.addItem(key)
    wx.vibrateShort({ type: 'light' })
    this.refresh()
    // 自动打开新建的条目
    const r = Store.getActive()
    const arr = r[key] || []
    const last = arr[arr.length - 1]
    if (last) this.openModule({ currentTarget: { dataset: { key, id: last.id } } })
  },

  move(e) {
    const key = e.currentTarget.dataset.key
    const id = e.currentTarget.dataset.id
    const dir = Number(e.currentTarget.dataset.dir)
    Store.moveItem(key, id, dir)
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },

  toggleHide(e) {
    const key = e.currentTarget.dataset.key
    const id = e.currentTarget.dataset.id
    const r = Store.getActive()
    const it = (r[key] || []).find((x) => x.id === id)
    if (!it) return
    Store.updateItem(key, id, { _hidden: !it._hidden })
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },

  remove(e) {
    const key = e.currentTarget.dataset.key
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这一条？',
      content: '删除后不可恢复',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        Store.removeItem(key, id)
        this.refresh()
      }
    })
  },

  /* ---------- Sheet 表单 ---------- */
  _open(mode, key, id, title, fields, form) {
    const hasBullets = fields.some((f) => f.type === 'bullets')
    let bulletsText = ''
    if (hasBullets) {
      const bk = fields.find((f) => f.type === 'bullets')
      bulletsText = (form[bk.k] || []).join('\n')
    }
    // WXML 不支持 obj[variableKey] 取值，这里展开成扁平数组渲染
    const rows = fields
      .filter((f) => f.type !== 'bullets')
      .map((f) => ({
        k: f.k, label: f.label, ph: f.ph, type: f.type || 'text',
        v: form[f.k] === undefined ? '' : String(form[f.k])
      }))
    this.setData({
      sheet: { open: true, mode, key, id, title },
      rows, _formKeys: rows.map((r) => r.k), hasBullets, bulletsText,
      bulletsKey: hasBullets ? fields.find((f) => f.type === 'bullets').k : ''
    })
  },
  closeSheet() {
    this.setData({ 'sheet.open': false })
  },
  noop() {},

  onInput(e) {
    const i = Number(e.currentTarget.dataset.i)
    const v = e.detail.value
    this.setData({ ['rows[' + i + '].v']: v })
  },
  onBulletsInput(e) {
    this.setData({ bulletsText: e.detail.value })
  },

  _collect() {
    const form = {}
    ;(this.data.rows || []).forEach((rr) => (form[rr.k] = rr.v))
    return form
  },

  save() {
    const s = this.data.sheet
    const form = this._collect()
    if (s.mode === 'basic') {
      Store.updateActive((r) => { r.basic = Object.assign(r.basic || {}, form); return r })
    } else if (s.mode === 'summary') {
      Store.updateActive((r) => { r.summary = form.summary || ''; return r })
    } else {
      const patch = Object.assign({}, form)
      if (this.data.bulletsKey) {
        patch[this.data.bulletsKey] = (this.data.bulletsText || '')
          .split('\n').map((t) => t.trim()).filter(Boolean)
      }
      Store.updateItem(s.key, s.id, patch)
    }
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已保存', icon: 'none', duration: 800 })
    this.setData({ 'sheet.open': false })
    this.refresh()
  },

  /* ---------- 一键智能优化（调用本地引擎） ---------- */
  smartSort() {
    wx.showLoading({ title: '整理中' })
    const r = Store.getActive()
    let changed = false
    ;['education', 'work', 'project'].forEach((k) => {
      Store.updateActive((rr) => {
        const arr = rr[k] || []
        const scored = arr.slice().sort((a, b) => {
          const pa = AI.parseMonth(a.start), pb = AI.parseMonth(b.start)
          const va = pa ? pa.y * 12 + pa.m : 0, vb = pb ? pb.y * 12 + pb.m : 0
          return vb - va
        })
        if (scored.map((x) => x.id).join() !== arr.map((x) => x.id).join()) changed = true
        rr[k] = scored
        return rr
      })
    })
    wx.hideLoading()
    wx.showToast({ title: changed ? '已按时间倒序整理' : '顺序已经是正确的', icon: 'none' })
    this.refresh()
  },

  goPreview() { wx.navigateTo({ url: '/pages/preview/preview' }) }
})
