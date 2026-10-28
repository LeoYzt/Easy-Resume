// pages/trace/trace.js —— 投递追踪漏斗
const Store = require('../../utils/store.js')

Page({
  data: {
    list: [],
    stages: Store.TRACE_STAGES,
    funnel: [],
    total: 0,
    rateInterview: 0,
    rateOffer: 0,
    sheet: false,
    form: { company: '', role: '', channel: '', note: '' }
  },

  onShow() { this.refresh() },

  refresh() {
    const list = Store.getTrace()
    const stages = Store.TRACE_STAGES
    const total = list.length
    const counts = {}
    stages.forEach((s) => (counts[s.key] = list.filter((t) => t.stage === s.key).length))

    // 漏斗：累计「到达过该阶段」的人数（若已到后期则视为通过了前期）
    const RANK = { sent: 0, read: 1, interview: 2, offer: 3, reject: 1 }
    const funnel = stages.filter((s) => s.key !== 'reject').map((s) => {
      const n = list.filter((t) => (RANK[t.stage] === undefined ? 0 : RANK[t.stage]) >= RANK[s.key]).length
      return { key: s.key, name: s.name, color: s.color, n, pct: total ? Math.round((n / total) * 100) : 0 }
    })
    const maxN = Math.max.apply(null, funnel.map((f) => f.n).concat([1]))
    funnel.forEach((f) => (f.w = Math.round((f.n / maxN) * 100)))

    this.setData({
      list, funnel, total,
      rateInterview: total ? Math.round((list.filter((t) => RANK[t.stage] >= 2).length / total) * 100) : 0,
      rateOffer: total ? Math.round((counts.offer / total) * 100) : 0,
      counts
    })
  },

  openAdd() { this.setData({ sheet: true, form: { company: '', role: '', channel: '', note: '' } }) },
  closeAdd() { this.setData({ sheet: false }) },
  noop() {},
  onFormInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ ['form.' + k]: e.detail.value })
  },
  submit() {
    const f = this.data.form
    if (!f.company) {
      wx.showToast({ title: '至少填个公司名', icon: 'none' })
      return
    }
    Store.addTrace(f)
    wx.vibrateShort({ type: 'medium' })
    this.setData({ sheet: false })
    this.refresh()
  },

  changeStage(e) {
    const id = e.currentTarget.dataset.id
    const self = this
    wx.showActionSheet({
      itemList: Store.TRACE_STAGES.map((s) => s.name),
      success: (res) => {
        Store.updateTraceStage(id, Store.TRACE_STAGES[res.tapIndex].key)
        wx.vibrateShort({ type: 'light' })
        self.refresh()
      },
      fail: () => {}
    })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条投递记录？',
      confirmColor: '#FF3B30',
      success: (res) => { if (res.confirm) { Store.removeTrace(id); this.refresh() } }
    })
  },

  clearAll() {
    wx.showModal({
      title: '清空全部投递记录？',
      content: '此操作不可恢复',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        Store.getTrace().forEach((t) => Store.removeTrace(t.id))
        this.refresh()
      }
    })
  }
})
