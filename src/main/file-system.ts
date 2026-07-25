import { app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'

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

export async function getRecentProjects(): Promise<Array<{ path: string; name: string; lastOpened: number; thumbnailPath: string }>> {
  const recentPath = getRecentPath()
  if (!existsSync(recentPath)) return []
  const data = await readFile(recentPath, 'utf-8')
  return JSON.parse(data)
}

export async function addRecentProject(entry: { path: string; name: string; lastOpened: number; thumbnailPath: string }): Promise<void> {
  const recent = await getRecentProjects()
  const filtered = recent.filter((r) => r.path !== entry.path)
  filtered.unshift(entry)
  const trimmed = filtered.slice(0, 20)
  await writeFile(getRecentPath(), JSON.stringify(trimmed, null, 2), 'utf-8')
}
