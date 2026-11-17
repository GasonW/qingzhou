import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporary = path.join(root, 'target', 'qingzhou-icon-assets')
const destination = path.join(root, 'src-tauri', 'icons')
const master = await fs.readFile(
  path.join(root, 'src', 'assets', 'qingzhou.svg'),
  'utf8',
)
await fs.mkdir(temporary, { recursive: true })

async function render(name, svg) {
  const input = path.join(temporary, `${name}.svg`)
  const output = path.join(temporary, name)
  await fs.writeFile(input, svg)
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
      'icon',
      input,
      '--output',
      output,
    ],
    { cwd: root, stdio: 'pipe' },
  )
  return output
}

const app = await render('app', master)
for (const entry of await fs.readdir(app, { withFileTypes: true })) {
  if (entry.isFile())
    await fs.copyFile(
      path.join(app, entry.name),
      path.join(destination, entry.name),
    )
}
const idle = await render(
  'idle',
  master
    .replace('#487DF4', '#8796AE')
    .replace('#2858DB', '#67768D')
    .replace('#A2E8DD', '#E1E7EF'),
)
const tun = await render(
  'tun',
  master.replace('#487DF4', '#22AC9A').replace('#2858DB', '#087D77'),
)
await fs.copyFile(
  path.join(idle, 'icon.ico'),
  path.join(destination, 'tray-icon.ico'),
)
await fs.copyFile(
  path.join(app, 'icon.ico'),
  path.join(destination, 'tray-icon-sys.ico'),
)
await fs.copyFile(
  path.join(tun, 'icon.ico'),
  path.join(destination, 'tray-icon-tun.ico'),
)

const glyph = master
  .replace(/<defs>[\s\S]*?<\/defs>/, '')
  .replace(/<rect[^>]*\/>/, '')
  .replace('viewBox="0 0 1024 1024"', 'viewBox="168 152 688 688"')
  .replace(/fill="#[A-Fa-f0-9]+"/g, 'fill="#000000"')
const mono = await render('mono', glyph)
const monoSystem = await render(
  'mono-system',
  glyph.replace(
    '</svg>',
    '<circle cx="760" cy="260" r="44" fill="#000000"/></svg>',
  ),
)
const monoTun = await render(
  'mono-tun',
  glyph.replace(
    '</svg>',
    '<path d="M760 202L818 260L760 318L702 260Z" fill="#000000"/></svg>',
  ),
)
await fs.copyFile(
  path.join(mono, 'icon.ico'),
  path.join(destination, 'tray-icon-mono.ico'),
)
for (const filename of [
  'tray-icon-sys-mono.ico',
  'tray-icon-sys-mono-new.ico',
]) {
  await fs.copyFile(
    path.join(monoSystem, 'icon.ico'),
    path.join(destination, filename),
  )
}
for (const filename of [
  'tray-icon-tun-mono.ico',
  'tray-icon-tun-mono-new.ico',
]) {
  await fs.copyFile(
    path.join(monoTun, 'icon.ico'),
    path.join(destination, filename),
  )
}
console.log(
  'Generated Qingzhou application icons and colored/monochrome tray states.',
)
