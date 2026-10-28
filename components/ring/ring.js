// components/ring/ring.js —— 苹果「健康 App」式环形进度
// 用 conic-gradient 绘制，并在 attached 时做 easeOut 数值补间
Component({
  properties: {
    percent: { type: Number, value: 0 },
    size: { type: Number, value: 200 },
    stroke: { type: Number, value: 16 },
    color: { type: String, value: '#007AFF' },
    track: { type: String, value: 'rgba(120,120,128,0.18)' },
    label: { type: String, value: '' },
    sub: { type: String, value: '' },
    animate: { type: Boolean, value: true },
    innerBg: { type: String, value: '#FFFFFF' },
    labelColor: { type: String, value: '#000000' },
    subColor: { type: String, value: 'rgba(60,60,67,0.5)' }
  },

  data: { shown: 0 },

  lifetimes: {
    attached() {
      this._target = Number(this.data.percent) || 0
      this.setData({ shown: this.data.animate ? 0 : this._target })
      if (this.data.animate) this._run()
    },
    detached() {
      if (this._timer) clearInterval(this._timer)
    }
  },

  observers: {
    percent(v) {
      this._target = Number(v) || 0
      if (this.data.animate) this._run()
      else this.setData({ shown: this._target })
    }
  },

  methods: {
    _run() {
      if (this._timer) clearInterval(this._timer)
      const dur = 900, step = 16
      const t0 = Date.now()
      const from = this.data.shown
      const to = this._target
      this._timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - t0) / dur)
        const e = 1 - Math.pow(1 - t, 3)
        const v = from + (to - from) * e
        this.setData({ shown: Math.round(v * 10) / 10 })
        if (t >= 1) { clearInterval(this._timer); this._timer = null }
      }, step)
    }
  }
})
