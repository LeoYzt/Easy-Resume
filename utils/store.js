// utils/store.js —— 简历数据模型 / 本地持久化 / 多版本管理
// 纯小程序 API，无后端依赖。所有数据留在本机。
// 示例数据移植自 magic-resume 的「魔方简历」样板（src/config/initialResumeData.ts）

const K_RESUMES = 'mr_resumes_v2'
const K_ACTIVE  = 'mr_active_v1'
const K_TRACE   = 'mr_trace_v1'
const K_SETTING = 'mr_setting_v1'
const K_VOICE   = 'mr_voice_v1'
const K_USER    = 'mr_user_v1'

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

/* ------------------------------------------------------------------ */
/* 模块定义（驱动编辑器表单 + 完成度统计）                              */
/* 顺序沿用魔方简历 menuSections：专业技能 → 工作经验 → 项目经历 → 教育经历  */
/* ------------------------------------------------------------------ */
const MODULES = [
  {
    key: 'skill', title: '专业技能', icon: '技能', glyph: '⚡️', tint: '#34C759',
    itemLabel: (it) => it.name || '未命名技能组',
    itemSub: (it) => (it.items || []).join(' · '),
    fields: [
      { k: 'name',  label: '分类', ph: '如 编程语言 / 框架 / 设计', type: 'text' },
      { k: 'items', label: '标签', ph: '每行一个，如 JavaScript\nTypeScript\nGo', type: 'bullets' }
    ]
  },
  {
    key: 'work', title: '工作 / 实习经历', icon: '经历', glyph: '💼', tint: '#007AFF',
    itemLabel: (it) => it.company || '未填写公司',
    itemSub: (it) => [it.role, [it.start, it.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
    fields: [
      { k: 'company', label: '公司',   ph: '如 腾讯', type: 'text' },
      { k: 'role',    label: '职位',   ph: '如 前端开发实习生', type: 'text' },
      { k: 'city',    label: '城市',   ph: '如 深圳', type: 'text', w: 'half' },
      { k: 'dept',    label: '部门',   ph: '如 微信事业群（可空）', type: 'text', w: 'half' },
      { k: 'start',   label: '开始',   ph: '2023.07', type: 'text', w: 'half' },
      { k: 'end',     label: '结束',   ph: '2024.01 或 至今', type: 'text', w: 'half' },
      { k: 'bullets', label: '工作内容', ph: '每行一条，建议用「动词开头 + 量化结果」\n如：主导首页重构，首屏加载下降 43%', type: 'bullets' }
    ]
  },
  {
    key: 'project', title: '项目经历', icon: '项目', glyph: '🚀', tint: '#FF9500',
    itemLabel: (it) => it.name || '未命名项目',
    itemSub: (it) => [it.role, [it.start, it.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
    fields: [
      { k: 'name',    label: '名称',   ph: '如 Magic Resume', type: 'text' },
      { k: 'role',    label: '角色',   ph: '如 负责人 / 核心开发', type: 'text' },
      { k: 'start',   label: '开始',   ph: '2024.03', type: 'text', w: 'half' },
      { k: 'end',     label: '结束',   ph: '2024.08 或 至今', type: 'text', w: 'half' },
      { k: 'tech',    label: '技术栈', ph: '用空格或逗号分隔，如 React TypeScript', type: 'text' },
      { k: 'link',    label: '链接',   ph: 'GitHub / 线上地址（可空）', type: 'text' },
      { k: 'bullets', label: '项目描述', ph: '每行一条：做了什么 + 用什么方法 + 拿到什么结果', type: 'bullets' }
    ]
  },
  {
    key: 'education', title: '教育经历', icon: '学位', glyph: '🎓', tint: '#5856D6',
    itemLabel: (it) => it.school || '未填写学校',
    itemSub: (it) => [it.major, it.degree].filter(Boolean).join(' · '),
    fields: [
      { k: 'school',  label: '学校',   ph: '如 中山大学', type: 'text' },
      { k: 'major',   label: '专业',   ph: '如 软件工程', type: 'text' },
      { k: 'degree',  label: '学历',   ph: '本科 / 硕士 / 博士', type: 'text' },
      { k: 'start',   label: '开始',   ph: '2019.09', type: 'text', w: 'half' },
      { k: 'end',     label: '结束',   ph: '2023.06 或 至今', type: 'text', w: 'half' },
      { k: 'gpa',     label: 'GPA',    ph: '如 3.8/4.0（可空）', type: 'text', w: 'half' },
      { k: 'honor',   label: '荣誉',   ph: '如 校级一等奖学金（可空）', type: 'text', w: 'half' },
      { k: 'bullets', label: '在校经历', ph: '每行一条，如：专业排名前 5%，连续三年一等奖学金', type: 'bullets' }
    ]
  },
  {
    key: 'cert', title: '证书与荣誉', icon: '证书', glyph: '🏅', tint: '#FF2D55',
    itemLabel: (it) => it.name || '未填写',
    itemSub: (it) => [it.issuer, it.date].filter(Boolean).join(' · '),
    fields: [
      { k: 'name',   label: '名称',   ph: '如 CET-6 / ACM 省赛银奖', type: 'text' },
      { k: 'issuer', label: '颁发方', ph: '如 教育部（可空）', type: 'text' },
      { k: 'date',   label: '时间',   ph: '如 2023.06', type: 'text' },
      { k: 'desc',   label: '备注',   ph: '如 年级前 5%（可空）', type: 'text' }
    ]
  }
]

const MODULE_MAP = {}
MODULES.forEach((m) => (MODULE_MAP[m.key] = m))

/* 基本信息表单字段（含魔方的状态 / 生日 / 自定义字段） */
const BASIC_FIELDS = [
  { k: 'name',    label: '姓名',     ph: '真实姓名' },
  { k: 'title',   label: '求职意向', ph: '如 前端开发工程师' },
  { k: 'status',  label: '求职状态', ph: '如 离职 / 在职 / 求职中' },
  { k: 'phone',   label: '手机号',   ph: '11 位手机号', type: 'number' },
  { k: 'email',   label: '邮箱',     ph: '建议 Outlook / Gmail' },
  { k: 'city',    label: '所在地',   ph: '如 北京市朝阳区' },
  { k: 'birthday',label: '生日',     ph: '如 2000-05' },
  { k: 'site',    label: '个人网站', ph: '可空' }
]

/* ------------------------------------------------------------------ */
/* 「魔方简历」样板数据                                                  */
/* 来源：magic-resume/src/config/initialResumeData.ts                   */
/* ------------------------------------------------------------------ */
const MOFANG = {
  basic: {
    name: '宋哈娜',
    title: '高级前端工程师',
    status: '离职',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    city: '北京市朝阳区',
    birthday: '2025-01',
    site: 'https://zhangsan.dev',
    photo: '',
    links: [
      { label: '个人网站', url: 'https://zhangsan.dev' }
    ],
    customFields: [
      { id: 'personal', label: '个人网站', value: 'https://zhangsan.dev' }
    ]
  },
  summary: '7 年前端工程经验，主导过多个大型项目的技术选型与架构设计，擅长工程化体系建设与性能优化。相信好的架构应该让复杂度被消化在框架里，而不是暴露给每个使用者。',
  skill: [
    { name: '前端框架', items: ['React', 'Vue.js', 'Next.js', 'Nuxt.js', 'SSR 框架'] },
    { name: '开发语言', items: ['TypeScript', 'JavaScript(ES6+)', 'HTML5', 'CSS3'] },
    { name: 'UI / 样式', items: ['TailwindCSS', 'Sass/Less', 'CSS Module', 'Styled-components'] },
    { name: '状态管理', items: ['Redux', 'Vuex', 'Zustand', 'Jotai', 'React Query'] },
    { name: '工程化工具', items: ['Webpack', 'Vite', 'Rollup', 'Babel', 'ESLint'] },
    { name: '测试工具', items: ['Jest', 'React Testing Library', 'Cypress'] },
    { name: '性能优化', items: ['浏览器渲染原理', '性能指标监控', '代码分割', '懒加载'] },
    { name: '版本控制', items: ['Git', 'SVN'] },
    { name: '技术管理', items: ['团队管理经验', '技术选型', '架构设计', '大型项目主导'] }
  ],
  work: [{
    company: '字节跳动',
    role: '高级前端工程师',
    city: '北京市',
    dept: '抖音创作者平台',
    start: '2021.07',
    end: '2024.12',
    bullets: [
      '负责抖音创作者平台的开发与维护，主导多个核心功能的技术方案设计',
      '优化项目工程化配置，将构建时间从 8 分钟优化至 2 分钟，提升团队开发效率',
      '设计并实现组件库，提升代码复用率达 70%，显著减少开发时间',
      '主导性能优化项目，使平台首屏加载时间减少 50%，接入 APM 监控系统',
      '指导初级工程师，组织技术分享会，提升团队整体技术水平'
    ]
  }],
  project: [{
    name: '抖音创作者中台',
    role: '前端负责人',
    start: '2022.06',
    end: '2023.12',
    tech: 'React Redux Ant Design',
    link: '',
    bullets: [
      '基于 React 开发的创作者数据分析和内容管理平台，服务百万级创作者群体',
      '包含数据分析、内容管理、收益管理等多个子系统',
      '使用 Redux 进行状态管理，实现复杂数据流的高效处理',
      '采用 Ant Design 组件库，确保界面设计的一致性和用户体验',
      '实施代码分割和懒加载策略，优化大规模应用的加载性能'
    ]
  }, {
    name: '微信小程序开发者工具',
    role: '核心开发者',
    start: '2020.03',
    end: '2021.06',
    tech: 'Electron',
    link: '',
    bullets: [
      '为开发者提供小程序开发、调试和发布的一站式解决方案',
      '基于 Electron 构建的跨平台桌面应用',
      '支持多平台开发，包括 Windows、macOS 和 Linux',
      '提供实时的错误日志和性能分析工具',
      '集成第三方插件和 SDK，支持开发者自定义功能'
    ]
  }, {
    name: '前端监控平台',
    role: '技术负责人',
    start: '2021.09',
    end: '2022.03',
    tech: 'Vue Element UI',
    link: '',
    bullets: [
      '一个完整的前端监控解决方案，包含错误监控、性能监控、用户行为分析等功能',
      '基于 Vue 和 Element UI 构建，提供实时的监控数据和可视化分析工具',
      '支持多种监控指标，包括错误日志、性能指标、用户行为分析等',
      '提供详细的错误日志和性能分析工具，帮助开发者定位和优化问题',
      '集成第三方插件和 SDK，支持开发者自定义功能'
    ]
  }],
  education: [{
    school: '北京大学',
    major: '计算机科学与技术',
    degree: '本科',
    start: '2013.09',
    end: '2017.06',
    gpa: '',
    honor: '专业排名前 5%，连续三年获得一等奖学金',
    bullets: [
      '主修课程：数据结构、算法设计、操作系统、计算机网络、Web 开发技术',
      '专业排名前 5%，连续三年获得一等奖学金',
      '担任计算机协会技术部部长，组织多次技术分享会',
      '参与开源项目贡献，获得 GitHub Campus Expert 认证'
    ]
  }],
  cert: [],
  sections: ['basic', 'skill', 'work', 'project', 'education', 'cert'],
  settings: {
    themeColor: '#007AFF',
    baseFontSize: 16,
    lineHeight: 1.5,
    headerSize: 18,
    useIconMode: true,
    centerSubtitle: true
  }
}

/* 空模板 */
function emptyBasic() {
  return {
    name: '', title: '', status: '', email: '', phone: '', city: '',
    birthday: '', site: '', photo: '', links: [], customFields: []
  }
}

/* ------------------------------------------------------------------ */
/* 默认与示例数据                                                       */
/* ------------------------------------------------------------------ */
function emptyItem(key) {
  const base = { id: uid(), _hidden: false }
  const shape = {
    education: { school: '', major: '', degree: '', start: '', end: '', gpa: '', honor: '', bullets: [] },
    work:      { company: '', role: '', city: '', dept: '', start: '', end: '', bullets: [] },
    project:   { name: '', role: '', start: '', end: '', tech: '', link: '', bullets: [] },
    skill:     { name: '', items: [] },
    cert:      { name: '', issuer: '', date: '', desc: '' }
  }[key] || {}
  return Object.assign(base, clone(shape))
}

const THEMES = [
  { key: 'classic',  name: '经典',   desc: '稳重通用，ATS 友好', swatch: ['#007AFF', '#F2F2F7'], tag: '最安全' },
  { key: 'minimal',  name: '极简',   desc: '留白克制，气质干净', swatch: ['#1C1C1E', '#FFFFFF'], tag: '设计岗' },
  { key: 'elegant',  name: '雅致',   desc: '衬线标题，质感高级', swatch: ['#5856D6', '#FAF8F5'], tag: '管理岗' },
  { key: 'creative', name: '创意',   desc: '色块跳脱，记忆点强', swatch: ['#FF2D55', '#FFF5F7'], tag: '作品集' },
  { key: 'swiss',    name: '瑞士',   desc: '网格严格，理性秩序', swatch: ['#FF9500', '#FFFFFF'], tag: '外企' },
  { key: 'timeline', name: '时间轴', desc: '纵向叙事，突出成长', swatch: ['#34C759', '#F6FFFA'], tag: '应届生' }
]

const ACCENTS = [
  { name: '蓝',   value: '#007AFF' }, { name: '紫',   value: '#5856D6' },
  { name: '粉',   value: '#FF2D55' }, { name: '橙',   value: '#FF9500' },
  { name: '绿',   value: '#34C759' }, { name: '青',   value: '#30B0C7' },
  { name: '紫罗兰', value: '#AF52DE' }, { name: '石墨', value: '#48484A' }
]

const TARGETS = [
  { name: '通用版', emoji: '📄' },
  { name: '前端岗', emoji: '🎨' },
  { name: '后端岗', emoji: '⚙️' },
  { name: '产品岗', emoji: '🧭' },
  { name: '算法岗', emoji: '🧠' },
  { name: '考研/保研', emoji: '🎓' }
]

function newResume(name, sample) {
  const r = {
    id: uid(),
    name: name || '我的简历',
    template: 'classic',
    accent: '#007AFF',
    density: 'comfort',
    fontScale: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    basic: emptyBasic(),
    summary: '',
    education: [],
    work: [],
    project: [],
    skill: [],
    cert: [],
    sections: ['basic', 'skill', 'work', 'project', 'education', 'cert'],
    settings: clone(MOFANG.settings)
  }
  if (sample) {
    r.basic = clone(MOFANG.basic)
    r.summary = MOFANG.summary
    r.skill = clone(MOFANG.skill)
    r.work = clone(MOFANG.work)
    r.project = clone(MOFANG.project)
    r.education = clone(MOFANG.education)
    r.cert = clone(MOFANG.cert)
    r.sections = clone(MOFANG.sections)
    r.settings = clone(MOFANG.settings)
    MODULES.forEach((m) => {
      (r[m.key] || []).forEach((it) => (it.id = uid()))
    })
  }
  return r
}

/* ------------------------------------------------------------------ */
/* 读写                                                                */
/* ------------------------------------------------------------------ */
function readResumes() {
  let list = wx.getStorageSync(K_RESUMES)
  if (!Array.isArray(list) || !list.length) {
    const demo = newResume('魔方样板', true)
    const mine = newResume('我的简历', false)
    list = [demo, mine]
    wx.setStorageSync(K_RESUMES, list)
  }
  // 兼容旧结构：补齐新字段
  list.forEach((r) => {
    r.basic = Object.assign(emptyBasic(), r.basic || {})
    r.basic.customFields = r.basic.customFields || []
    r.basic.links = r.basic.links || []
    r.sections = r.sections || ['basic', 'skill', 'work', 'project', 'education', 'cert']
    r.settings = Object.assign(clone(MOFANG.settings), r.settings || {})
    MODULES.forEach((m) => { if (!Array.isArray(r[m.key])) r[m.key] = [] })
  })
  return list
}

function writeResumes(list) {
  wx.setStorageSync(K_RESUMES, list)
}

function getResumes() {
  return readResumes()
}

function getById(id) {
  const list = readResumes()
  return list.find((r) => r.id === id) || null
}

function updateById(id, mutator) {
  const list = readResumes()
  const i = list.findIndex((r) => r.id === id)
  if (i < 0) return null
  const next = mutator(list[i]) || list[i]
  next.updatedAt = Date.now()
  list[i] = next
  writeResumes(list)
  return next
}

function getActiveId() {
  const list = readResumes()
  let id = wx.getStorageSync(K_ACTIVE)
  if (!id || !list.some((r) => r.id === id)) {
    id = list[0].id
    wx.setStorageSync(K_ACTIVE, id)
  }
  return id
}

function setActiveId(id) {
  wx.setStorageSync(K_ACTIVE, id)
}

function getActive() {
  const list = readResumes()
  const id = getActiveId()
  return list.find((r) => r.id === id) || list[0]
}

function updateActive(mutator) {
  return updateById(getActiveId(), mutator)
}

function addResume(name, sample) {
  const list = readResumes()
  const r = newResume(name, sample)
  list.push(r)
  writeResumes(list)
  setActiveId(r.id)
  return r
}

function removeResume(id) {
  let list = readResumes()
  if (list.length <= 1) return list
  list = list.filter((r) => r.id !== id)
  writeResumes(list)
  if (getActiveId() === id) setActiveId(list[0].id)
  return list
}

function duplicateResume(id) {
  const list = readResumes()
  const src = list.find((r) => r.id === id)
  if (!src) return null
  const dup = clone(src)
  dup.id = uid()
  dup.name = src.name + ' 副本'
  dup.createdAt = dup.updatedAt = Date.now()
  list.push(dup)
  writeResumes(list)
  return dup
}

/* ------------------------------------------------------------------ */
/* 模块条目增删改                                                       */
/* ------------------------------------------------------------------ */
function addItem(key) {
  return updateActive((r) => {
    r[key] = r[key] || []
    r[key].push(emptyItem(key))
    return r
  })
}

function updateItem(key, id, patch) {
  return updateActive((r) => {
    const it = (r[key] || []).find((x) => x.id === id)
    if (it) Object.assign(it, patch)
    return r
  })
}

function removeItem(key, id) {
  return updateActive((r) => {
    r[key] = (r[key] || []).filter((x) => x.id !== id)
    return r
  })
}

function moveItem(key, id, dir) {
  return updateActive((r) => {
    const arr = r[key] || []
    const i = arr.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return r
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t
    return r
  })
}

/* ------------------------------------------------------------------ */
/* 投递追踪（创新点：漏斗）                                             */
/* ------------------------------------------------------------------ */
const TRACE_STAGES = [
  { key: 'sent',    name: '已投递', color: '#8E8E93' },
  { key: 'read',    name: '被查看', color: '#007AFF' },
  { key: 'interview', name: '面试中', color: '#FF9500' },
  { key: 'offer',   name: 'Offer',  color: '#34C759' },
  { key: 'reject',  name: '已结束', color: '#FF3B30' }
]

function getTrace() {
  return wx.getStorageSync(K_TRACE) || []
}
function addTrace(item) {
  const list = getTrace()
  list.unshift(Object.assign({ id: uid(), date: new Date().toISOString().slice(0, 10), stage: 'sent' }, item))
  wx.setStorageSync(K_TRACE, list)
  return list
}
function updateTraceStage(id, stage) {
  const list = getTrace()
  const it = list.find((x) => x.id === id)
  if (it) { it.stage = stage; it.updatedAt = Date.now() }
  wx.setStorageSync(K_TRACE, list)
  return list
}
function removeTrace(id) {
  const list = getTrace().filter((x) => x.id !== id)
  wx.setStorageSync(K_TRACE, list)
  return list
}

/* ------------------------------------------------------------------ */
/* 设置 / 语音名片 / 微信身份                                            */
/* ------------------------------------------------------------------ */
function getSetting() {
  return Object.assign({ dark: false, autoSave: true, privacyMode: false, watermark: '' }, wx.getStorageSync(K_SETTING) || {})
}
function setSetting(patch) {
  const s = Object.assign(getSetting(), patch)
  wx.setStorageSync(K_SETTING, s)
  return s
}
function getVoice() {
  return wx.getStorageSync(K_VOICE) || null
}
function setVoice(v) {
  wx.setStorageSync(K_VOICE, v)
}

/* 微信头像昵称授权结果 */
function getUser() {
  return wx.getStorageSync(K_USER) || null
}
function setUser(u) {
  wx.setStorageSync(K_USER, u)
  return u
}
function clearUser() {
  wx.removeStorageSync(K_USER)
}

module.exports = {
  uid, clone,
  MODULES, MODULE_MAP, BASIC_FIELDS, MOFANG, THEMES, ACCENTS, TARGETS, TRACE_STAGES,
  emptyItem, newResume,
  getResumes, getById, addResume, removeResume, duplicateResume,
  getActiveId, setActiveId, getActive, updateActive, updateById,
  addItem, updateItem, removeItem, moveItem,
  getTrace, addTrace, updateTraceStage, removeTrace,
  getSetting, setSetting, getVoice, setVoice,
  getUser, setUser, clearUser
}
