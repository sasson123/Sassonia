const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

function lerp(a, b, t) { return a + (b - a) * t }

function createIcon(size) {
  const png = new PNG({ width: size, height: size })
  const d = png.data
  const S = size / 512

  function setpx(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // alpha-blend over existing
    const af = a / 255
    d[i]     = Math.round(d[i]     * (1 - af) + r * af)
    d[i + 1] = Math.round(d[i + 1] * (1 - af) + g * af)
    d[i + 2] = Math.round(d[i + 2] * (1 - af) + b * af)
    d[i + 3] = 255
  }

  function fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
      for (let px2 = Math.floor(x); px2 < Math.ceil(x + w); px2++)
        setpx(px2, py, r, g, b, a)
  }

  function fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius
    for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py++)
      for (let px2 = Math.floor(cx - radius); px2 <= Math.ceil(cx + radius); px2++)
        if ((px2 - cx) ** 2 + (py - cy) ** 2 <= r2) setpx(px2, py, r, g, b, a)
  }

  function strokeCircle(cx, cy, radius, thickness, r, g, b) {
    const outerR2 = (radius + thickness / 2) ** 2
    const innerR2 = (radius - thickness / 2) ** 2
    for (let py = Math.floor(cy - radius - thickness); py <= Math.ceil(cy + radius + thickness); py++)
      for (let px2 = Math.floor(cx - radius - thickness); px2 <= Math.ceil(cx + radius + thickness); px2++) {
        const dist2 = (px2 - cx) ** 2 + (py - cy) ** 2
        if (dist2 >= innerR2 && dist2 <= outerR2) setpx(px2, py, r, g, b)
      }
  }

  function roundedRect(x, y, w, h, rx, r, g, b, a = 255) {
    for (let py = Math.floor(y); py <= Math.ceil(y + h); py++) {
      for (let px2 = Math.floor(x); px2 <= Math.ceil(x + w); px2++) {
        const dx = Math.max(0, Math.max(x + rx - px2, px2 - (x + w - rx)))
        const dy = Math.max(0, Math.max(y + rx - py, py - (y + h - rx)))
        if (dx * dx + dy * dy <= rx * rx) setpx(px2, py, r, g, b, a)
      }
    }
  }

  // ── Background: warm yellow-orange gradient ──
  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      // diagonal gradient: top-left #FFBE00 → bottom-right #FF6B35
      const t = (px2 + py) / (size * 2)
      const r2 = Math.round(lerp(255, 255, t))
      const g2 = Math.round(lerp(190, 107, t))
      const b2 = Math.round(lerp(0,   53,  t))
      setpx(px2, py, r2, g2, b2)
    }
  }

  // ── Rounded corners (make it look like an app icon) ──
  const cornerR = 90 * S
  // mask corners by painting transparent-ish (just leave as-is; most launchers clip anyway)

  // ── White circle ──
  const cx = size / 2
  const cy = size / 2
  const circR = 210 * S
  fillCircle(cx, cy, circR, 255, 255, 255)

  // ── Inner warm circle ──
  const innerR = 180 * S
  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      const dist = Math.sqrt((px2 - cx) ** 2 + (py - cy) ** 2)
      if (dist <= innerR) {
        const t = (px2 + py) / (size * 2)
        const r2 = Math.round(lerp(255, 255, t))
        const g2 = Math.round(lerp(190, 140, t))
        const b2 = Math.round(lerp(20,  20,  t))
        setpx(px2, py, r2, g2, b2)
      }
    }
  }

  // ── Sun rays (subtle lines inside inner circle) ──
  const rayCount = 16
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2
    const r1 = 70 * S, r2 = 170 * S
    const thick = 6 * S
    for (let dist = r1; dist <= r2; dist += 1) {
      const rx2 = cx + Math.cos(angle) * dist
      const ry = cy + Math.sin(angle) * dist
      for (let dx = -thick / 2; dx <= thick / 2; dx++) {
        const px2 = Math.round(rx2 + dx * Math.cos(angle + Math.PI / 2))
        const py = Math.round(ry + dx * Math.sin(angle + Math.PI / 2))
        const ddist = Math.sqrt((px2 - cx) ** 2 + (py - cy) ** 2)
        if (ddist <= innerR - 2) setpx(px2, py, 255, 200, 50, 80)
      }
    }
  }

  // ── Shopping cart (sky blue #4DB8E8) ──
  const CR = 56, CG = 184, CB = 232  // cart color

  // Cart body: trapezoid-ish rounded rect
  // Coordinates in 512-space, centered around 230,200
  const cartX = (v) => cx + (v - 256) * S
  const cartY = (v) => cy + (v - 230) * S

  // Cart basket
  const bx = cartX(155), by = cartY(140)
  const bw = 200 * S, bh = 130 * S, brx = 12 * S
  roundedRect(bx, by, bw, bh, brx, CR, CG, CB)

  // Cart bottom bar
  fillRect(cartX(155), cartY(268), 200 * S, 16 * S, CR, CG, CB)

  // Cart handle (top-left arm)
  fillRect(cartX(120), cartY(115), 46 * S, 14 * S, CR, CG, CB)
  // vertical pole
  fillRect(cartX(120), cartY(115), 14 * S, 55 * S, CR, CG, CB)

  // Cart wheels
  fillCircle(cartX(195), cartY(304), 22 * S, CR, CG, CB)
  fillCircle(cartX(195), cartY(304), 12 * S, 255, 190, 20)
  fillCircle(cartX(315), cartY(304), 22 * S, CR, CG, CB)
  fillCircle(cartX(315), cartY(304), 12 * S, 255, 190, 20)

  // Checklist inside cart (3 lines with green checks)
  const lineX = cartX(195), lineW = 110 * S, lineH = 11 * S
  const lineY1 = cartY(163), lineY2 = cartY(191), lineY3 = cartY(219)

  fillRect(lineX, lineY1, lineW, lineH, 255, 255, 255, 180)
  fillRect(lineX, lineY2, lineW, lineH, 255, 255, 255, 180)
  fillRect(lineX, lineY3, lineW, lineH, 255, 255, 255, 180)

  // Green checkmarks
  const GR = 60, GG = 200, GB = 80
  const ckX = cartX(163)
  function drawCheck(startY) {
    const s = 8 * S
    fillRect(ckX,         startY + s * 0.5, s * 0.5, s * 0.8, GR, GG, GB)
    fillRect(ckX + s * 0.4, startY,         s * 0.5, s * 1.2, GR, GG, GB)
  }
  drawCheck(lineY1 - 3 * S)
  drawCheck(lineY2 - 3 * S)
  drawCheck(lineY3 - 3 * S)

  return PNG.sync.write(png)
}

const outDir = path.join(__dirname, '..', 'public')
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createIcon(192))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createIcon(512))
console.log('PWA icons generated.')
