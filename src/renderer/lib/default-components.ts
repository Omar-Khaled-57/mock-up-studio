/**
 * default-components — Pre-built themed unit definitions shipped with the app.
 *
 * Three themed groups inspired by real projects:
 *   - **Redora**: Hover Agency — bold red, dark surfaces, Cairo/Montserrat.
 *   - **Qless**: BoardFlow — indigo-purple, glass effects, Poppins.
 *   - **CatarinaUI**: Catarina + Hodor — neon teal, dark surfaces, Inter.
 *
 * Every definition is static (one visual state, no interactivity) and uses only
 * text and shape data (no bitmap assets).  Groups use ComponentGroupData to
 * combine shapes + text into composite units like buttons and badges.
 *
 * IMPORTANT: shape opacity and shadow/glow opacity are on a 0–100 scale
 * (divided by 100 at render time).  Use integer values like 15, 30, 100 — NOT
 * fractional values like 0.15, 0.3, 1.
 */

import type { ComponentDefinition, ComponentGroup, ComponentData } from '@shared/types'

// ---------------------------------------------------------------------------
// Theme palettes — extracted from real design systems.
// ---------------------------------------------------------------------------

/** Redora (Hover Agency): bold red accent, dark surfaces, Cairo + Montserrat. */
const R = {
  primary: '#CC0000',
  primaryDark: '#990000',
  primaryLight: '#E60000',
  bg: '#050505',
  surface: '#0f0f0f',
  surface2: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: '#a3a3a3',
  success: '#86efac',
  successDark: '#166534',
  warning: '#fde047',
  warningDark: '#854d0e',
  glow: 'rgba(230,0,0,0.25)',
  fontPrimary: 'Cairo',
  fontSecondary: 'Montserrat',
} as const

/** Qless (BoardFlow): indigo-purple, glass effects, Poppins. */
const Q = {
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  primaryLight: '#a855f7',
  bg: '#030014',
  surface: '#0a0a1a',
  surfaceGlass: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  textMuted: '#94a3b8',
  success: '#22c55e',
  successDark: '#166534',
  info: '#818cf8',
  infoBg: 'rgba(99,102,241,0.15)',
  infoText: '#c4b5fd',
  glow: 'rgba(99,102,241,0.3)',
  fontPrimary: 'Poppins',
} as const

/** CatarinaUI (Catarina + Hodor): neon teal accent, dark surfaces, Inter. */
const CU = {
  primary: '#00E8A2',
  primaryDark: '#00C47A',
  primaryLight: '#00C87A',
  bg: '#060B14',
  surface: '#0D1824',
  surface2: '#142035',
  border: 'rgba(0,232,162,0.15)',
  text: '#F0F6FF',
  textMuted: '#5A7A99',
  danger: '#FF4D6A',
  dangerBg: 'rgba(255,77,106,0.15)',
  present: 'rgba(0,232,162,0.15)',
  glow: 'rgba(0,232,162,0.25)',
  fontPrimary: 'Inter',
} as const

// ---------------------------------------------------------------------------
// Group IDs — stable across sessions so definitions reference them reliably.
// ---------------------------------------------------------------------------

export const DEFAULT_GROUP_REDORA = 'default-group-redora'
export const DEFAULT_GROUP_QLESS = 'default-group-qless'
export const DEFAULT_GROUP_CATARINA = 'default-group-catarina'

export const DEFAULT_GROUPS: ComponentGroup[] = [
  { id: DEFAULT_GROUP_REDORA, name: 'Redora', isDefault: true, createdAt: 0 },
  { id: DEFAULT_GROUP_QLESS, name: 'Qless', isDefault: true, createdAt: 0 },
  { id: DEFAULT_GROUP_CATARINA, name: 'CatarinaUI', isDefault: true, createdAt: 0 },
]

// ---------------------------------------------------------------------------
// Helpers — concrete builders that cast to ComponentData at the return site.
// ---------------------------------------------------------------------------

function makeShape(o: {
  shapeKind: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'hexagon' | 'diamond' | 'parallelogram' | 'trapezoid' | 'cross' | 'plus' | 'heart' | 'arrow-right'
  width: number
  height: number
  color: string
  cornerRadius?: number
  gradient?: { enabled: boolean; colors: string[]; angle: number; type?: 'linear' | 'radial' | 'conic'; radialShape?: 'circle' | 'ellipse' }
  opacity?: number
  shadow?: { enabled: boolean; color: string; offsetX: number; offsetY: number; blur: number; spread: number; opacity: number; inset: boolean }[]
  glow?: { enabled: boolean; color: string; blur: number; spread: number; opacity: number }[]
  x?: number
  y?: number
}): ComponentData {
  return {
    kind: 'shape',
    shapeKind: o.shapeKind,
    width: o.width,
    height: o.height,
    color: o.color,
    cornerRadius: o.cornerRadius ?? 0,
    angles: [0, 0, 0],
    crossThickness: 0.3,
    plusThickness: 0.3,
    arrowThickness: 0.3,
    opacity: o.opacity ?? 100,
    backgroundImage: null,
    blur: 0,
    glow: o.glow ?? [],
    shadow: o.shadow ?? [],
    gradient: o.gradient ?? null,
    x: o.x,
    y: o.y
  } as ComponentData
}

