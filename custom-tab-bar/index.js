const list = [
  { path: '/pages/index/index',      text: '简历', icon: 'doc' },
  { path: '/pages/insight/insight',  text: '洞察', icon: 'chart' },
  { path: '/pages/templates/templates', text: '模板', icon: 'grid' },
  { path: '/pages/mine/mine',        text: '我的', icon: 'me' }
]

Component({
  data: { list, active: '' },
  lifetimes: {
    attached() { this._sync() }
  },
  pageLifetimes: {
    show() { this._sync() }
  },
  methods: {
    _sync() {
      const pages = getCurrentPages()
      const cur = pages && pages.length ? pages[pages.length - 1] : null
      const route = cur ? '/' + cur.route : ''
      if (route !== this.data.active) this.setData({ active: route })
    },
    go(e) {
      const p = e.currentTarget.dataset.path
      if (p === this.data.active) return
      wx.switchTab({ url: p })
    }
  }
})
