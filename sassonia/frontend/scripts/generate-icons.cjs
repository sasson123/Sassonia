const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

function createIcon(size) {
  const png = new PNG({ width: size, height: size })
  const data = png.data
  const S = size / 512
  const cx = size / 2
  const cy = size * 250 / 512

  function px(x, y, r, g, b) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
  }

  function fillCircle(x0, y0, radius, r, g, b) {
    const r2 = radius * radius
    const minX = Math.max(0, Math.floor(x0 - radius))
    const maxX = Math.min(size - 1, Math.ceil(x0 + radius))
    const minY = Math.max(0, Math.floor(y0 - radius))
    const maxY = Math.min(size - 1, Math.ceil(y0 + radius))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if ((x - x0) ** 2 + (y - y0) ** 2 <= r2) px(x, y, r, g, b)
      }
    }
  }

  function fillRect(x, y, w, h, r, g, b) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
      for (let qx = Math.floor(x); qx < Math.ceil(x + w); qx++) {
        px(qx, py, r, g, b)
      }
    }
  }

  // Map from SVG 512x512 coords (origin at 256,250)
  const mx = (svgX) => (svgX - 256) * S + cx
  const my = (svgY) => (svgY - 250) * S + cy

  // Background: dark gradient (#164e63 → #0f172a diagonal)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2)
      const r = Math.round(22 * (1 - t) + 15 * t)
      const g2 = Math.round(78 * (1 - t) + 23 * t)
      const b = Math.round(99 * (1 - t) + 42 * t)
      px(x, y, r, g2, b)
    }
  }

  // Plate outer ring: #1e293b = 30,41,59
  fillCircle(cx, cy, 168 * S, 30, 41, 59)
  // Plate inner: #263042 = 38,48,66
  fillCircle(cx, cy, 136 * S, 38, 48, 66)

  // Fork: #38bdf8 = 56,189,248
  const fR = 56, fG = 189, fB = 248
  // 3 tines
  fillRect(mx(231), my(140), 14 * S, 74 * S, fR, fG, fB)
  fillRect(mx(253), my(140), 14 * S, 74 * S, fR, fG, fB)
  fillRect(mx(275), my(140), 14 * S, 74 * S, fR, fG, fB)
  // bridge
  fillRect(mx(231), my(205), 58 * S, 16 * S, fR, fG, fB)
  // handle
  fillRect(mx(247), my(219), 26 * S, 154 * S, fR, fG, fB)

  return PNG.sync.write(png)
}

const outDir = path.join(__dirname, '..', 'public')
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createIcon(192))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createIcon(512))
console.log('PWA icons generated.')
