// utils/ai.js —— 本地智能分析引擎
// 全部规则与词库内置，完全离线运行，简历数据不离开本机。
// 提供：JD 雷达 / ATS 体检 / 面试官模拟 / STAR 改写 / 时间线体检 / 完成度 / 成就徽章

const MODULES_KEYS = ['education', 'work', 'project', 'skill', 'cert']
const MODULE_LABEL = { education: '教育经历', work: '工作经历', project: '项目经历', skill: '专业技能', cert: '证书与荣誉' }

/* ================================================================== */
/* 一、词库                                                             */
/* ================================================================== */
const TECH = ['javascript', 'typescript', 'react', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt',
  'node.js', 'nodejs', 'java', 'spring', 'springboot', 'golang', 'python', 'django', 'flask',
  'rust', 'swift', 'kotlin', 'dart', 'flutter', 'php', 'ruby', 'c++', 'cpp',
  'mysql', 'postgres', 'postgresql', 'redis', 'mongodb', 'elasticsearch', 'kafka', 'rabbitmq',
  'docker', 'kubernetes', 'linux', 'nginx', 'git', 'jenkins', 'hadoop', 'spark', 'flink',
  'tailwind', 'tailwindcss', 'sass', 'less', 'webpack', 'vite', 'rollup', 'babel', 'eslint',
  'jest', 'cypress', 'playwright', 'html', 'html5', 'css', 'css3', 'canvas', 'svg', 'webgl',
  'electron', 'tauri', 'taro', 'uni-app', '小程序', 'ant design', 'element ui', 'styled-components',
  'graphql', 'websocket', '微服务', '分布式', 'grpc', '算法', 'jquery', 'three.js',
  'tensorflow', 'pytorch', 'sklearn', 'cuda', 'opencv', 'transformer', 'llm',
  '机器学习', '深度学习', '推荐系统', '数据挖掘', '计算机视觉', '大模型',
  // 建站 / 电商 / 运营类
  'wordpress', 'shopify', 'woocommerce', 'magento', '独立站', '跨境电商', '建站', '模板建站',
  '页面装修', '产品上架', '网站搭建', 'seo', 'sem', '广告投放', '站内优化', '页面加载',
  '响应式布局', '主题定制', '店铺装修', '商品详情', '支付接入', '物流配置', '选品', '铺货',
  '私域', '社群运营', '内容运营', '用户增长', '转化率', 'gmv', 'roi', '复购', '客单价']

const METHOD = ['数据结构', '算法设计', '算法', '操作系统', '计算机网络', '编译原理', '数据库',
  '设计模式', '软件工程', '性能优化', '工程化', '工程化建设', '重构', '灰度发布', '埋点',
  '监控', '容灾', '降级', '限流', '单元测试', '自动化测试', '代码评审', '敏捷',
  '高并发', '高可用', '低延迟', '缓存', '负载均衡', '消息队列', '代码分割', '懒加载',
  '服务端渲染', '响应式', '无障碍', '组件库', '设计系统', '技术选型', '架构设计',
  '可视化', '埋点分析', '用户行为分析', '错误监控', '性能监控', '构建优化']

const SOFT = ['沟通', '协作', '跨部门', '自驱', '抗压', '责任心', '团队管理', '带团队',
  '项目管理', '需求拆解', '数据分析', '英语', '雅思', '托福', '日语', '留学', '论文', '专利', '开源',
  '逻辑清晰', '学习能力', '执行落地']

const EDU = ['本科', '硕士', '博士', '大专', '全日制', '985', '211', '双一流', '应届', '实习', '校招', '社招']

const DICT = [].concat(TECH, METHOD, SOFT, EDU).map((s) => String(s).toLowerCase())
const DICT_SET = {}
DICT.forEach((d) => (DICT_SET[d] = true))

/* 英文停用词 */
const STOP_EN = ('the and for with you are will have has our your that this from job work team company ' +
  'ability we us be to of in on at a an or is as by can should must may not but all more than etc plus ' +
  'good strong excellent required requirements responsibilities qualifications candidate candidates ' +
  'about other using use used like new well best also get make made need needs want know ' +
  'a b c d e f g h i j k l m n o p q r s t u v w x y z').split(' ')