function makeText(o: {
  content: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  width: number
  height: number
  backgroundVisible?: boolean
  backgroundColor?: string
  borderRadius?: number
  strokeColor?: string
  strokeWidth?: number
  x?: number
  y?: number
}): ComponentData {
  return {
    kind: 'text',
    content: o.content,
    fontFamily: o.fontFamily ?? 'Inter',
    fontSize: o.fontSize ?? 14,
    fontWeight: o.fontWeight ?? 600,
    color: o.color ?? '#ffffff',
    textAlign: o.textAlign ?? 'center',
    lineHeight: o.lineHeight ?? 1,
    letterSpacing: o.letterSpacing ?? 0,
    wordSpacing: 0,
    textTransform: o.textTransform ?? 'none',
    wrap: true,
    heightAuto: false,
    shadow: null,
    glow: null,
    strokeColor: o.strokeColor ?? '#ffffff',
    strokeWidth: o.strokeWidth ?? 0,
    gradient: null,
    backgroundVisible: o.backgroundVisible ?? false,
    backgroundColor: o.backgroundColor ?? 'transparent',
    borderRadius: o.borderRadius ?? 0,
    border: 'none',
    width: o.width,
    height: o.height,
    x: o.x,
    y: o.y
  } as ComponentData
}

function makeGroup(children: ComponentData[], width: number, height: number): ComponentData {
  return { kind: 'group', children, width, height } as ComponentData
}

// ---------------------------------------------------------------------------
// Thumbnail generator — produces inline SVG data URIs for the panel grid.
// Normalizes to a square viewBox so thumbnails fill their aspect-square cells.
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function shapeToSvg(d: ComponentData, ox: number, oy: number, w: number, h: number): string {
  if (d.kind === 'shape') {
    const r = d.cornerRadius
    const fill = d.gradient?.enabled
      ? `<defs><linearGradient id="g${ox}${oy}" gradientTransform="rotate(${d.gradient.angle},0.5,0.5)"><stop offset="0%" stop-color="${d.gradient.colors[0] ?? '#6366f1'}"/><stop offset="100%" stop-color="${d.gradient.colors[1] ?? '#a855f7'}"/></linearGradient></defs>`
      : ''
    const fillAttr = d.gradient?.enabled ? `url(#g${ox}${oy})` : d.color
    const opacity = d.opacity < 100 ? ` opacity="${d.opacity / 100}"` : ''
    if (d.shapeKind === 'rectangle' || d.shapeKind === 'trapezoid') {
      return `${fill}<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="${r}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'circle' || d.shapeKind === 'ellipse') {
      return `${fill}<ellipse cx="${ox + w / 2}" cy="${oy + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'triangle') {
      return `${fill}<polygon points="${ox + w / 2},${oy} ${ox + w},${oy + h} ${ox},${oy + h}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'star') {
      const pts: string[] = []
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 2) + (i * Math.PI / 5)
        const rad = i % 2 === 0 ? 1 : 0.45
        pts.push(`${ox + w / 2 + Math.cos(angle) * w / 2 * rad},${oy + h / 2 - Math.sin(angle) * h / 2 * rad}`)
      }
      return `${fill}<polygon points="${pts.join(' ')}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'hexagon') {
      const pts: string[] = []
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 6) + (i * Math.PI / 3)
        pts.push(`${ox + w / 2 + Math.cos(angle) * w / 2},${oy + h / 2 - Math.sin(angle) * h / 2}`)
      }
      return `${fill}<polygon points="${pts.join(' ')}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'diamond') {
      return `${fill}<polygon points="${ox + w / 2},${oy} ${ox + w},${oy + h / 2} ${ox + w / 2},${oy + h} ${ox},${oy + h / 2}" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'heart') {
      const hw = w / 2
      return `${fill}<path d="M${ox + hw},${oy + h * 0.8}C${ox + hw * 0.3},${oy + h * 0.55} ${ox},${oy + h * 0.25} ${ox + hw * 0.15},${oy + h * 0.1}A${hw * 0.6},${h / 2 * 0.6} 0 0 1 ${ox + hw},${oy + h * 0.3}A${hw * 0.6},${h / 2 * 0.6} 0 0 1 ${ox + hw * 1.85},${oy + h * 0.1}C${ox + w},${oy + h * 0.25} ${ox + hw * 1.7},${oy + h * 0.55} ${ox + hw},${oy + h * 0.8}Z" fill="${fillAttr}"${opacity}/>`
    }
    if (d.shapeKind === 'plus') {
      const t = 0.3
      const tw = w * t, th = h * t
      return `${fill}<rect x="${ox}" y="${oy + h / 2 - th / 2}" width="${w}" height="${th}" rx="${Math.min(tw, th) / 2}" fill="${fillAttr}"${opacity}/><rect x="${ox + w / 2 - tw / 2}" y="${oy}" width="${tw}" height="${h}" rx="${Math.min(tw, th) / 2}" fill="${fillAttr}"${opacity}/>`
    }
    return `${fill}<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="${r}" fill="${fillAttr}"${opacity}/>`
  }
  return ''
}

