// pages/index/index.js —— 工作台
const Store = require('../../utils/store.js')
const AI = require('../../utils/ai.js')

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

Page({
  data: {
    statusBarH: 44,
    today: '',
    greet: '你好',
    versions: [],
    r: null,
    comp: 0,
    atsScore: 0,
    atsWords: 0,
    advice: [],
    badges: [],
    traceStat: [],
    traceRecent: [],
    quick: [
      { icon: '写', text: '编辑简历', tint: '#007AFF', url: '/pages/editor/editor' },
      { icon: '览', text: '预览导出', tint: '#34C759', url: '/pages/preview/preview' },
      { icon: '析', text: 'AI 洞察', tint: '#5856D6', url: '/pages/insight/insight' },
      { icon: '卡', text: '电子名片', tint: '#FF2D55', url: '/pages/share/share' }
    ]
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
  },

  onShow() { this.refresh() },

  refresh() {
    const list = Store.getResumes()
    const r = Store.getActive()
    const activeId = Store.getActiveId()

    const versions = list.map((x) => {
      const t = Store.TARGETS.find((v) => x.name.indexOf(v.name) !== -1)
      return {
        id: x.id, name: x.name, active: x.id === activeId,
        emoji: t ? t.emoji : '📄',
        sub: AI.completion(x) + '% 完成度'
      }
    })

    const comp = AI.completion(r)
    const ats = AI.atsCheck(r)
    const trace = Store.getTrace()
    const stat = Store.TRACE_STAGES.map((s) => ({
      key: s.key, name: s.name, color: s.color,
      n: trace.filter((t) => t.stage === s.key).length
    }))

    const h = new Date().getHours()
    const greet = h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
    const d = new Date()
    const badges = AI.badges(r, trace)

    this.setData({
      versions, r, comp, atsScore: ats.score, atsWords: ats.words,
      atsLevel: ats.score >= 85 ? '优秀' : ats.score >= 70 ? '良好' : ats.score >= 50 ? '待优化' : '需重写',
      atsColor: ats.score >= 85 ? '#34C759' : ats.score >= 70 ? '#007AFF' : ats.score >= 50 ? '#FF9500' : '#FF3B30',
      advice: AI.suggestions(r),
      badges,
      badgeOn: badges.filter((b) => b.ok).length,
      traceStat: stat, traceTotal: trace.length,
      traceRecent: trace.slice(0, 3),
      today: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`,
      greet
    })
  },

  switchVersion(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === Store.getActiveId()) return
    Store.setActiveId(id)
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },

  // 预览指定版本（不改变当前编辑的版本）
  viewVersion(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.vibrateShort({ type: 'light' })
    wx.navigateTo({ url: '/pages/preview/preview?id=' + id })
  },

  newVersion() {
    wx.showActionSheet({
      itemList: Store.TARGETS.map((t) => t.emoji + '  ' + t.name),
      success: (res) => {
        const t = Store.TARGETS[res.tapIndex]
        Store.addResume(t.name, false)
        wx.vibrateShort({ type: 'medium' })
        wx.showToast({ title: '已创建「' + t.name + '」', icon: 'none' })
        this.refresh()
      },
      fail: () => {}
    })
  },

  go(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    const app = getApp()
    if (app && app.open) app.open(url)
    else wx.navigateTo({ url })
  },

  goBadge(e) {
    const b = e.currentTarget.dataset.item
    wx.showToast({ title: b.ok ? b.name + '：已解锁' : '未解锁 · ' + b.hint, icon: 'none' })
  },

  pressFeedback() {
    wx.vibrateShort({ type: 'light' })
  }
})
