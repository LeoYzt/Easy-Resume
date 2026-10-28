// pages/share/share.js —— 电子名片 + 声纹自我介绍
const Store = require('../../utils/store.js')
const Draw = require('../../utils/render.js')


const FONT = '"PingFang SC", -apple-system, "Helvetica Neue", sans-serif'
function setFill(ctx, color) {
  ctx.fillStyle = color
  if (typeof ctx.setFillStyle === 'function') { try { ctx.setFillStyle(color) } catch (e) {} }
}
function setFont(ctx, size, weight) {
  ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT
  if (typeof ctx.setFontSize === 'function') { try { ctx.setFontSize(size) } catch (e) {} }
}

const A4_W = 1080

Page({
  data: {
    statusBarH: 44,
    r: null,
    contacts: [],
    privacy: false,
    voice: null,
    recording: false,
    sec: 0,
    playing: false,
   bars: []
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
    this.bars = Array.from({ length: 34 }, () => 0.2)
    this.setData({ bars: this.bars })
  },

  onShow() {
    const v = Store.getVoice()
    const r = Store.getActive()
    const b = r.basic || {}
    this.setData({
      r, voice: v, accent: r.accent || '#007AFF',
      contacts: [
        { ic: '☎', t: this.data.privacy ? Draw.maskPhone(b.phone) : b.phone, k: 'phone' },
        { ic: '✉', t: this.data.privacy ? Draw.maskEmail(b.email) : b.email, k: 'email' },
        { ic: '⌖', t: b.city, k: 'city' },
        { ic: '⌘', t: b.site, k: 'site' }
      ].filter((x) => x.t),
      status: b.status || '',
      photo: b.photo || ''
    })
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
    if (this._audio) { this._audio.destroy(); this._audio = null }
  },

  togglePrivacy() {
    this.setData({ privacy: !this.data.privacy })
    wx.vibrateShort({ type: 'light' })
    this.onShow()
  },

  /* ---------- 录制自我介绍 ---------- */
  startRecord() {
    wx.authorize({
      scope: 'scope.record',
      success: () => this._doRecord(),
      fail: () => wx.showToast({ title: '需要麦克风权限', icon: 'none' })
    })
  },
  _doRecord() {
    const self = this
    const rm = wx.getRecorderManager()
    this.rm = rm
    rm.onStop((res) => {
      if (self._timer) { clearInterval(self._timer); self._timer = null }
      self.setData({ recording: false })
      if (!res.tempFilePath) return
      const fs = wx.getFileSystemManager()
      let target = `${wx.env.USER_DATA_PATH}/intro_${Date.now()}.mp3`
      try { fs.saveFileSync(res.tempFilePath, target) } catch (e) { target = res.tempFilePath }
      Store.setVoice({ path: target, date: new Date().toLocaleDateString('zh-CN'), size: res.fileSize || 0 })
      self.setData({ voice: Store.getVoice(), sec: 0 })
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '已保存自我介绍', icon: 'none' })
    })
    rm.onError(() => { self.setData({ recording: false }); wx.showToast({ title: '录音失败', icon: 'none' }) })
    rm.start({ duration: 30000, format: 'mp3', sampleRate: 44100, numberOfChannels: 1 })
    this.setData({ recording: true, sec: 0 })
    let s = 0
    this._timer = setInterval(() => {
      s += 1
      // 伪波形：随正弦抖动，模拟音量
      self.bars = self.bars.map((_, i) => 0.25 + Math.abs(Math.sin((Date.now() / 260) + i * 0.7)) * 0.72)
      self.setData({ sec: s, bars: self.bars })
      if (s >= 30) self.stopRecord()
    }, 1000)
  },
  stopRecord() {
    if (this.rm) this.rm.stop()
  },
  playVoice() {
    const v = this.data.voice
    if (!v) return
    if (this._audio) { this._audio.destroy(); this._audio = null }
    const a = wx.createInnerAudioContext()
    a.src = v.path
    a.play()
    this.setData({ playing: true })
    this._audio = a
    a.onEnded(() => this.setData({ playing: false }))
    a.onError(() => { this.setData({ playing: false }); wx.showToast({ title: '播放失败，可能已过期', icon: 'none' }) })
  },
  stopVoice() {
    if (this._audio) { this._audio.stop(); this.setData({ playing: false }) }
  },
  removeVoice() {
    wx.showModal({
      title: '删除语音自我介绍？',
      confirmColor: '#FF3B30',
      success: (res) => { if (res.confirm) { Store.setVoice(null); this.setData({ voice: null }) } }
    })
  },

  /* ---------- 名片 ---------- */
  async makeCard() {
    wx.showLoading({ title: '生成名片' })
    try {
      const r = Store.getActive()
      const b = r.basic || {}
      const accent = r.accent || '#007AFF'
      const privacy = this.data.privacy
      const dpr = Math.min((wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2, 3)
      const res = await new Promise((resolve) => {
        wx.createSelectorQuery().in(this).select('#card').fields({ node: true, size: true }).exec(resolve)
      })
      const canvas = res[0] && res[0].node
      if (!canvas) throw new Error('no canvas')
      const W = A4_W
      const H = Math.round(W * 1.42)
      canvas.width = W * dpr; canvas.height = H * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      // 背景渐变
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, accent); g.addColorStop(1, '#5856D6')
      setFill(ctx, g); ctx.fillRect(0, 0, W, H)
      // 装饰圆
      setFill(ctx, 'rgba(255,255,255,0.10)')
      ctx.beginPath(); ctx.arc(W * 0.86, H * 0.16, 190, 0, Math.PI * 2); ctx.fill()
      setFill(ctx, 'rgba(255,255,255,0.07)')
      ctx.beginPath(); ctx.arc(W * 0.12, H * 0.86, 240, 0, Math.PI * 2); ctx.fill()

      const M = 84
      ctx.textBaseline = 'top'
      setFont(ctx, 20); setFill(ctx, 'rgba(255,255,255,0.72)')
      ctx.fillText('MAGIC RESUME · 电子名片', M, M)
      setFont(ctx, 20)
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(M, M + 34, 56, 4, 2) : ctx.rect(M, M + 34, 56, 4)
      setFill(ctx, 'rgba(255,255,255,0.9)'); ctx.fill()

      setFont(ctx, 66); setFill(ctx, '#FFFFFF')
      ctx.fillText(b.name || '你的姓名', M, M + 100)
      setFont(ctx, 28); setFill(ctx, 'rgba(255,255,255,0.88)')
      ctx.fillText(b.title || '求职意向', M, M + 190)

      let y = M + 260
      const lines = [
        ['☎', privacy ? Draw.maskPhone(b.phone) : b.phone],
        ['✉', privacy ? Draw.maskEmail(b.email) : b.email],
        ['⌖', b.city],
        ['⌘', b.site]
      ].filter((x) => x[1])
      lines.forEach((l) => {
        setFont(ctx, 24); setFill(ctx, 'rgba(255,255,255,0.85)')
        ctx.fillText(l[0] + '   ' + l[1], M, y)
        y += 48
      })

      if (this.data.voice) {
        setFont(ctx, 24); setFill(ctx, 'rgba(255,255,255,0.9)')
        ctx.fillText('🎙  含一段语音自我介绍，微信当面播放更佳', M, y + 16)
      }

      setFont(ctx, 20); setFill(ctx, 'rgba(255,255,255,0.6)')
      ctx.fillText('由 Magic Resume 本地生成 · 数据不上传服务器', M, H - 84)

      const file = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: W * dpr, height: H * dpr,
          destWidth: W * dpr, destHeight: H * dpr, fileType: 'png',
          success: resolve, fail: reject
        })
      })
      wx.hideLoading()
      wx.previewImage({ urls: [file.tempFilePath], current: file.tempFilePath })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
      console.error(e)
    }
  },

  copyContact() {
    const b = this.data.r.basic || {}
    const txt = [b.name, b.title, b.phone, b.email, b.city, b.site].filter(Boolean).join('\n')
    wx.setClipboardData({ data: txt, success: () => wx.showToast({ title: '联系方式已复制', icon: 'none' }) })
  }
})