export function textToSvg(d: ComponentData, ox: number, oy: number, w: number, h: number): string {
  if (d.kind === 'text') {
    const fs = Math.min(d.fontSize, h * 0.8)
    const anchor = d.textAlign === 'left' ? 'start' : d.textAlign === 'right' ? 'end' : 'middle'
    const tx = d.textAlign === 'left' ? ox + 4 : d.textAlign === 'right' ? ox + w - 4 : ox + w / 2
    const bg = d.backgroundVisible ? `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="${d.borderRadius}" fill="${d.backgroundColor}"/>` : ''
    const stroke = d.strokeWidth > 0 ? ` paint-order="stroke" stroke="${d.strokeColor}" stroke-width="${d.strokeWidth}"` : ''
    return `${bg}<text x="${tx}" y="${oy + h / 2}" font-size="${fs}" font-weight="${d.fontWeight}" fill="${d.color}" text-anchor="${anchor}" dominant-baseline="central" font-family="${esc(d.fontFamily)}"${stroke}>${esc(d.content)}</text>`
  }
  return ''
}

export function renderThumbnail(def: ComponentDefinition): string {
  const pad = 6
  const bgId = `bg${def.id.replace(/[^a-zA-Z0-9]/g, '')}`
  const bg = `<defs><linearGradient id="${bgId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#030014"/><stop offset="100%" stop-color="#0a0a1a"/></linearGradient></defs>`

  let contentW = 100
  let contentH = 100
  const renderParts: string[] = []

  if (def.data.kind === 'group') {
    const gd = def.data
    contentW = gd.width
    contentH = gd.height
    let zIdx = 0
    for (const child of gd.children) {
      const cw = (child as unknown as { width: number }).width ?? 100
      const ch = (child as unknown as { height: number }).height ?? 100
      const cx = (child as unknown as { x?: number }).x ?? (gd.width - cw) / 2
      const cy = (child as unknown as { y?: number }).y ?? (gd.height - ch) / 2
      renderParts.push(`<g z-index="${zIdx}">`)
      if (child.kind === 'shape') renderParts.push(shapeToSvg(child, cx, cy, cw, ch))
      else if (child.kind === 'text') renderParts.push(textToSvg(child, cx, cy, cw, ch))
      renderParts.push('</g>')
      zIdx++
    }
  } else {
    const d = def.data
    contentW = (d as unknown as { width: number }).width ?? 100
    contentH = (d as unknown as { height: number }).height ?? 100
    if (d.kind === 'shape') renderParts.push(shapeToSvg(d, 0, 0, contentW, contentH))
    else if (d.kind === 'text') renderParts.push(textToSvg(d, 0, 0, contentW, contentH))
    else if (d.kind === 'image' || d.kind === 'brush') renderParts.push(`<rect x="0" y="0" width="${contentW}" height="${contentH}" rx="4" fill="#1a1a2e" opacity="0.5"/><text x="${contentW / 2}" y="${contentH / 2}" text-anchor="middle" dominant-baseline="central" fill="#64748b" font-size="14">img</text>`)
  }

  const size = Math.max(contentW, contentH) + pad * 2
  const ox = (size - contentW) / 2
  const oy = (size - contentH) / 2
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${bg}<rect width="${size}" height="${size}" rx="6" fill="url(#${bgId})"/><g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)})">${renderParts.join('')}</g></svg>`)}`
}

function makeDef(id: string, name: string, groupId: string, data: ComponentData, typeTag?: string): ComponentDefinition {
  return {
    id,
    name,
    groupId,
    kind: (data as { kind: string }).kind as ComponentDefinition['kind'],
    thumbnail: renderThumbnail({ id, name, groupId, kind: (data as { kind: string }).kind as ComponentDefinition['kind'], thumbnail: '', createdAt: 0, updatedAt: 0, data }),
    createdAt: 0,
    updatedAt: 0,
    typeTag,
    data
  }
}

