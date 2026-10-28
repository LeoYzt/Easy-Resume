// components/navbar/navbar.js —— 苹果风导航栏（带返回按钮）
Component({
  options: { addGlobalClass: true },
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: false },
    backText: { type: String, value: '' },
    transparent: { type: Boolean, value: false }
  },
  data: { statusBarH: 44 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.setData({ statusBarH: info.statusBarHeight || 44 })
    }
  },
  methods: {
    back() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }
  }
})
