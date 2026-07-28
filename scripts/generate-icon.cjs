const sharp = require('sharp')
const { writeFile, readFile } = require('fs/promises')
const { join } = require('path')

const src = join(__dirname, '..', 'public', 'logo.png')
const out = join(__dirname, '..', 'public', 'logo.ico')

const SIZES = [16, 32, 48, 256]

async function buildIco() {
  const pngBuffers = await Promise.all(
    SIZES.map((size) =>
      sharp(src)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  )

  const count = SIZES.length
  // ICO header: 6 bytes
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)       // reserved
  header.writeUInt16LE(1, 2)       // type = 1 (ICO)
  header.writeUInt16LE(count, 4)   // image count

  // Each directory entry: 16 bytes
  const dirSize = count * 16
  const dataOffset = 6 + dirSize   // data starts after header + all directory entries

  let currentOffset = dataOffset
  const directories = []

  for (let i = 0; i < count; i++) {
    const size = SIZES[i]
    const buf = pngBuffers[i]
    const dir = Buffer.alloc(16)
    dir.writeUInt8(size < 256 ? size : 0, 0)  // width (0 = 256)
    dir.writeUInt8(size < 256 ? size : 0, 1)  // height (0 = 256)
    dir.writeUInt8(0, 2)                       // color palette
    dir.writeUInt8(0, 3)                       // reserved
    dir.writeUInt16LE(1, 4)                    // color planes
    dir.writeUInt16LE(32, 6)                   // bits per pixel
    dir.writeUInt32LE(buf.length, 8)           // data size
    dir.writeUInt32LE(currentOffset, 12)       // data offset
    directories.push(dir)
    currentOffset += buf.length
  }

  const ico = Buffer.concat([header, ...directories, ...pngBuffers])
  await writeFile(out, ico)
  console.log(`Generated logo.ico (${ico.length} bytes, ${count} sizes: ${SIZES.join(', ')})`)
}

buildIco().catch((e) => { console.error(e); process.exit(1) })
