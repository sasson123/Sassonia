const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

function createIcon(size) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2
  const r = size * 0.39

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4
      const inCircle = (x - cx) ** 2 + (y - cx) ** 2 <= r * r
      png.data[idx]     = inCircle ? 14  : 30   // R
      png.data[idx + 1] = inCircle ? 165 : 41   // G
      png.data[idx + 2] = inCircle ? 233 : 59   // B
      png.data[idx + 3] = 255                    // A
    }
  }

  return PNG.sync.write(png)
}

const outDir = path.join(__dirname, '..', 'public')
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createIcon(192))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createIcon(512))
console.log('PWA icons generated.')
