// utils/md.js —— 把大模型返回的 Markdown 转成小程序 rich-text 能吃的 HTML
//
// ⚠️ 关键约束：rich-text 内部的节点【不会】应用页面 WXSS 的样式，
//    所有视觉效果必须写在内联 style 上。因此这里每个标签都带 style。
//    另外 ul/ol/li 的默认项目符号在部分基础库上不渲染，所以列表统一
//    降级成「带前缀的段落」，保证在任何机型上都正常。

const A = String.fromCharCode(38)
const E_AMP = A + 'amp;'
const E_LT = A + 'lt;'
const E_GT = A + 'gt;'
const E_QUOT = A + 'quot;'

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, E_AMP)
    .replace(/</g, E_LT)
    .replace(/>/g, E_GT)
    .replace(/"/g, E_QUOT)
}

/* ---------- 样式（px，不用 rpx —— rich-text 内 rpx 支持不稳定） ---------- */
const S = {
  p: 'font-size:14px;line-height:1.78;color:#1C1C1E;margin:0 0 10px;word-break:break-word;',
  h4: 'font-size:16px;font-weight:600;color:#000;line-height:1.45;margin:20px 0 8px;',
  h5: 'font-size:15px;font-weight:600;color:#000;line-height:1.45;margin:18px 0 7px;',
  h6: 'font-size:14px;font-weight:600;color:#3A3A3C;line-height:1.45;margin:16px 0 6px;',
  li: 'font-size:14px;line-height:1.78;color:#1C1C1E;margin:0 0 7px;padding-left:15px;text-indent:-15px;word-break:break-word;',
  quote: 'font-size:13.5px;line-height:1.75;color:#5A5A5E;margin:0 0 10px;padding:8px 12px;' +
    'border-left:3px solid #007AFF;background:#F5F7FF;border-radius:0 6px 6px 0;',
  pre: 'font-size:12.5px;line-height:1.7;color:#2C2C2E;margin:0 0 12px;padding:12px 14px;' +
    'background:#F2F2F7;border-radius:10px;font-family:Menlo,Consolas,monospace;word-break:break-all;',
  code: 'font-size:12.5px;padding:1px 5px;border-radius:4px;background:#F2F2F7;' +
    'color:#C7254E;font-family:Menlo,Consolas,monospace;',
  strong: 'font-weight:600;color:#000;',
  em: 'font-style:italic;',
  a: 'color:#007AFF;',
  hr: 'height:0;border-top:1px solid #E5E5EA;margin:16px 0;'
}

/* ---------- 行内元素 ---------- */
function inline(s) {
  let t = esc(s)
  // 行内代码（先做，避免内部 ** 被误判）
  t = t.replace(/`([^`]+)`/g, '<span style="' + S.code + '">$1</span>')
  // 粗体
  t = t.replace(/\*\*([^*]+)\*\*/g, '<span style="' + S.strong + '">$1</span>')
  t = t.replace(/__([^_]+)__/g, '<span style="' + S.strong + '">$1</span>')
  // 斜体
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<span style="' + S.em + '">$2</span>')
  // 链接：rich-text 里 a 不可点击，降级成「文字 + 灰色链接」
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<span style="' + S.a + '">$1</span><span style="color:#8E8E93;font-size:12.5px"> $2</span>')
  return t
}

/**
 * Markdown → rich-text 可用的 HTML
 * @param {string} md
 * @returns {string}
 */
function mdToHtml(md) {
  const lines = String(md == null ? '' : md).split(/\r?\n/)
  let html = ''
  let inCode = false
  let codeBuf = []
  let pBuf = []

  const flushP = () => {
    if (!pBuf.length) return
    html += '<p style="' + S.p + '">' + pBuf.join('<br/>') + '</p>'
    pBuf = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()

    // ---- 代码块 ----
    if (/^```/.test(t)) {
      if (inCode) {
        html += '<p style="' + S.pre + '">' + esc(codeBuf.join('\n')).replace(/\n/g, '<br/>') + '</p>'
        codeBuf = []
        inCode = false
      } else {
        flushP()
        inCode = true
      }
      continue
    }
    if (inCode) { codeBuf.push(raw); continue }

    // ---- 空行：结束段落 ----
    if (!t) { flushP(); continue }

    // ---- 分隔线 ----
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushP()
      html += '<p style="' + S.hr + '"></p>'
      continue
    }

    // ---- 标题 ----
    const h = t.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushP()
      const lv = h[1].length
      const style = lv <= 2 ? S.h4 : (lv === 3 ? S.h5 : S.h6)
      const tag = lv <= 2 ? 'h4' : (lv === 3 ? 'h5' : 'h6')
      html += '<' + tag + ' style="' + style + '">' + inline(h[2]) + '</' + tag + '>'
      continue
    }

    // ---- 无序列表 ----
    let m = t.match(/^[-*+]\s+(.*)$/)
    if (m) {
      flushP()
      html += '<p style="' + S.li + '">• ' + inline(m[1]) + '</p>'
      continue
    }
    // ---- 有序列表 ----
    m = t.match(/^(\d+)[.)]\s+(.*)$/)
    if (m) {
      flushP()
      html += '<p style="' + S.li + '">' + m[1] + '. ' + inline(m[2]) + '</p>'
      continue
    }

    // ---- 引用 ----
    if (/^>\s?/.test(t)) {
      flushP()
      html += '<p style="' + S.quote + '">' + inline(t.replace(/^>\s?/, '')) + '</p>'
      continue
    }

    // ---- 表格行：降级成普通段落 ----
    if (/^\|/.test(t)) {
      flushP()
      html += '<p style="' + S.p + '">' + inline(t.replace(/\|/g, ' ').replace(/\s{2,}/g, '  ')) + '</p>'
      continue
    }

    // ---- 普通文字：累积到段落 ----
    pBuf.push(inline(t))
  }

  if (inCode && codeBuf.length) {
    html += '<p style="' + S.pre + '">' + esc(codeBuf.join('\n')).replace(/\n/g, '<br/>') + '</p>'
  }
  flushP()
  return html
}

module.exports = { mdToHtml, inline, esc, STYLES: S }
