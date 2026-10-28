// utils/llm.js —— 真实大模型接入（OpenAI 兼容协议）
// API Key 只保存在本机 storage，请求由小程序直接发出，不经过任何第三方代理。
// ⚠️ 使用前需在「微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名」
//    加上对应厂商的域名（例如 api.deepseek.com），或在开发者工具里勾选
//    「不校验合法域名」。

const K_AI = 'mr_ai_v1'

const PROVIDERS = [
  {
    key: 'deepseek', name: 'DeepSeek', domain: 'api.deepseek.com',
    base: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    tips: '性价比最高，中文表达自然，适合简历润色'
  },
  {
    key: 'openai', name: 'OpenAI', domain: 'api.openai.com',
    base: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    tips: '综合能力强，英文简历表现尤其好'
  },
  {
    key: 'qwen', name: '通义千问', domain: 'dashscope.aliyuncs.com',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    tips: '阿里云，国内网络顺畅'
  },
  {
    key: 'doubao', name: '豆包', domain: 'ark.cn-beijing.volces.com',
    base: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-lite-32k'],
    tips: '字节跳动，响应速度快'
  },
  {
    key: 'kimi', name: 'Kimi', domain: 'api.moonshot.cn',
    base: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    tips: '长文本能力强，适合长简历分析'
  },
  {
    key: 'custom', name: '自定义', domain: '',
    base: '',
    models: [],
    tips: '任何兼容 OpenAI 协议的服务（Ollama / vLLM / OneAPI 等）'
  }
]

const PROVIDER_MAP = {}
PROVIDERS.forEach((p) => (PROVIDER_MAP[p.key] = p))

/* ------------------------------------------------------------------ */
/* 配置读写                                                             */
/* ------------------------------------------------------------------ */
function getConfig() {
  const c = wx.getStorageSync(K_AI) || {}
  const provider = c.provider || 'deepseek'
  const p = PROVIDER_MAP[provider] || PROVIDER_MAP.deepseek
  return {
    provider,
    apiKey: c.apiKey || '',
    baseUrl: c.baseUrl || (provider === 'custom' ? '' : p.base),
    model: c.model || (provider === 'custom' ? '' : p.models[0])
  }
}

function saveConfig(patch) {
  const next = Object.assign(getConfig(), patch || {})
  wx.setStorageSync(K_AI, next)
  return next
}

function clearConfig() {
  wx.removeStorageSync(K_AI)
}

function isConfigured() {
  const c = getConfig()
  return !!(c.apiKey && c.baseUrl && c.model)
}

function maskKey(k) {
  const s = String(k || '')
  if (s.length <= 8) return s ? '••••' : ''
  return s.slice(0, 4) + '••••••' + s.slice(-4)
}

/* ------------------------------------------------------------------ */
/* 请求                                                                */
/* ------------------------------------------------------------------ */
/* ArrayBuffer / 字符串 → 字符串（真机 chunk 是 ArrayBuffer，需按 UTF-8 解码） */
function toStr(data) {
  if (typeof data === 'string') return data
  if (!data) return ''
  try {
    const bytes = new Uint8Array(data)
    let out = ''
    let i = 0
    while (i < bytes.length) {
      const b = bytes[i++]
      if (b < 0x80) {
        out += String.fromCharCode(b)
      } else if (b >= 0xC0 && b < 0xE0) {
        const b2 = bytes[i++]
        out += String.fromCharCode(((b & 0x1F) << 6) | (b2 & 0x3F))
      } else if (b >= 0xE0 && b < 0xF0) {
        const b2 = bytes[i++], b3 = bytes[i++]
        out += String.fromCharCode(((b & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F))
      } else if (b >= 0xF0) {
        const b2 = bytes[i++], b3 = bytes[i++], b4 = bytes[i++]
        let cp = ((b & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F)
        cp -= 0x10000
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF))
      }
    }
    return out
  } catch (e) {
    return ''
  }
}

/* 从一行 SSE 里取出增量文本 */
function pickDelta(line) {
  const t = String(line || '').trim()
  if (!t || t.indexOf('data:') !== 0) return ''
  const payload = t.slice(5).trim()
  if (!payload || payload === '[DONE]') return ''
  try {
    const obj = JSON.parse(payload)
    const d = obj.choices && obj.choices[0] && obj.choices[0].delta
    return (d && d.content) || ''
  } catch (e) {
    return ''
  }
}

function headers(cfg) {
  const h = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) h.Authorization = 'Bearer ' + cfg.apiKey
  return h
}

/** 拉取模型列表 */
function listModels(cfg, cb) {
  const c = Object.assign(getConfig(), cfg || {})
  if (!c.baseUrl) return cb(new Error('请先填写接口地址'))
  wx.request({
    url: c.baseUrl.replace(/\/$/, '') + '/models',
    method: 'GET',
    header: headers(c),
    timeout: 20000,
    success: (res) => {
      if (res.statusCode === 200 && res.data && Array.isArray(res.data.data)) {
        const ids = res.data.data.map((m) => m.id).filter(Boolean)
        cb(null, ids)
      } else {
        cb(new Error('拉取失败（HTTP ' + res.statusCode + '），请检查 Key 与域名'))
      }
    },
    fail: (err) => cb(new Error(err.errMsg || '网络请求失败，请检查合法域名配置'))
  })
}

/**
 * 对话补全（支持流式）
 * @param {Array} messages [{role,content}]
 * @param {Object} opts { temperature, max_tokens, onChunk(text), signal }
 */
