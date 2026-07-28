import { app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import JSZip from 'jszip'

function getAppDataDir(): string {
  return join(app.getPath('userData'))
}

function getRecoveryDir(): string {
  return join(getAppDataDir(), 'recovery')
}

function getRecentPath(): string {
  return join(getAppDataDir(), 'recent.json')
}

export async function ensureDirs(): Promise<void> {
  const dirs = [getRecoveryDir()]
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
}

// ── Recovery ──────────────────────────────────────────

export async function writeRecovery(projectId: string, data: string): Promise<void> {
  await ensureDirs()
  const filePath = join(getRecoveryDir(), `${projectId}.recovery`)
  await writeFile(filePath, data, 'utf-8')
}

export async function readRecovery(projectId: string): Promise<string | null> {
  const filePath = join(getRecoveryDir(), `${projectId}.recovery`)
  if (!existsSync(filePath)) return null
  return readFile(filePath, 'utf-8')
}

export async function deleteRecovery(projectId: string): Promise<void> {
  const filePath = join(getRecoveryDir(), `${projectId}.recovery`)
  if (existsSync(filePath)) {
    await unlink(filePath)
  }
}

// ── Recent Projects ───────────────────────────────────

export interface RecentProject {
  path: string
  name: string
  lastOpened: number
  thumbnailPath: string
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  const recentPath = getRecentPath()
  if (!existsSync(recentPath)) return []
  try {
    const data = await readFile(recentPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function addRecentProject(entry: RecentProject): Promise<void> {
  const recent = await getRecentProjects()
  const filtered = recent.filter((r) => r.path !== entry.path)
  filtered.unshift(entry)
  const trimmed = filtered.slice(0, 20)
  await writeFile(getRecentPath(), JSON.stringify(trimmed, null, 2), 'utf-8')
}

// ── .mockup ZIP File Operations ───────────────────────

export async function writeMockupZip(
  filePath: string,
  manifest: string,
  assets: Map<string, Buffer>
): Promise<void> {
  const zip = new JSZip()
  zip.file('manifest.json', manifest)
  for (const [name, buffer] of assets) {
    zip.file(`assets/${name}`, buffer)
  }
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await writeFile(filePath, content)
}

export async function readMockupZip(
  filePath: string
): Promise<{ manifest: string; assets: Map<string, Buffer> }> {
  const data = await readFile(filePath)
  const zip = await JSZip.loadAsync(data)

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('Invalid .mockup file: missing manifest.json')
  const manifest = await manifestFile.async('string')

  const assets = new Map<string, Buffer>()
  const assetFolder = zip.folder('assets')
  if (assetFolder) {
    const files: JSZip.JSZipObject[] = []
    assetFolder.forEach((_path, file) => {
      files.push(file)
    })
    for (const file of files) {
      const buffer = await file.async('nodebuffer')
      assets.set(file.name.replace('assets/', ''), buffer)
    }
  }

  return { manifest, assets }
}