/* 中文停用词（整词） */
const STOP_ZH = ('岗位职责 任职要求 岗位要求 工作职责 职位描述 公司简介 福利待遇 薪资待遇 工作地点 联系方式 ' +
  '任职资格 加分项 优先考虑 团队介绍 公司介绍 以及 以上 以及以上 具有 能够 优先 熟悉 掌握 了解 具备 ' +
  '相关经验 有相关 有经验 者优先 及以上 不限 独立 负责 配合 完成 提供 相关 以及 进行 具备 良好 ' +
  '公司 团队 客户 用户 岗位 职责 要求 描述 内容 方式 方法 情况 问题 方面 主要 包括 各种 其他 ' +
  '我们 你们 他们 它们 这个 那个 一些 什么 怎么 如何 是否 等等 等等 福利 待遇 薪资 待遇 地点 人数 ' +
  '男女 性别 年龄 学历 招聘 岗位 职责 要求 能力 素质 待遇 弹性 双休 五险 福利 岗位').split(/\s+/)

/* 中文虚词：n-gram 首尾出现即丢弃 */
// 只保留真正的虚词首尾字；注意不要误伤「独/内/人/位」等常用字
const STOP_ZH_CHARS = '的了和与及着过就都很也还把被让从为以于并但因所它们这那有无对如若则再又更且么吧啊呀哦嗯'

// n-gram 首尾二字黑名单：避免抽出「完成客户网站」这类碎片
const PREFIX_STOP = ('完成 进行 提供 配合 负责 根据 通过 使用 采用 实施 支持 包括 关于 针对 介绍 ' +
  '了解 熟悉 掌握 具备 具有 能够 直接 主动 优先 以及 相关 主要 结合 面向 围绕 提升 加强 ' +
  '保证 确保 协助 帮助 做到 达到 拥有 从事 参与 任职 担任 任职 岗位 工作 团队 公司 客户 用户 ' +
  '产品 项目 功能 系统 平台 服务 技术 业务 运营 内容 需求').split(' ')
const SUFFIX_STOP = ('等等 方面 能力 经验 优先 工作 岗位 要求 职责 描述 以及 相关 内容 方式 方法 ' +
  '情况 问题 流程 体系 标准 规范 方案 措施 方法 建议 要求 优先 经验 技能 素质 能力 意识 思维').split(' ')

const STRONG_VERBS = ['主导', '牵头', '设计', '搭建', '重构', '推动', '优化', '攻坚', '落地', '攻克',
  '研发', '实现', '交付', '建立', '建设', '实施', '策划', '组织', '从0到1', '从 0 到 1']
const MEDIUM_VERBS = ['负责', '参与', '协助', '支持', '提供', '使用', '采用', '基于', '维护', '集成', '包含', '开发', '配合']
const FIRST_PERSON = ['我', '我们', '本人']
const METRIC_RE = /(\d+(\.\d+)?\s*(%|％|倍|x|X|万|k|K|亿|天|小时|分钟|秒|ms|人|次|个|项|条|年|月))/i

/* ================================================================== */
/* 二、基础处理                                                         */
/* ================================================================== */
function resumeToText(r) {
  if (!r) return ''
  const b = r.basic || {}
  const parts = [b.name, b.title, b.status, b.city, b.email, b.phone, b.site, r.summary]
  MODULES_KEYS.forEach((k) => {
    (r[k] || []).forEach((it) => {
      parts.push(Object.values(it || {}).join(' '))
      ;(it.bullets || []).forEach((t) => parts.push(t))
      ;(it.items || []).forEach((t) => parts.push(t))
    })
  })
  ;(b.customFields || []).forEach((c) => parts.push(c.label, c.value))
  ;(b.links || []).forEach((l) => parts.push(l.label, l.url))
  return parts.filter(Boolean).join('\n')
}

function bulletList(r) {
  const out = []
  ;['work', 'project'].forEach((k) => {
    (r[k] || []).forEach((it) => {
      (it.bullets || []).forEach((t) => out.push({ mod: k, id: it.id, host: it.company || it.name, text: t }))
    })
  })
  return out
}

function allTextLower(r) {
  return resumeToText(r).toLowerCase()
}

/* ================================================================== */
/* 三、关键词抽取（核心）                                               */
/* ================================================================== */