function chat(messages, opts, cb) {
  const o = opts || {}
  const c = getConfig()
  if (!c.apiKey) return cb(new Error('还没配置 API Key'))
  if (!c.baseUrl) return cb(new Error('还没配置接口地址'))
  if (!c.model) return cb(new Error('还没选择模型'))

  const payload = {
    model: c.model,
    messages,
    temperature: o.temperature === undefined ? 0.6 : o.temperature,
    max_tokens: o.max_tokens || 2048,
    stream: !!o.onChunk
  }

  const task = wx.request({
    url: c.baseUrl.replace(/\/$/, '') + '/chat/completions',
    method: 'POST',
    header: headers(c),
    data: payload,
    timeout: 120000,
    enableChunked: !!o.onChunk,
    success: (res) => {
      if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices[0]) {
        const text = (res.data.choices[0].message && res.data.choices[0].message.content) || ''
        if (!o.onChunk) return cb(null, text)
        if (text) o.onChunk(text)
        cb(null, '')
      } else {
        const msg = (res.data && res.data.error && res.data.error.message) || ('HTTP ' + res.statusCode)
        cb(new Error(msg))
      }
    },
    fail: (err) => cb(new Error(err.errMsg || '请求失败，请检查 Key、模型名与合法域名'))
  })
  if (o.onChunk && task && task.onChunkReceived) {
    let buf = ''   // 跨 chunk 的残留：SSE 的一行可能被切成两半
    task.onChunkReceived((res) => {
      try {
        buf += toStr(res.data)
        const lines = buf.split('\n')
        buf = lines.pop()      // 最后一段可能不完整，留到下一个 chunk
        lines.forEach((line) => {
          const d = pickDelta(line)
          if (d) o.onChunk(d)
        })
      } catch (e) { /* 单包异常不应中断整个流 */ }
    })
  }
  return task
}

/** 连接测试 */
function test(cb) {
  const c = getConfig()
  if (!c.apiKey) return cb(new Error('请先填写 API Key'))
  chat([{ role: 'user', content: '回复两个字：连接成功' }], { max_tokens: 20 }, (err, text) => {
    if (err) return cb(err)
    cb(null, (text || '').trim() || '连接正常')
  })
}

/* ------------------------------------------------------------------ */
/* 简历场景预设任务                                                     */
/* ------------------------------------------------------------------ */
const TASKS = [
  {
    key: 'jd', name: 'JD 深度匹配', emoji: '🎯',
    desc: '结合岗位要求，逐条指出你缺什么、怎么改',
    prompt: (resumeText, jd) =>
      '你是一位资深招聘官。下面是候选人的简历和目标岗位的 JD。\n\n' +
      '【简历】\n' + resumeText + '\n\n【岗位 JD】\n' + (jd || '（未提供）') + '\n\n' +
      '请按以下结构输出（用 Markdown，标题用 ##）：\n' +
      '## 匹配结论\n给出 0-100 的匹配度并用一句话说明理由。\n\n' +
      '## 硬性缺口\n列出 JD 里要求但简历没有体现的技能或经验，每条说明为什么要紧。\n\n' +
      '## 可以怎么改\n针对上面的缺口，给出 3 条具体到可以直接抄进简历的修改建议（动词开头 + 带数字）。\n\n' +
      '## 面试预判\n列出面试官最可能追问的 3 个问题，每条附一句准备方向。'
  },
  {
    key: 'polish', name: '经历润色', emoji: '✨',
    desc: '把流水账改成有力度、有数字的成果句',
    prompt: (resumeText, jd) =>
      '你是一位简历写作教练。下面是候选人的简历内容。\n\n' +
      '【简历】\n' + resumeText + '\n\n' +
      '请挑出其中最需要改写的 3 条经历描述，逐条给出改写前后对比：\n' +
      '1. 原文：…\n   改写：…（动词开头 + 方法 + 数字结果）\n   为什么这样改：…\n\n' +
      '如果原句里没有数字，请给出「合理补数字」的示范，并明确标注这是占位示例、需要本人替换成真实数据。'
  },
  {
    key: 'interview', name: '模拟面试', emoji: '🎤',
    desc: '基于简历生成高频问题与回答要点',
    prompt: (resumeText, jd) =>
      '你是一位面试官。下面是候选人的简历。\n\n' +
      '【简历】\n' + resumeText + '\n\n' +
      '请生成 8 个最可能出现的面试问题（用 ## 分组：技术深挖 / 项目复盘 / 软素质），' +
      '每个问题下面给出「考察意图」和「回答要点」各一句。'
  },
  {
    key: 'intro', name: '自我介绍', emoji: '🎙',
    desc: '生成 60 秒口播稿',
    prompt: (resumeText, jd) =>
      '请基于下面这份简历，写一段 60 秒以内、约 250 字的自我介绍口播稿。\n\n' +
      '【简历】\n' + resumeText + '\n\n' +
      '要求：口语化、有记忆点、结尾留一个钩子让面试官提问。不要用「我是一个……的人」这种句式。'
  },
  {
    key: 'ats', name: 'ATS 深度诊断', emoji: '🤖',
    desc: '逐条分析简历能否通过机器筛选',
    prompt: (resumeText, jd) =>
      '你是一位熟悉 ATS（简历筛选系统）的 HR 技术。下面是候选人的简历。\n\n' +
      '【简历】\n' + resumeText + '\n\n' +
      '请输出：\n## 机器可解析性\n哪些部分机器读不出来、为什么。\n\n' +
      '## 关键词覆盖\n结合岗位 JD（若提供）列出缺失关键词。\n\n' +
      '## 逐条修改清单\n给出 5 条按优先级排序的具体修改动作，每条写清「改哪里」和「改成什么」。'
  }
]

module.exports = {
  PROVIDERS, PROVIDER_MAP, TASKS,
  getConfig, saveConfig, clearConfig, isConfigured, maskKey,
  listModels, chat, test,
  _internal: { toStr, pickDelta }
}
