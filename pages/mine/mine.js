// pages/mine/mine.js —— 我的 / 数据管理
const Store = require('../../utils/store.js')
const AI = require('../../utils/ai.js')

const FEATURES = [
  { ic: '📡', t: 'JD 匹配雷达', d: '粘贴招聘要求，算出关键词命中率' },
  { ic: '🤖', t: 'ATS 机筛体检', d: '14 项权重打分，指出失分项' },
  { ic: '🎤', t: '面试官模拟', d: '按你的项目生成 10 个刁钻追问' },
  { ic: '✨', t: 'STAR 一键改写', d: '把流水账升级成「动词+方法+数字」' },
  { ic: '📄', t: '自动一页纸', d: '紧凑/宽松双密度，压进恰好一页' },
  { ic: '🔒', t: '隐私脱敏导出', d: '手机号邮箱打码 + 防泄漏水印' },
  { ic: '🎯', t: '多版本投递', d: '一份经历派生投不同岗位的多个版本' },
  { ic: '📅', t: '时间线体检', d: '自动查倒序、空档期、时间冲突' },
  { ic: '🎙', t: '声纹自我介绍', d: '录 30 秒语音，生成电子名片' },
  { ic: '📈', t: '投递漏斗', d: '追踪投递→面试→Offer 的转化率' },
  { ic: '🏅', t: '成长徽章', d: '把优化简历这件事做成进度条' },
  { ic: '🎨', t: '六套 Apple 风模板', d: '同一份内容，六种气质' }
]

Page({
  data: {
    statusBarH: 44,
    resumes: [],
    activeId: '',
    features: FEATURES,
    stats: null,
    user: null,
    avatarUrl: '',
    nickname: ''
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
  },

  onShow() { this.refresh() },

  refresh() {
    const user = Store.getUser()
    this.setData({
      user: user || null,
      avatarUrl: (user && user.avatarUrl) || '',
      nickname: (user && user.nickName) || ''
    })
    const list = Store.getResumes()
    const activeId = Store.getActiveId()
    const r = list.find((x) => x.id === activeId)
    const trace = Store.getTrace()
    this.setData({
      resumes: list.map((x, i) => ({
        id: x.id, name: x.name, index: i,
        active: x.id === activeId,
        sub: AI.completion(x) + '% · ' + AI.resumeToText(x).replace(/\s/g, '').length + ' 字'
      })),
      activeId,
      stats: {
        resumes: list.length,
        trace: trace.length,
        comp: r ? AI.completion(r) : 0,
        ats: r ? AI.atsCheck(r).score : 0
      }
    })
  },

  pick(e) {
    const id = e.currentTarget.dataset.id
    Store.setActiveId(id)
    wx.vibrateShort({ type: 'light' })
    this.refresh()
  },

  rename(e) {
    const id = e.currentTarget.dataset.id
    const cur = this.data.resumes.find((x) => x.id === id)
    wx.showModal({
      title: '重命名',
      editable: true,
      placeholderText: cur ? cur.name : '简历名称',
      success: (res) => {
        if (!res.confirm || !res.content) return
        const list = Store.getResumes()
        const t = list.find((x) => x.id === id)
        if (t) { t.name = res.content.trim() }
        wx.setStorageSync('mr_resumes_v1', list)
        this.refresh()
      }
    })
  },

  duplicate(e) {
    const id = e.currentTarget.dataset.id
    Store.duplicateResume(id)
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已复制一份', icon: 'none' })
    this.refresh()
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.resumes.length <= 1) {
      wx.showToast({ title: '至少保留一份简历', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除这份简历？',
      content: '删除后不可恢复',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        Store.removeResume(id)
        this.refresh()
      }
    })
  },

  newVersion() {
    wx.showActionSheet({
      itemList: Store.TARGETS.map((t) => t.emoji + '  ' + t.name),
      success: (res) => {
        Store.addResume(Store.TARGETS[res.tapIndex].name, false)
        wx.showToast({ title: '已创建', icon: 'none' })
        this.refresh()
      },
      fail: () => {}
    })
  },

  /* ---------- 数据管理 ---------- */
  exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      resumes: Store.getResumes(),
      trace: Store.getTrace()
    }
    wx.setClipboardData({
      data: JSON.stringify(data),
      success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'none', duration: 2000 })
    })
  },

  importData() {
    wx.showModal({
      title: '从剪贴板导入',
      content: '会覆盖当前所有数据，请先确保剪贴板里是导出的 JSON',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        wx.getClipboardData({
          success: (c) => {
            try {
              const d = JSON.parse(c.data)
              if (!d.resumes) throw new Error('bad')
              wx.setStorageSync('mr_resumes_v2', d.resumes)
              wx.setStorageSync('mr_trace_v1', d.trace || [])
              wx.setStorageSync('mr_active_v1', d.resumes[0].id)
              wx.showToast({ title: '导入成功', icon: 'none' })
              this.refresh()
            } catch (e) {
              wx.showToast({ title: '剪贴板内容不是有效备份', icon: 'none' })
            }
          }
        })
      }
    })
  },

  clearAll() {
    wx.showModal({
      title: '清空全部数据？',
      content: '所有简历、投递记录都会被删除且不可恢复',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        wx.clearStorageSync()
        Store.getResumes()
        wx.showToast({ title: '已清空', icon: 'none' })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600)
      }
    })
  },

  /* ---------- 微信身份授权 ---------- */
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    this.setData({ avatarUrl })
    wx.vibrateShort({ type: 'light' })
  },
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },
  saveUser() {
    if (!this.data.avatarUrl || !this.data.nickname) {
      wx.showToast({ title: '先选头像并填写昵称', icon: 'none' })
      return
    }
    Store.setUser({
      nickName: this.data.nickname,
      avatarUrl: this.data.avatarUrl,
      time: new Date().toLocaleDateString('zh-CN')
    })
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '授权成功', icon: 'none' })
    this.refresh()
  },
  clearUser() {
    wx.showModal({
      title: '解除授权？',
      content: '会清除本机保存的头像和昵称',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        Store.clearUser()
        this.setData({ avatarUrl: '', nickname: '' })
        this.refresh()
      }
    })
  },
  applyUserToResume() {
    const u = Store.getUser()
    if (!u) {
      wx.showToast({ title: '请先完成授权', icon: 'none' })
      return
    }
    Store.updateActive((r) => {
      r.basic.photo = u.avatarUrl
      if (!r.basic.name) r.basic.name = u.nickName
      return r
    })
    wx.showToast({ title: '已同步到当前简历', icon: 'none' })
  },

  /* ---------- 版本查看 ---------- */
  viewResume(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/preview/preview?id=' + id })
  },

  goNav(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    const app = getApp()
    if (app && app.open) app.open(url)
    else wx.navigateTo({ url })
  },
  goTrace() { wx.navigateTo({ url: '/pages/trace/trace' }) },
  goShare() { wx.navigateTo({ url: '/pages/share/share' }) },
  goInsight() { wx.navigateTo({ url: '/pages/insight/insight' }) },

  tapFeature(e) {
    const f = e.currentTarget.dataset.item
    wx.showModal({ title: f.t, content: f.d, showCancel: false })
  },

  showLicense() {
    wx.showModal({
      title: '许可与版权',
      content: '本项目移植自开源项目 Magic Resume（Giaboy / JOYCEQL，Apache 2.0 + 附加非商用条款）。原项目仅限个人非商业使用，请勿将其作为收费服务对外提供。',
      showCancel: false
    })
  }
})
