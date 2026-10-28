// utils/render.js —— 把简历绘制到 Canvas（导出长图 / 缩略图）
// 支持：隐私脱敏、暗水印、紧凑/宽松密度、主题色
const AI = require('./ai.js')

const A4_W = 1240
const M = 90

const FONT = '"PingFang SC", -apple-system, "Helvetica Neue", sans-serif'

// 兼容新旧两套 Canvas API：type="2d" 走标准属性，旧版走 setXxx 方法
function setFill(ctx, color) {
  ctx.fillStyle = color
  if (typeof ctx.setFillStyle === 'function') { try { ctx.setFillStyle(color) } catch (e) {} }
}
function setFont(ctx, size, weight) {
  ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT
  if (typeof ctx.setFontSize === 'function') { try { setFont(ctx, size) } catch (e) {} }
}

function maskPhone(p) {
  const s = String(p || '').replace(/\s/g, '')
  if (s.length < 7) return s
  return s.slice(0, 3) + '****' + s.slice(-4)
}
function maskEmail(e) {
  const s = String(e || '')
  const i = s.indexOf('@')
  if (i < 2) return s
  return s.slice(0, 2) + '***' + s.slice(i)
}

// 以换行/中文标点/空格为界做贪心折行
function wrap(ctx, text, maxW) {
  const out = []
  String(text || '').split('\n').forEach((line) => {
    if (ctx.measureText(line).width <= maxW) { out.push(line); return }
    let cur = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '\n') { out.push(cur); cur = ''; continue }
      const test = cur + ch
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = ch }
      else cur = test
    }
    if (cur) out.push(cur)
  })
  return out
}

/**
 * @param ctx canvas 2d context
 * @param r   简历数据
 * @param opts { privacy, watermark, density, accent }
 * @returns 画布总高度
 */
