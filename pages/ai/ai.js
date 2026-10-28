// pages/ai/ai.js —— AI 服务商配置
const LLM = require('../../utils/llm.js')

Page({
  data: {
    statusBarH: 44,
    providers: LLM.PROVIDERS.map((p) => ({ key: p.key, name: p.name, domain: p.domain, tips: p.tips })),
    domains: LLM.PROVIDERS.filter((p) => p.domain).map((p) => ({ key: p.key, name: p.name, domain: p.domain })),
    provider: 'deepseek',
    providerName: 'DeepSeek',
    tips: '',
    apiKey: '',
    keyShown: false,
    baseUrl: '',
    custom: false,
    model: '',
    modelOptions: [],
    modelPicker: false,
    testing: false,
    testResult: '',
    testOk: false
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarH: info.statusBarHeight || 44 })
  },

  onShow() { this.load() },

  load() {
    const c = LLM.getConfig()
    const p = LLM.PROVIDER_MAP[c.provider] || LLM.PROVIDERS[0]
    this.setData({
      provider: c.provider,
      providerName: p.name,
      tips: p.tips,
      apiKey: c.apiKey,
      baseUrl: c.baseUrl,
      model: c.model,
      custom: c.provider === 'custom'
    })
  },

  pickProvider(e) {
    const k = e.currentTarget.dataset.k
    const p = LLM.PROVIDER_MAP[k]
    this.setData({
      provider: k, providerName: p.name, tips: p.tips,
      custom: k === 'custom',
      baseUrl: k === 'custom' ? this.data.baseUrl : p.base,
      model: k === 'custom' ? this.data.model : p.models[0],
      testResult: '', testOk: false
    })
    LLM.saveConfig({ provider: k, baseUrl: this.data.baseUrl, model: this.data.model })
  },

  onKeyInput(e) {
    this.setData({ apiKey: e.detail.value })
  },
  toggleKey() { this.setData({ keyShown: !this.data.keyShown }) },

  onBaseInput(e) { this.setData({ baseUrl: e.detail.value }) },
  onModelInput(e) { this.setData({ model: e.detail.value }) },

  save() {
    const { provider, apiKey, baseUrl, model } = this.data
    if (!apiKey) return wx.showToast({ title: '请填写 API Key', icon: 'none' })
    if (!baseUrl) return wx.showToast({ title: '请填写接口地址', icon: 'none' })
    if (!model) return wx.showToast({ title: '请填写模型名', icon: 'none' })
    LLM.saveConfig({ provider, apiKey, baseUrl, model })
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  fetchModels() {
    wx.showLoading({ title: '拉取中' })
    LLM.listModels({ baseUrl: this.data.baseUrl, apiKey: this.data.apiKey }, (err, ids) => {
      wx.hideLoading()
      if (err) return wx.showToast({ title: err.message.slice(0, 30), icon: 'none' })
      if (!ids.length) return wx.showToast({ title: '没有可用模型', icon: 'none' })
      this.setData({ modelOptions: ids, modelPicker: true })
    })
  },

  pickModel(e) {
    const m = e.currentTarget.dataset.m
    this.setData({ model: m, modelPicker: false })
    LLM.saveConfig({ model: m })
  },
  closePicker() { this.setData({ modelPicker: false }) },
  noop() {},

  testConnection() {
    if (!this.data.apiKey) return wx.showToast({ title: '请先填写 API Key', icon: 'none' })
    this.setData({ testing: true, testResult: '', testOk: false })
    wx.showLoading({ title: '测试中' })
    LLM.test((err, text) => {
      wx.hideLoading()
      this.setData({ testing: false, testOk: !err, testResult: err ? err.message : text })
    })
  },

  clear() {
    wx.showModal({
      title: '清除 AI 配置？',
      content: 'API Key 会从本机删除',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return
        LLM.clearConfig()
        this.load()
        this.setData({ testResult: '', testOk: false, apiKey: '' })
      }
    })
  }
})