// ---------------------------------------------------------------------------
// SVG renderer for placed group units — vector, never pixelates on resize.
// ---------------------------------------------------------------------------

export function renderGroupToSvg(children: ComponentData[], width: number, height: number): string {
  const parts: string[] = []
  let z = 0
  for (const child of children) {
    const cw = (child as unknown as { width: number }).width ?? 100
    const ch = (child as unknown as { height: number }).height ?? 100
    const cx = (child as unknown as { x?: number }).x ?? (width - cw) / 2
    const cy = (child as unknown as { y?: number }).y ?? (height - ch) / 2
    parts.push(`<g z-index="${z}">`)
    if (child.kind === 'shape') parts.push(shapeToSvg(child, cx, cy, cw, ch))
    else if (child.kind === 'text') parts.push(textToSvg(child, cx, cy, cw, ch))
    parts.push('</g>')
    z++
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// ---------------------------------------------------------------------------
// Shorthand constants
// ---------------------------------------------------------------------------

const SH = (color: string, ox: number, oy: number, blur: number, opacity: number) =>
  ({ enabled: true, color, offsetX: ox, offsetY: oy, blur, spread: 0, opacity, inset: false })

const GL = (color: string, blur: number, spread: number, opacity: number) =>
  ({ enabled: true, color, blur, spread, opacity })

// ---------------------------------------------------------------------------
// Shared dimensions
// ---------------------------------------------------------------------------

const BTN_W = 160
const BTN_H = 44
const BADGE_H = 28
const INPUT_W = 280
const INPUT_H = 40
const CARD_W = 320
const CARD_H = 200
const NAV_W = 400
const NAV_H = 56
const ALERT_W = 340
const ALERT_H = 44
const PROGRESS_W = 280
const PROGRESS_H = 8

// ---------------------------------------------------------------------------
// Definitions — 3 themed groups x 12 units each = 36 total
// ---------------------------------------------------------------------------

export const DEFAULT_DEFINITIONS: ComponentDefinition[] = [

  // ========================================================================
  // REDORA — Hover Agency: bold red, dark surfaces, Cairo + Montserrat
  // ========================================================================

  // --- BUTTONS (centered overlay layout — bg shape + label) ---

  makeDef('def-redora-btn-primary', 'Primary', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: R.primary, cornerRadius: 8, shadow: [SH('#000000', 0, 6, 20, 45), SH(R.primary, 0, 2, 8, 35)] }),
      makeText({ content: 'Get Started', width: BTN_W, height: BTN_H, fontFamily: R.fontSecondary, fontWeight: 700, fontSize: 14 })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-redora-btn-ghost', 'Ghost', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: R.primary, cornerRadius: 8 }),
      makeShape({ shapeKind: 'rectangle', width: BTN_W - 2, height: BTN_H - 2, color: R.bg, cornerRadius: 7 }),
      makeText({ content: 'Learn More', width: BTN_W, height: BTN_H, fontFamily: R.fontSecondary, fontWeight: 700, fontSize: 14, color: R.primary })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-redora-btn-gradient', 'Gradient', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: R.primaryDark, cornerRadius: 8, gradient: { enabled: true, colors: [R.primaryDark, R.primaryLight], angle: 135 }, shadow: [SH('#000000', 0, 6, 20, 45), SH(R.primary, 0, 2, 8, 35)] }),
      makeText({ content: 'Sign Up', width: BTN_W, height: BTN_H, fontFamily: R.fontSecondary, fontWeight: 700, fontSize: 14 })
    ], BTN_W, BTN_H),
      'Button'
  ),

  // --- BADGES (inline layout: dot + text) ---

  makeDef('def-redora-badge-success', 'Success', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: R.successDark, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: R.success, x: 10, y: 10 }),
      makeText({ content: 'Active', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: R.fontSecondary, fontSize: 11, fontWeight: 700, color: R.success, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  makeDef('def-redora-badge-warning', 'Warning', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: R.warningDark, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: R.warning, x: 10, y: 10 }),
      makeText({ content: 'Pending', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: R.fontSecondary, fontSize: 11, fontWeight: 700, color: R.warning, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  // --- CARDS (vertical layout: bg + accent bar + title at (24,20) + desc at (24,56)) ---

  makeDef('def-redora-card-solid', 'Solid Card', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: R.surface, cornerRadius: 12, shadow: [SH('#000000', 0, 8, 24, 60), SH('#000000', 0, 2, 6, 30)] }),
      makeText({ content: 'Solid Card', width: CARD_W - 48, height: 28, x: 24, y: 20, fontFamily: R.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left' }),
      makeText({ content: 'A clean dark card with deep shadow', width: CARD_W - 48, height: 20, x: 24, y: 56, fontSize: 13, fontWeight: 400, color: R.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  makeDef('def-redora-card-featured', 'Featured Card', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: R.bg, cornerRadius: 12, glow: [GL(R.glow, 24, 0, 30)] }),
      makeShape({ shapeKind: 'rectangle', width: 48, height: 4, color: R.primary, cornerRadius: 2, x: 24, y: 22 }),
      makeText({ content: 'Featured', width: CARD_W - 48, height: 28, x: 24, y: 32, fontFamily: R.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left', color: R.primary }),
      makeText({ content: 'Highlighted content with a red accent', width: CARD_W - 48, height: 20, x: 24, y: 68, fontSize: 13, fontWeight: 400, color: R.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  // --- LABELS (standalone) ---

  makeDef('def-redora-label-heading', 'Heading', DEFAULT_GROUP_REDORA,
    makeText({ content: 'Section Title', fontFamily: R.fontPrimary, fontSize: 28, fontWeight: 800, color: R.text, textAlign: 'left', width: 280, height: 36 }),
    'Heading'
  ),

  // --- INPUTS (centered overlay layout) ---

  makeDef('def-redora-input-text', 'Text Input', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: INPUT_W, height: INPUT_H, color: R.border, cornerRadius: 8 }),
      makeShape({ shapeKind: 'rectangle', width: INPUT_W - 2, height: INPUT_H - 2, color: R.surface, cornerRadius: 7 }),
      makeText({ content: 'Enter your name...', width: INPUT_W - 24, height: INPUT_H, fontFamily: R.fontSecondary, fontSize: 14, fontWeight: 400, color: '#64748b', textAlign: 'left' })
    ], INPUT_W, INPUT_H),
      'Input'
  ),

  // --- NAVBARS (horizontal layout: logo at left, items spread right) ---

  makeDef('def-redora-nav-basic', 'Dark Navbar', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: NAV_W, height: NAV_H, color: R.bg, shadow: [SH('#000000', 0, 2, 10, 40)] }),
      makeText({ content: 'Hover', width: 80, height: NAV_H, x: 20, y: 0, fontFamily: R.fontPrimary, fontSize: 18, fontWeight: 800, color: R.text, textAlign: 'left' }),
      makeText({ content: 'Home', width: 52, height: NAV_H, x: 200, y: 0, fontFamily: R.fontSecondary, fontSize: 14, fontWeight: 500, color: R.textMuted, textAlign: 'left' }),
      makeText({ content: 'About', width: 52, height: NAV_H, x: 264, y: 0, fontFamily: R.fontSecondary, fontSize: 14, fontWeight: 500, color: R.textMuted, textAlign: 'left' }),
      makeText({ content: 'Pricing', width: 56, height: NAV_H, x: 330, y: 0, fontFamily: R.fontSecondary, fontSize: 14, fontWeight: 500, color: R.textMuted, textAlign: 'left' })
    ], NAV_W, NAV_H),
      'Navbar'
  ),

  // --- PROGRESS (centered overlay layout) ---

  makeDef('def-redora-progress-linear', 'Linear', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: PROGRESS_W, height: PROGRESS_H, color: R.surface2, cornerRadius: 4 }),
      makeShape({ shapeKind: 'rectangle', width: 196, height: PROGRESS_H, color: R.primary, cornerRadius: 4 })
    ], PROGRESS_W, PROGRESS_H),
      'Progress'
  ),

  // --- ALERTS (inline layout: dot at left, text beside it) ---

  makeDef('def-redora-alert-info', 'Info Alert', DEFAULT_GROUP_REDORA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: ALERT_W, height: ALERT_H, color: R.surface2, cornerRadius: 8 }),
      makeShape({ shapeKind: 'circle', width: 10, height: 10, color: R.primary, x: 14, y: 17 }),
      makeText({ content: 'This is an informational message', width: ALERT_W - 50, height: ALERT_H, x: 36, y: 0, fontFamily: R.fontSecondary, fontSize: 13, fontWeight: 500, color: R.text, textAlign: 'left' })
    ], ALERT_W, ALERT_H),
      'Alert'
  ),

  // ========================================================================
  // QLESS — BoardFlow: indigo-purple, glass effects, Poppins
  // ========================================================================

  // --- BUTTONS ---

  makeDef('def-qless-btn-primary', 'Primary', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: Q.primary, cornerRadius: 12, gradient: { enabled: true, colors: [Q.primary, Q.primaryLight], angle: 135 }, shadow: [SH('#000000', 0, 6, 20, 45), SH(Q.primary, 0, 2, 8, 35)] }),
      makeText({ content: 'Get Started', width: BTN_W, height: BTN_H, fontFamily: Q.fontPrimary, fontWeight: 700, fontSize: 14 })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-qless-btn-glass', 'Glass', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: Q.border, cornerRadius: 12 }),
      makeShape({ shapeKind: 'rectangle', width: BTN_W - 2, height: BTN_H - 2, color: Q.surfaceGlass, cornerRadius: 11 }),
      makeText({ content: 'Learn More', width: BTN_W, height: BTN_H, fontFamily: Q.fontPrimary, fontWeight: 700, fontSize: 14 })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-qless-btn-gradient', 'Gradient', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: Q.primaryDark, cornerRadius: 12, gradient: { enabled: true, colors: ['#4f52c9', '#8644c5'], angle: 135 }, shadow: [SH('#000000', 0, 6, 20, 45), SH(Q.primaryLight, 0, 2, 8, 35)] }),
      makeText({ content: 'Sign Up', width: BTN_W, height: BTN_H, fontFamily: Q.fontPrimary, fontWeight: 700, fontSize: 14 })
    ], BTN_W, BTN_H),
      'Button'
  ),

  // --- BADGES (inline layout) ---

  makeDef('def-qless-badge-status', 'Status', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: Q.successDark, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: Q.success, x: 10, y: 10 }),
      makeText({ content: 'Online', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: Q.fontPrimary, fontSize: 11, fontWeight: 700, color: Q.success, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  makeDef('def-qless-badge-info', 'Info', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: Q.infoBg, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: Q.info, x: 10, y: 10 }),
      makeText({ content: 'New', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: Q.fontPrimary, fontSize: 11, fontWeight: 700, color: Q.info, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  // --- CARDS (vertical layout) ---

  makeDef('def-qless-card-glass', 'Glass Card', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: Q.border, cornerRadius: 16 }),
      makeShape({ shapeKind: 'rectangle', width: CARD_W - 2, height: CARD_H - 2, color: Q.surfaceGlass, cornerRadius: 15 }),
      makeText({ content: 'Glass Card', width: CARD_W - 48, height: 28, x: 24, y: 20, fontFamily: Q.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left' }),
      makeText({ content: 'Frosted glass with subtle border', width: CARD_W - 48, height: 20, x: 24, y: 56, fontSize: 13, fontWeight: 400, color: Q.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  makeDef('def-qless-card-gradient', 'Gradient Ring', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: Q.primaryDark, cornerRadius: 16, glow: [GL(Q.glow, 28, 0, 35)] }),
      makeShape({ shapeKind: 'rectangle', width: CARD_W - 4, height: CARD_H - 4, color: Q.bg, cornerRadius: 14 }),
      makeText({ content: 'Gradient Ring', width: CARD_W - 48, height: 28, x: 24, y: 20, fontFamily: Q.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left' }),
      makeText({ content: 'Indigo glow ring on dark inner', width: CARD_W - 48, height: 20, x: 24, y: 56, fontSize: 13, fontWeight: 400, color: Q.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  // --- LABELS ---

  makeDef('def-qless-label-heading', 'Heading', DEFAULT_GROUP_QLESS,
    makeText({ content: 'Section Title', fontFamily: Q.fontPrimary, fontSize: 28, fontWeight: 800, color: Q.text, textAlign: 'left', width: 280, height: 36 }),
    'Heading'
  ),

  // --- INPUTS ---

  makeDef('def-qless-input-text', 'Glass Input', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: INPUT_W, height: INPUT_H, color: Q.border, cornerRadius: 12 }),
      makeShape({ shapeKind: 'rectangle', width: INPUT_W - 2, height: INPUT_H - 2, color: Q.surface, cornerRadius: 11 }),
      makeText({ content: 'Search...', width: INPUT_W - 24, height: INPUT_H, fontFamily: Q.fontPrimary, fontSize: 14, fontWeight: 400, color: Q.textMuted, textAlign: 'left' })
    ], INPUT_W, INPUT_H),
      'Input'
  ),

  // --- NAVBARS (horizontal layout) ---

  makeDef('def-qless-nav-basic', 'Glass Navbar', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: NAV_W, height: NAV_H, color: Q.bg, opacity: 50, shadow: [SH('#000000', 0, 2, 10, 30)] }),
      makeText({ content: 'Qless', width: 80, height: NAV_H, x: 20, y: 0, fontFamily: Q.fontPrimary, fontSize: 18, fontWeight: 800, color: Q.text, textAlign: 'left' }),
      makeText({ content: 'Home', width: 52, height: NAV_H, x: 200, y: 0, fontFamily: Q.fontPrimary, fontSize: 14, fontWeight: 500, color: Q.textMuted, textAlign: 'left' }),
      makeText({ content: 'Boards', width: 60, height: NAV_H, x: 264, y: 0, fontFamily: Q.fontPrimary, fontSize: 14, fontWeight: 500, color: Q.textMuted, textAlign: 'left' }),
      makeText({ content: 'Pricing', width: 56, height: NAV_H, x: 332, y: 0, fontFamily: Q.fontPrimary, fontSize: 14, fontWeight: 500, color: Q.textMuted, textAlign: 'left' })
    ], NAV_W, NAV_H),
      'Navbar'
  ),

  // --- PROGRESS ---

  makeDef('def-qless-progress-linear', 'Gradient', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: PROGRESS_W, height: PROGRESS_H, color: Q.surfaceGlass, cornerRadius: 4 }),
      makeShape({ shapeKind: 'rectangle', width: 196, height: PROGRESS_H, color: Q.primary, cornerRadius: 4, gradient: { enabled: true, colors: [Q.primary, Q.primaryLight], angle: 90 } })
    ], PROGRESS_W, PROGRESS_H),
      'Progress'
  ),

  // --- ALERTS (inline layout) ---

  makeDef('def-qless-alert-info', 'Info Alert', DEFAULT_GROUP_QLESS,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: ALERT_W, height: ALERT_H, color: Q.infoBg, cornerRadius: 12 }),
      makeShape({ shapeKind: 'circle', width: 10, height: 10, color: Q.info, x: 14, y: 17 }),
      makeText({ content: 'This is an informational message', width: ALERT_W - 50, height: ALERT_H, x: 36, y: 0, fontFamily: Q.fontPrimary, fontSize: 13, fontWeight: 500, color: Q.infoText, textAlign: 'left' })
    ], ALERT_W, ALERT_H),
      'Alert'
  ),

  // ========================================================================
  // CATARINAUI — Catarina + Hodor: neon teal, dark surfaces, Inter
  // ========================================================================

  // --- BUTTONS ---

  makeDef('def-catarina-btn-primary', 'Primary', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: CU.primary, cornerRadius: 12, shadow: [SH('#000000', 0, 6, 20, 45), SH(CU.primary, 0, 2, 8, 35)] }),
      makeText({ content: 'Get Started', width: BTN_W, height: BTN_H, fontFamily: CU.fontPrimary, fontWeight: 700, fontSize: 14, color: CU.bg })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-catarina-btn-ghost', 'Ghost', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: CU.border, cornerRadius: 12 }),
      makeShape({ shapeKind: 'rectangle', width: BTN_W - 2, height: BTN_H - 2, color: CU.bg, cornerRadius: 11 }),
      makeText({ content: 'Learn More', width: BTN_W, height: BTN_H, fontFamily: CU.fontPrimary, fontWeight: 700, fontSize: 14, color: CU.primary })
    ], BTN_W, BTN_H),
      'Button'
  ),

  makeDef('def-catarina-btn-gradient', 'Gradient', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: BTN_W, height: BTN_H, color: CU.primaryDark, cornerRadius: 12, gradient: { enabled: true, colors: [CU.primary, CU.primaryLight], angle: 135 }, shadow: [SH('#000000', 0, 6, 20, 45), SH(CU.primary, 0, 2, 8, 35)] }),
      makeText({ content: 'Sign Up', width: BTN_W, height: BTN_H, fontFamily: CU.fontPrimary, fontWeight: 700, fontSize: 14, color: CU.bg })
    ], BTN_W, BTN_H),
      'Button'
  ),

  // --- BADGES (inline layout) ---

  makeDef('def-catarina-badge-present', 'Present', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: CU.present, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: CU.primary, x: 10, y: 10 }),
      makeText({ content: 'Present', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: CU.fontPrimary, fontSize: 11, fontWeight: 700, color: CU.primary, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  makeDef('def-catarina-badge-absent', 'Absent', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: 88, height: BADGE_H, color: CU.dangerBg, cornerRadius: 14 }),
      makeShape({ shapeKind: 'circle', width: 8, height: 8, color: CU.danger, x: 10, y: 10 }),
      makeText({ content: 'Absent', width: 58, height: BADGE_H, x: 24, y: 0, fontFamily: CU.fontPrimary, fontSize: 11, fontWeight: 700, color: CU.danger, textTransform: 'uppercase', letterSpacing: 0.5 })
    ], 88, BADGE_H),
      'Badge'
  ),

  // --- CARDS (vertical layout) ---

  makeDef('def-catarina-card-glass', 'Glass Card', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: CU.border, cornerRadius: 12 }),
      makeShape({ shapeKind: 'rectangle', width: CARD_W - 2, height: CARD_H - 2, color: CU.surface, cornerRadius: 11 }),
      makeText({ content: 'Glass Card', width: CARD_W - 48, height: 28, x: 24, y: 20, fontFamily: CU.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left' }),
      makeText({ content: 'Dark glass with teal border', width: CARD_W - 48, height: 20, x: 24, y: 56, fontSize: 13, fontWeight: 400, color: CU.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  makeDef('def-catarina-card-stat', 'Stat Card', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: CARD_W, height: CARD_H, color: CU.surface, cornerRadius: 12, glow: [GL(CU.glow, 24, 0, 30)] }),
      makeShape({ shapeKind: 'rectangle', width: 48, height: 4, color: CU.primary, cornerRadius: 2, x: 24, y: 22 }),
      makeText({ content: 'Statistics', width: CARD_W - 48, height: 28, x: 24, y: 32, fontFamily: CU.fontPrimary, fontWeight: 700, fontSize: 18, textAlign: 'left', color: CU.primary }),
      makeText({ content: 'Metric overview with teal accent', width: CARD_W - 48, height: 20, x: 24, y: 68, fontSize: 13, fontWeight: 400, color: CU.textMuted, textAlign: 'left' })
    ], CARD_W, CARD_H),
      'Card'
  ),

  // --- LABELS ---

  makeDef('def-catarina-label-heading', 'Heading', DEFAULT_GROUP_CATARINA,
    makeText({ content: 'Section Title', fontFamily: CU.fontPrimary, fontSize: 28, fontWeight: 800, color: CU.text, textAlign: 'left', width: 280, height: 36 }),
    'Heading'
  ),

  // --- INPUTS ---

  makeDef('def-catarina-input-text', 'Text Input', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: INPUT_W, height: INPUT_H, color: CU.border, cornerRadius: 12 }),
      makeShape({ shapeKind: 'rectangle', width: INPUT_W - 2, height: INPUT_H - 2, color: CU.surface, cornerRadius: 11 }),
      makeText({ content: 'Enter your name...', width: INPUT_W - 24, height: INPUT_H, fontFamily: CU.fontPrimary, fontSize: 14, fontWeight: 400, color: CU.textMuted, textAlign: 'left' })
    ], INPUT_W, INPUT_H),
      'Input'
  ),

  // --- NAVBARS (horizontal layout) ---

  makeDef('def-catarina-nav-basic', 'Dark Navbar', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: NAV_W, height: NAV_H, color: CU.bg, shadow: [SH('#000000', 0, 2, 10, 40)] }),
      makeText({ content: 'Catarina', width: 90, height: NAV_H, x: 20, y: 0, fontFamily: CU.fontPrimary, fontSize: 18, fontWeight: 800, color: CU.text, textAlign: 'left' }),
      makeText({ content: 'Home', width: 52, height: NAV_H, x: 200, y: 0, fontFamily: CU.fontPrimary, fontSize: 14, fontWeight: 500, color: CU.textMuted, textAlign: 'left' }),
      makeText({ content: 'Projects', width: 64, height: NAV_H, x: 264, y: 0, fontFamily: CU.fontPrimary, fontSize: 14, fontWeight: 500, color: CU.textMuted, textAlign: 'left' }),
      makeText({ content: 'Pricing', width: 56, height: NAV_H, x: 336, y: 0, fontFamily: CU.fontPrimary, fontSize: 14, fontWeight: 500, color: CU.textMuted, textAlign: 'left' })
    ], NAV_W, NAV_H),
      'Navbar'
  ),

  // --- PROGRESS ---

  makeDef('def-catarina-progress-linear', 'Linear', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: PROGRESS_W, height: PROGRESS_H, color: CU.surface2, cornerRadius: 4 }),
      makeShape({ shapeKind: 'rectangle', width: 196, height: PROGRESS_H, color: CU.primary, cornerRadius: 4, gradient: { enabled: true, colors: [CU.primary, CU.primaryLight], angle: 90 } })
    ], PROGRESS_W, PROGRESS_H),
      'Progress'
  ),

  // --- ALERTS (inline layout) ---

  makeDef('def-catarina-alert-info', 'Info Alert', DEFAULT_GROUP_CATARINA,
    makeGroup([
      makeShape({ shapeKind: 'rectangle', width: ALERT_W, height: ALERT_H, color: CU.present, cornerRadius: 12 }),
      makeShape({ shapeKind: 'circle', width: 10, height: 10, color: CU.primary, x: 14, y: 17 }),
      makeText({ content: 'This is an informational message', width: ALERT_W - 50, height: ALERT_H, x: 36, y: 0, fontFamily: CU.fontPrimary, fontSize: 13, fontWeight: 500, color: CU.text, textAlign: 'left' })
    ], ALERT_W, ALERT_H),
      'Alert'
  ),

]