function drawResume(ctx, r, opts) {
  opts = opts || {}
  const privacy = !!opts.privacy
  const density = opts.density === 'compact' ? 0.86 : 1
  const accent = opts.accent || r.accent || '#007AFF'
  const compact = opts.density === 'compact'

  const LH_BODY = Math.round(34 * density)
  const F_BODY = Math.round(21 * density)
  const F_SMALL = Math.round(18 * density)

  let y = 0
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  // ---- 背景 ----
  setFill(ctx, '#FFFFFF')
  ctx.fillRect(0, 0, A4_W, 8000)

  // ---- 顶部主题色条 ----
  const grad = ctx.createLinearGradient(0, 0, A4_W, 0)
  grad.addColorStop(0, accent)
  grad.addColorStop(1, '#5856D6')
  setFill(ctx, grad)
  ctx.fillRect(0, 0, A4_W, 10)

  y = M

  // ---- 头部 ----
  const b = r.basic || {}
  setFont(ctx, Math.round(42 * density), 700)
  setFill(ctx, '#000000')
  ctx.fillText(b.name || '姓名未填写', M, y)
  y += Math.round(58 * density)

  if (b.title) {
    setFont(ctx, Math.round(23 * density), 500)
    setFill(ctx, accent)
    ctx.fillText(b.title, M, y)
    y += Math.round(38 * density)
  }

  // 联系方式
  const contacts = [
    privacy ? maskPhone(b.phone) : b.phone,
    privacy ? maskEmail(b.email) : b.email,
    b.city,
    b.site
  ].filter(Boolean)
  ;(b.links || []).forEach((l) => contacts.push(l.label + (privacy ? '' : '')))
  if (contacts.length) {
    setFont(ctx, F_SMALL)
    setFill(ctx, '#6B6B70')
    let line = ''
    const lines = []
    contacts.forEach((c) => {
      const t = line ? line + '   ·   ' + c : c
      if (ctx.measureText(t).width > A4_W - M * 2) { lines.push(line); line = c }
      else line = t
    })
    if (line) lines.push(line)
    lines.forEach((l) => { ctx.fillText(l, M, y); y += Math.round(26 * density) })
  }
  y += Math.round(14 * density)
  setFill(ctx, '#D8D8DD')
  ctx.fillRect(M, y, A4_W - M * 2, 1.5)
  y += Math.round(28 * density)

  const contentW = A4_W - M * 2

  function secTitle(t) {
    setFont(ctx, Math.round(22 * density), 700)
    setFill(ctx, accent)
    ctx.fillText(t, M, y)
    y += Math.round(30 * density)
    setFill(ctx, '#E3E3E8')
    ctx.fillRect(M, y, contentW, 1)
    y += Math.round(20 * density)
  }

  function bulletItem(text) {
    setFont(ctx, F_BODY)
    setFill(ctx, '#000000')
    const lines = wrap(ctx, text, contentW - 34)
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        setFill(ctx, accent)
        ctx.beginPath(); ctx.arc(M + 6, y + 9, 3.5, 0, Math.PI * 2); ctx.fill()
      }
      setFill(ctx, '#111114')
      ctx.fillText(lines[i], M + 20, y)
      y += LH_BODY
    }
  }

  function row2(left, right, boldLeft) {
    setFont(ctx, Math.round(22 * density), boldLeft ? 700 : 400)
    setFill(ctx, '#000000')
    if (boldLeft) {
      const lw = Math.min(ctx.measureText(left).width, contentW - 300)
      ctx.fillText(left, M, y, lw)
    } else {
      ctx.fillText(left, M, y)
    }
    if (right) {
      const rw = ctx.measureText(right).width
      setFill(ctx, '#6B6B70')
      setFont(ctx, F_SMALL)
      ctx.fillText(right, A4_W - M - rw, y + 3)
    }
    y += Math.round(32 * density)
  }

  function subLine(t) {
    if (!t) return
    setFont(ctx, F_SMALL)
    setFill(ctx, '#6B6B70')
    wrap(ctx, t, contentW).forEach((l) => { ctx.fillText(l, M, y); y += Math.round(26 * density) })
  }

  // ---- 个人简介 ----
  if (r.summary) {
    secTitle('个人简介')
    setFont(ctx, F_BODY)
    setFill(ctx, '#222226')
    wrap(ctx, r.summary, contentW).forEach((l) => { ctx.fillText(l, M, y); y += LH_BODY })
    y += Math.round(22 * density)
  }

  // ---- 教育 ----
  const edu = (r.education || []).filter((x) => !x._hidden)
  if (edu.length) {
    secTitle('教育经历')
    edu.forEach((it) => {
      row2(it.school || '', [it.start, it.end].filter(Boolean).join(' – '), true)
      subLine([it.major, it.degree, it.gpa ? 'GPA ' + it.gpa : '', it.honor].filter(Boolean).join(' · '))
      subLine(it.desc)
      y += Math.round(14 * density)
    })
    y += Math.round(10 * density)
  }

  // ---- 工作 ----
  const work = (r.work || []).filter((x) => !x._hidden)
  if (work.length) {
    secTitle('工作 / 实习经历')
    work.forEach((it) => {
      row2((privacy ? (it.company || '') : it.company) + (it.role ? '  ·  ' + it.role : ''),
        [it.start, it.end].filter(Boolean).join(' – '), true)
      subLine([it.city, it.dept].filter(Boolean).join(' · '))
      ;(it.bullets || []).forEach((t) => bulletItem(t))
      y += Math.round(16 * density)
    })
    y += Math.round(10 * density)
  }

  // ---- 项目 ----
  const proj = (r.project || []).filter((x) => !x._hidden)
  if (proj.length) {
    secTitle('项目经历')
    proj.forEach((it) => {
      row2(it.name + (it.role ? '  ·  ' + it.role : ''), [it.start, it.end].filter(Boolean).join(' – '), true)
      subLine(it.tech)
      if (it.link && !privacy) subLine('链接：' + it.link)
      ;(it.bullets || []).forEach((t) => bulletItem(t))
      y += Math.round(16 * density)
    })
    y += Math.round(10 * density)
  }

  // ---- 技能 ----
  const skill = (r.skill || []).filter((x) => !x._hidden)
  if (skill.length) {
    secTitle('专业技能')
    skill.forEach((g) => {
      setFont(ctx, F_BODY)
      setFill(ctx, '#000000')
      const head = (g.name || '') + '：'
      const hw = ctx.measureText(head).width
      ctx.fillText(head, M, y)
      setFill(ctx, '#333338')
      wrap(ctx, (g.items || []).join('  ·  '), contentW - hw).forEach((l, i) => {
        ctx.fillText(l, M + hw, y + i * LH_BODY)
      })
      y += LH_BODY + Math.round(10 * density)
    })
    y += Math.round(10 * density)
  }

  // ---- 证书 ----
  const cert = (r.cert || []).filter((x) => !x._hidden)
  if (cert.length) {
    secTitle('证书与荣誉')
    cert.forEach((it) => {
      row2(it.name, it.date, true)
      subLine([it.issuer, it.desc].filter(Boolean).join(' · '))
      y += Math.round(8 * density)
    })
  }

  y += Math.round(50 * density)

  // ---- 水印 ----
  if (opts.watermark) {
    ctx.save()
    setFont(ctx, 28)
    setFill(ctx, 'rgba(120,120,128,0.16)')
    for (let wy = 160; wy < y; wy += 260) {
      ctx.fillText(opts.watermark, M, wy)
    }
    ctx.restore()
  }

  // ---- 底部信息 ----
  setFont(ctx, 16)
  setFill(ctx, '#A9A9AF')
  ctx.fillText('Magic Resume · 生成于小程序 ' + new Date().toLocaleDateString('zh-CN'), M, y - 20)

  return y
}

