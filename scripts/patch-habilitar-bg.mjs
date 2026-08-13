import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(__dirname, '../public/habilitar-bg.png')
const sourceShot = path.resolve(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-Camil-Documents-gananet/assets/c__Users_Camil_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-f3d11be9-0fc7-4505-9453-390cb8276345.png',
)

async function main() {
  const input = fs.existsSync(sourceShot) ? sourceShot : target
  const meta = await sharp(input).metadata()
  const w = meta.width
  const h = meta.height

  // Región contaminada (Tampermonkey) abajo-derecha
  const dirtyLeft = Math.round(w * 0.72)
  const dirtyTop = Math.round(h * 0.74)
  const dirtyW = w - dirtyLeft
  const dirtyH = h - dirtyTop

  // Clonar franja limpia justo a la izquierda, misma altura
  const sampleW = Math.min(120, dirtyLeft - Math.round(w * 0.35))
  const sampleLeft = dirtyLeft - sampleW - 4

  const clone = await sharp(input)
    .extract({
      left: sampleLeft,
      top: dirtyTop,
      width: sampleW,
      height: dirtyH,
    })
    .resize(dirtyW, dirtyH, { fit: 'fill' })
    .png()
    .toBuffer()

  const tmp = target + '.tmp.png'
  await sharp(input)
    .composite([{ input: clone, left: dirtyLeft, top: dirtyTop }])
    .png()
    .toFile(tmp)
  fs.renameSync(tmp, target)
  console.log('OK cloned over Tampermonkey', {
    w,
    h,
    dirtyLeft,
    dirtyTop,
    dirtyW,
    dirtyH,
    sampleLeft,
    sampleW,
  })
}

main()
