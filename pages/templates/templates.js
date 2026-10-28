// pages/templates/templates.js —— 模板与主题
const Store = require('../../utils/store.js')

Page({
  data: {
    statusBarH: 44,
    tpls: Store.THEMES,
    accents: Store.ACCENTS,
    cur: 'classic',
    curMeta: null,
    accent: '#007AFF',
    r: null
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
  },

  onShow() {
    const r = Store.getActive()
    const cur = r.template || 'classic'
    this.setData({
      r, cur, accent: r.accent || '#007AFF',
      curMeta: Store.THEMES.find((t) => t.key === cur) || Store.THEMES[0]
    })
  },

  apply(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.cur) return
    Store.updateActive((r) => { r.template = k; return r })
    wx.vibrateShort({ type: 'light' })
    this.setData({
      cur: k,
      curMeta: Store.THEMES.find((t) => t.key === k) || Store.THEMES[0]
    })
  },

  pickAccent(e) {
    const c = e.currentTarget.dataset.c
    Store.updateActive((r) => { r.accent = c; return r })
    this.setData({ accent: c })
    wx.vibrateShort({ type: 'light' })
  },

  goPreview() {
    wx.navigateTo({ url: '/pages/preview/preview?tpl=' + this.data.cur })
  },

  longPressTpl(e) {
    const k = e.currentTarget.dataset.k
    const t = Store.THEMES.find((x) => x.key === k)
    wx.showModal({
      title: t.name + ' 模板',
      content: t.desc + '\n\n适合：' + t.tag,
      confirmText: '用这个',
      cancelText: '再看看',
      success: (res) => {
        if (!res.confirm) return
        Store.updateActive((r) => { r.template = k; return r })
        this.setData({ cur: k, curMeta: t })
      }
    })
  }
})