/* 英文词元 */
function extractEnglish(text) {
  const low = String(text || '').toLowerCase()
  const raw = low.match(/[a-z][a-z0-9+#.\-]{1,30}/g) || []
  const freq = {}
  raw.forEach((w) => {
    w = w.replace(/[.\-]+$/, '')
    if (w.length < 3) return
    if (STOP_EN.indexOf(w) !== -1) return
    if (/^\d+$/.test(w)) return
    freq[w] = (freq[w] || 0) + 1
  })
  return Object.keys(freq).map((w) => ({ term: w, n: freq[w], dict: !!DICT_SET[w], lang: 'en' }))
}

/* 中文 n-gram */
function extractChinese(text) {
  const runs = String(text || '').match(/[\u4e00-\u9fa5]+/g) || []
  const freq = {}
  runs.forEach((run) => {
    for (let len = 2; len <= 6 && len <= run.length; len++) {
      for (let i = 0; i + len <= run.length; i++) {
        const g = run.substr(i, len)
        // 词库命中的词直接放行，不做停用过滤
        if (!DICT_SET[g]) {
          if (STOP_ZH_CHARS.indexOf(g[0]) !== -1) continue
          if (STOP_ZH_CHARS.indexOf(g[g.length - 1]) !== -1) continue
          if (STOP_ZH.indexOf(g) !== -1) continue
          if (len >= 2 && PREFIX_STOP.indexOf(g.substr(0, 2)) !== -1) continue
          if (len >= 2 && SUFFIX_STOP.indexOf(g.substr(len - 2)) !== -1) continue
          // 内部含停用二元组的碎片（如「成客户网站交」）直接丢弃
          let dirty = false
          for (let k = 0; k + 2 <= len; k++) {
            const bg = g.substr(k, 2)
            if (PREFIX_STOP.indexOf(bg) !== -1 || SUFFIX_STOP.indexOf(bg) !== -1 || STOP_ZH.indexOf(bg) !== -1) { dirty = true; break }
          }
          if (dirty) continue
        }
        freq[g] = (freq[g] || 0) + 1
      }
    }
  })
  let cands = Object.keys(freq).map((g) => ({ term: g, n: freq[g], dict: !!DICT_SET[g], lang: 'zh' }))
  // 保留规则：词库命中 / 出现≥2次 / 2字词出现≥3次
  cands = cands.filter((c) => c.dict || c.n >= 2 || (c.term.length === 2 && c.n >= 3))
  // 去重：被更长且频率不低的词包含时丢弃（但词库词不会被非词库词挤掉）
  cands = cands.filter((c) => !cands.some((o) =>
    o.term.length > c.term.length &&
    o.term.indexOf(c.term) !== -1 &&
    o.n >= c.n &&
    (c.dict ? o.dict : true)
  ))
  return cands
}

/* 统一抽取：返回带权重的关键词列表 */
function extractKeywords(text) {
  const en = extractEnglish(text)
  const zh = extractChinese(text)
  const seen = {}
  const all = zh.concat(en)
  all.sort((a, b) => (b.dict - a.dict) || (b.n - a.n) || (b.term.length - a.term.length))
  const out = []
  all.forEach((c) => {
    if (seen[c.term]) return
    seen[c.term] = true
    // 权重：词库命中 3.0，英文 1.6，中文 n-gram 1.4
    c.w = c.dict ? 3.0 : (c.lang === 'en' ? 1.6 : 1.4)
    c.w = Math.min(c.w, c.n >= 3 ? c.w * 1.3 : c.w)
    out.push(c)
  })
  return out
}

/* 关键词在文本中的命中程度 0~1 */
function hitScore(term, text) {
  if (!term) return 0
  const t = String(text || '').toLowerCase()
  if (!t) return 0
  if (t.indexOf(term) !== -1) return 1
  // 中文按 2 字窗口做部分命中
  if (/[\u4e00-\u9fa5]/.test(term)) {
    const units = []
    for (let i = 0; i + 2 <= term.length; i++) units.push(term.substr(i, 2))
    if (!units.length) return 0
    const hit = units.filter((u) => t.indexOf(u) !== -1).length
    return hit / units.length
  }
  return 0
}

/* ================================================================== */
/* 四、JD 匹配雷达                                                       */
/* ================================================================== */
function jdRadar(r, jd) {
  const raw = extractKeywords(jd)
  if (!raw.length) return { empty: true, score: 0, hit: [], miss: [], terms: [], partial: [] }

  const rtext = allTextLower(r)
  const expText = bulletList(r).map((b) => b.text).join(' ').toLowerCase()

  let gotW = 0, totalW = 0, deep = 0, hitW = 0
  const hit = [], miss = [], partial = []

  raw.forEach((c) => {
    totalW += c.w
    const s = hitScore(c.term, rtext)
    if (s >= 0.999) {
      gotW += c.w
      hitW += c.w
      if (hitScore(c.term, expText) >= 0.999) deep += 1
      hit.push(c.term)
    } else if (s >= 0.5) {
      gotW += c.w * 0.5
      partial.push(c.term)
    } else {
      miss.push(c.term)
    }
  })

  const base = totalW ? gotW / totalW : 0
  const expBonus = hitW ? (deep / raw.length) * 0.12 : 0
  const score = Math.max(0, Math.min(100, Math.round((base * 0.9 + expBonus) * 100)))

  return {
    empty: false, score, hit, miss, partial,
    terms: raw.map((c) => c.term),
    dictHit: hit.filter((t) => DICT_SET[t]).length
  }
}

/* ================================================================== */
/* 五、ATS 机器体检                                                     */
/* ================================================================== */
function atsCheck(r) {
  const b = r.basic || {}
  const bullets = bulletList(r)
  const checks = []
  const push = (key, title, pass, tip, weight) => checks.push({ key, title, pass, tip, weight })

  push('phone', '手机号格式正确', /1[3-9]\d{9}/.test((b.phone || '').replace(/\s/g, '')),
    '机筛通常靠手机号提取联系方式，请填写 11 位手机号', 10)
  push('email', '邮箱可被解析', /^[\w.+-]+@[\w.-]+\.\w+$/.test((b.email || '').trim()),
    '建议用 Outlook / Gmail / 学校邮箱，别用 example 之类的占位邮箱', 8)
  push('name', '姓名与求职意向已填写', !!(b.name && b.title),
    '姓名和求职意向是权重最高的字段，务必填写', 10)
  push('city', '所在地已标明', !!b.city, '很多系统会按城市过滤，写上所在地能提升命中', 6)
  push('link', '附作品集 / 个人网站', !!(b.site || (b.links || []).length || (b.customFields || []).length),
    '技术岗附 GitHub / 博客，是拉开差距的高性价比项', 8)
  push('status', '标注了求职状态', !!b.status, '写明「离职 / 求职中」能省掉 HR 的第一轮确认', 4)

  const noPerson = bullets.every((x) => !FIRST_PERSON.some((p) => x.text.indexOf(p) !== -1))
  push('person', '未使用第一人称', noPerson, '删掉「我」「我们」，简历要用无人称陈述句', 6)

  let vScore = 0
  bullets.forEach((x) => {
    if (STRONG_VERBS.some((v) => x.text.indexOf(v) === 0)) vScore += 1
    else if (MEDIUM_VERBS.some((v) => x.text.indexOf(v) === 0)) vScore += 0.4
  })
  const vRatio = bullets.length ? vScore / bullets.length : 0
  push('verb', '经历以强动词开头', bullets.length > 0 && vRatio >= 0.45,
    '把「负责 XX」换成「主导 / 重构 / 搭建 XX」，开头决定 HR 是否继续读', 12)

  const quantified = bullets.filter((x) => METRIC_RE.test(x.text))
  push('metric', '成果已量化', bullets.length > 0 && quantified.length / bullets.length >= 0.4,
    '每条经历至少带一个数字：下降 43%、提升 2.1 倍、服务 12 万用户', 14)

  const long = bullets.filter((x) => x.text.length > 44)
  push('length', '单条经历够精简', long.length === 0,
    '单条控制在 40 字左右，超出会被机筛截断，也降低可读性', 6)

  push('bullets', '经历条目数量充足', bullets.length >= 4,
    '每段核心经历写 3 条，全篇 6–10 条是黄金区间', 8)

  push('skill', '已建立技能区块', (r.skill || []).length > 0,
    '技能区是机筛的主要抓词区，建议分 2–3 个类别', 8)

  const words = resumeToText(r).replace(/\s/g, '').length
  push('page', '内容量控制在一页', words <= 1600,
    '当前约 ' + words + ' 字，超过 1600 字很可能溢出到第二页', 10)

  push('depth', '有可深挖的项目', (r.project || []).length + (r.work || []).length >= 1,
    '面试官需要 1–2 个能讲 10 分钟的项目，否则面试容易失控', 8)

  let got = 0, total = 0
  checks.forEach((c) => { total += c.weight; if (c.pass) got += c.weight })
  return { score: Math.round((got / total) * 100), checks, words, bullets: bullets.length, fail: checks.filter((c) => !c.pass) }
}

/* ================================================================== */
/* 六、面试官模拟                                                       */
/* ================================================================== */
const TRAP_LIB = [
  { key: ['重构', '重写'], q: (h) => `你说在「${h}」做了重构，原来的架构到底有什么问题？为什么不能在原系统上改，一定要重构？`, point: '考察问题定位能力：能不能说清「痛在哪」，而不是只会说「旧代码烂」' },
  { key: ['性能', '优化', '加载', '渲染', '监控'], q: (h) => `「${h}」提到的性能收益是怎么测出来的？基线是什么，采样多久，有没有排除网络波动？`, point: '考察数据可信度：数字有没有测量方法支撑，能否复现' },
  { key: ['高并发', '并发', '分布式', '百万'], q: (h) => `「${h}」的并发量级是多少？如果再涨 10 倍，你的方案哪一环先崩？`, point: '考察架构边界意识：知道自己方案的天花板在哪' },
  { key: ['灰度', '发布', '回滚', '构建'], q: (h) => `「${h}」的发布/构建流程具体怎么走的？出过错吗，怎么发现、怎么止损的？`, point: '考察工程闭环：有没有回滚、监控和复盘' },
  { key: ['组件', '沉淀', '复用'], q: (h) => `「${h}」沉淀的组件被别的团队用了吗？没人用的话，你觉得是推广问题还是抽象本身有问题？`, point: '考察影响力真实性：能否诚实复盘失败' },
  { key: ['主导', '负责人', '核心开发', '带领'], q: (h) => `「${h}」里你「主导」的部分，和团队其他人的边界在哪？哪一块是你亲自写的？`, point: '考察贡献归因：能否精确划定个人贡献' },
  { key: ['ai', '大模型', '模型', '智能'], q: (h) => `「${h}」接入模型后，遇到过结果不稳定的情况吗？你怎么治理的？`, point: '考察工程落地度：是否踩过真实的坑并给出解法' },
  { key: ['下降', '提升', '缩短', '减少', '优化至'], q: (h) => `「${h}」这个数字里，有多少来自你的改动，有多少来自同期别的因素？`, point: '考察归因意识：能否隔离变量、承认外部因素' },
  { key: ['组件库', '技术选型', '架构'], q: (h) => `「${h}」的架构选型当时还有哪两个备选？你为什么否掉了它们？`, point: '考察决策过程：是否真的评估过权衡' },
  { key: ['带团队', '指导', '培养', '分享会'], q: (h) => `「${h}」里你带的人后来怎么样了？有没有你判断失误的地方？`, point: '考察管理复盘：能否客观评价自己的带人效果' }
]

const BASE_Q = [
  { q: '挑一个你最有成就感的项目，说清楚：背景是什么、你要解决的问题是什么、如果不做会怎样。', point: '考察需求理解力与目标感' },
  { q: '这个项目里有没有哪个技术决策，现在回头看你会改？为什么当时没意识到？', point: '考察复盘深度与认知迭代' },
  { q: '你和产品或设计意见不一致时怎么处理？举个真实例子。', point: '考察协作方式与冲突处理' },
  { q: '如果工期只有原来的一半，你会砍掉哪部分，保留哪部分？依据是什么？', point: '考察取舍能力与优先级判断' },
  { q: '描述一次你把一件事从头盯到尾的经历，中途最想放弃的时刻是什么。', point: '考察韧性与 Ownership' }
]

function interview(r) {
  const bullets = bulletList(r)
  const out = []
  const used = {}
  bullets.forEach((b) => {
    if (out.length >= 6) return
    const low = b.text.toLowerCase()
    for (let i = 0; i < TRAP_LIB.length; i++) {
      const t = TRAP_LIB[i]
      if (used[i]) continue
      if (t.key.some((k) => low.indexOf(k) !== -1)) {
        used[i] = true
        out.push({ q: t.q(b.host || '这段经历'), point: t.point, from: b.host || '经历', text: b.text })
        return
      }
    }
  })
  BASE_Q.forEach((b) => out.push({ q: b.q, point: b.point, from: '通用', text: '' }))
  return out.slice(0, 10)
}

/* ================================================================== */
/* 七、STAR 改写                                                        */
/* ================================================================== */
const VERB_POOL = {
  '负责': ['主导', '牵头', '独立完成'],
  '参与': ['承担核心模块', '负责子系统设计', '深度参与'],
  '协助': ['协同推进', '配合落地', '支撑'],
  '开发': ['研发', '实现', '交付'],
  '写': ['产出', '编写', '沉淀'],
  '用': ['采用', '引入', '基于'],
  '改': ['优化', '重构', '攻坚'],
  '测试': ['建立自动化测试', '完善质量保障', '设计测试方案']
}

const METRIC_HINT = ['，覆盖 X 个核心场景', '，效率提升 X%', '，交付周期缩短 X 天', '，线上故障下降 X%', '，稳定服务 X 万用户', '，P95 延迟降低 X ms']

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

function starRewrite(text) {
  const src = String(text || '').trim()
  if (!src) return { better: [], notes: [] }
  const notes = []
  const better = []
  let seed = 0
  for (let i = 0; i < src.length; i++) seed += src.charCodeAt(i)

  let body = src
  for (const bad in VERB_POOL) {
    if (body.indexOf(bad) === 0) {
      const to = pick(VERB_POOL[bad], seed)
      body = to + body.slice(bad.length)
      notes.push('「' + bad + '」→「' + to + '」，动词强度更高')
      break
    }
  }
  FIRST_PERSON.forEach((p) => { if (body.indexOf(p) === 0) body = body.slice(p.length) })
  if (src.indexOf('我') === 0) notes.push('删除了第一人称，改为无人称陈述')

  const hasMetric = METRIC_RE.test(src)

  let c1 = METRIC_RE.test(src) ? body : body + pick(METRIC_HINT, seed)
  better.push({ tag: 'STAR 结构', text: c1 })

  better.push({ tag: '结果前置', text: '通过' + body.slice(0, Math.min(body.length, 18)) + '，实现' + body.slice(Math.min(body.length, 18)) })

  const how = ['通过引入缓存与批量合并请求', '基于 A/B 实验验证后全量上线', '借助埋点数据定位瓶颈后', '搭建可视化看板持续观测后']
  better.push({ tag: '补方法链路', text: pick(how, seed) + '，' + body })

  if (!hasMetric) notes.push('原句缺少量化结果 —— 这是 HR 最在意的一条，务必补数字')
  if (src.length > 44) notes.push('原句 ' + src.length + ' 字偏长，建议压到 40 字内')
  if (FIRST_PERSON.some((p) => src.indexOf(p) !== -1)) notes.push('不要出现「我 / 我们」')

  return { better, notes }
}

/* ================================================================== */
/* 八、时间线体检                                                       */
/* ================================================================== */
function parseMonth(s) {
  if (!s) return null
  const t = String(s).trim()
  if (t.indexOf('至今') !== -1 || t.toLowerCase().indexOf('now') !== -1) return { y: 9999, m: 12 }
  const m = t.match(/(19|20)\d{2}[\.\/\-年]?\s*(\d{1,2})?/)
  if (!m) return null
  return { y: parseInt(m[0].slice(0, 4), 10), m: m[2] ? parseInt(m[2], 10) : 1 }
}
function toNum(p) { return p.y * 12 + (p.m || 1) }

function timelineCheck(r) {
  const issues = []
  ;['education', 'work', 'project'].forEach((k) => {
    const arr = r[k] || []
    for (let i = 0; i < arr.length; i++) {
      const a = parseMonth(arr[i].start), b = parseMonth(arr[i].end)
      const nm = arr[i].school || arr[i].company || arr[i].name
      if ((arr[i].start || arr[i].end) && !a) {
        issues.push({ level: 'warn', text: `「${nm}」的开始时间无法识别，建议写成 2021.09 这样的格式` })
      }
      if (a && b && toNum(b) < toNum(a)) {
        issues.push({ level: 'error', text: `「${nm}」结束时间早于开始时间` })
      }
    }
    const nums = arr.map((it) => parseMonth(it.start)).filter(Boolean).map(toNum)
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] > nums[i - 1]) {
        issues.push({ level: 'warn', text: `${MODULE_LABEL[k]}没有按时间倒序排列 —— HR 默认第一段是最近的经历` })
        break
      }
    }
  })
  const ws = (r.work || []).map((it) => ({ s: parseMonth(it.start), e: parseMonth(it.end), n: it.company }))
    .filter((x) => x.s && x.e && x.e.y !== 9999).sort((a, b) => toNum(a.s) - toNum(b.s))
  for (let i = 1; i < ws.length; i++) {
    const gap = toNum(ws[i].s) - toNum(ws[i - 1].e)
    if (gap >= 6) issues.push({ level: 'warn', text: `${ws[i - 1].n} 与 ${ws[i].n} 之间有约 ${gap} 个月空档，建议提前准备解释` })
    if (gap < 0) issues.push({ level: 'warn', text: `${ws[i - 1].n} 与 ${ws[i].n} 的时间有重叠，需要能说清原因` })
  }
  return issues
}

