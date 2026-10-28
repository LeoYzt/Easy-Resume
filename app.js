// app.js
const Store = require('./utils/store.js')

App({
  globalData: {
    resume: null,
    cache: {},
    // tabBar 页面无法通过 navigateTo 带参跳转，用它中转
    pendingNav: null
  },

  onLaunch() {
    try { Store.getResumes() } catch (e) { console.error('store init failed', e) }
  },

  onShow() {},
  onHide() {},

  /**
   * 打开一个页面：tabBar 页面走 switchTab（参数存入 pendingNav），其余走 navigateTo
   * @param {string} url 例如 '/pages/insight/insight?tab=ats'
   */
  open(url) {
    if (!url) return
    const [path, query] = url.split('?')
    const params = {}
    if (query) {
      query.split('&').forEach((kv) => {
        const i = kv.indexOf('=')
        if (i > 0) params[kv.slice(0, i)] = kv.slice(i + 1)
      })
    }
    const TAB = ['/pages/index/index', '/pages/insight/insight', '/pages/templates/templates', '/pages/mine/mine']
    if (TAB.indexOf(path) !== -1) {
      this.globalData.pendingNav = { path, params }
      wx.switchTab({ url: path })
    } else {
      wx.navigateTo({ url })
    }
  },

  // 取走中转参数（取一次即清空）
  takePending(path) {
    const p = this.globalData.pendingNav
    if (!p || p.path !== path) return null
    this.globalData.pendingNav = null
    return p.params
  },

  // 事件总线：跨页面通知「简历已更新」
  _subs: {},
  on(evt, fn) {
    if (!this._subs[evt]) this._subs[evt] = []
    this._subs[evt].push(fn)
  },
  emit(evt, payload) {
    ;(this._subs[evt] || []).forEach((fn) => {
      try { fn(payload) } catch (e) { console.error(e) }
    })
  }
})