// 生成纯文本 / Markdown
function toMarkdown(r) {
  const b = r.basic || {}
  const L = []
  L.push('# ' + (b.name || '姓名未填写'))
  L.push(b.title ? '**' + b.title + '**' : '')
  const c = [b.phone, b.email, b.city, b.site].filter(Boolean).join(' · ')
  L.push(c)
  L.push('')
  if (r.summary) { L.push('## 个人简介'); L.push(r.summary); L.push('') }
  const P = (title, arr, fn) => {
    const list = (arr || []).filter((x) => !x._hidden)
    if (!list.length) return
    L.push('## ' + title)
    list.forEach((it) => { fn(it).forEach((t) => L.push(t)); L.push('') })
  }
  P('教育经历', r.education, (it) => {
    const o = ['**' + it.school + '** · ' + it.major + (it.degree ? ' · ' + it.degree : '')]
    o.push(([it.start, it.end].join(' – ')) + ([it.gpa, it.honor].filter(Boolean).join(' · ')))
    return o
  })
  P('工作经历', r.work, (it) => {
    const o = ['**' + it.company + '** · ' + it.role + '　`' + [it.start, it.end].join(' – ') + '`']
    ;(it.bullets || []).forEach((t) => o.push('- ' + t))
    return o
  })
  P('项目经历', r.project, (it) => {
    const o = ['**' + it.name + '**' + (it.role ? ' · ' + it.role : '')]
    if (it.tech) o.push('技术栈：' + it.tech)
    ;(it.bullets || []).forEach((t) => o.push('- ' + t))
    return o
  })
  P('专业技能', r.skill, (it) => ['**' + it.name + '**：' + (it.items || []).join(' · ')])
  P('证书与荣誉', r.cert, (it) => ['- **' + it.name + '**' + (it.issuer ? ' · ' + it.issuer : '') + (it.date ? ' · ' + it.date : '')])
  return L.join('\n')
}

module.exports = { drawResume, toMarkdown, A4_W, maskPhone, maskEmail }