/* ================================================================== */
/* 九、完成度 / 建议 / 徽章                                              */
/* ================================================================== */
function completion(r) {
  const b = r.basic || {}
  const req = [
    !!b.name, !!b.title, !!b.phone, !!b.email, !!b.city,
    !!(r.summary || '').trim(),
    (r.education || []).length > 0,
    (r.work || []).length + (r.project || []).length > 0,
    bulletList(r).length >= 3,
    (r.skill || []).length > 0
  ]
  return Math.round((req.filter(Boolean).length / req.length) * 100)
}

function suggestions(r) {
  const ats = atsCheck(r)
  const tl = timelineCheck(r)
  const comp = completion(r)
  const out = []
  ats.fail.sort((a, b) => b.weight - a.weight).slice(0, 3).forEach((c) => out.push({ icon: '🛠', text: c.tip, weight: c.weight }))
  tl.slice(0, 2).forEach((t) => out.push({ icon: t.level === 'error' ? '⛔️' : '📅', text: t.text, weight: 5 }))
  if (comp < 60) out.push({ icon: '📝', text: '简历完成度还不到 60%，先把基本信息和经历补齐再投', weight: 8 })
  if (!out.length) out.push({ icon: '✅', text: '当前状态良好，可以开始投递并回收反馈了', weight: 0 })
  return out.slice(0, 4)
}

function badges(r, trace) {
  const comp = completion(r)
  const ats = atsCheck(r)
  const bullets = bulletList(r)
  const quantified = bullets.filter((x) => METRIC_RE.test(x.text)).length
  return [
    { id: 'start', name: '启程', emoji: '🌱', color: '#34C759', ok: comp >= 40, hint: '完成度达到 40%' },
    { id: 'solid', name: '骨架', emoji: '🦴', color: '#007AFF', ok: comp >= 80, hint: '完成度达到 80%' },
    { id: 'full', name: '满分', emoji: '💯', color: '#FF2D55', ok: comp >= 100, hint: '信息全部填完' },
    { id: 'metric', name: '数据派', emoji: '📊', color: '#FF9500', ok: quantified >= 3, hint: '3 条带数字的成果' },
    { id: 'ats', name: '机筛通', emoji: '🤖', color: '#5856D6', ok: ats.score >= 85, hint: 'ATS 体检 85 分以上' },
    { id: 'polish', name: '精修', emoji: '✨', color: '#AF52DE', ok: bullets.length >= 6, hint: '6 条以上经历描述' },
    { id: 'send', name: '出手', emoji: '📮', color: '#30B0C7', ok: (trace || []).length >= 1, hint: '记录第一次投递' },
    { id: 'offer', name: 'Offer', emoji: '🎉', color: '#34C759', ok: (trace || []).some((t) => t.stage === 'offer'), hint: '拿到 Offer' }
  ]
}

module.exports = {
  resumeToText, jdRadar, atsCheck, interview, starRewrite,
  timelineCheck, completion, suggestions, badges, bulletList, parseMonth,
  extractKeywords, hitScore, MODULE_LABEL
}
