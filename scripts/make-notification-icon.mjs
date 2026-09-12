#!/usr/bin/env node
/**
 * Regenerates the notification_icon.png in every
 * android/app/src/main/res/drawable-<density> folder from assets/icon.png.
 *
 * Android status-bar icons are masks, not pictures: the OS throws away every
 * colour channel and paints the alpha channel with the tint from
 * `notification_icon_color`. So the amber square in assets/icon.png cannot be
 * copied across as-is — a fully opaque square renders as a solid amber blob.
 * The alarm-clock glyph is what has to survive, so the source's white pixels
 * become opaque white here and the amber ground becomes transparent.
 *
 * The glyph is also inset to ~78% of the canvas: the platform draws these at
 * 24dp with no padding of its own, and a glyph that runs to the edge reads as
 * clipped next to other apps' icons.
 *
 * Run from suhoor-native/:  node scripts/make-notification-icon.mjs
 * pngjs comes from the repo root's node_modules (no dependency added here).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')

const SOURCE = join(appRoot, 'assets', 'icon.png')
const RES = join(appRoot, 'android', 'app', 'src', 'main', 'res')

/** mdpi is the 24dp baseline; the rest are the standard density multipliers. */
const DENSITIES = [
  ['drawable-mdpi', 24],
  ['drawable-hdpi', 36],
  ['drawable-xhdpi', 48],
  ['drawable-xxhdpi', 72],
  ['drawable-xxxhdpi', 96],
]

/** Fraction of the output edge the glyph's bounding box is allowed to fill. */
const GLYPH_SCALE = 0.78

const source = PNG.sync.read(readFileSync(SOURCE))

/**
 * Coverage map: how much of each source pixel is glyph rather than ground.
 *
 * The source is a flat amber field with a white glyph on it, so lightness
 * separates the two cleanly. Using a ramp rather than a hard threshold keeps
 * the glyph's antialiased edges smooth once it is scaled down to 24dp.
 */
const coverage = new Float32Array(source.width * source.height)
for (let index = 0; index < coverage.length; index += 1) {
  const offset = index * 4
  const [r, g, b, a] = [
    source.data[offset],
    source.data[offset + 1],
    source.data[offset + 2],
    source.data[offset + 3],
  ]
  // A transparent source pixel is ground, whatever colour it claims to be.
  if (a < 8) continue
  const min = Math.min(r, g, b)
  const max = Math.max(r, g, b)
  // White is bright AND unsaturated; the amber is bright but very saturated.
  const saturation = max === 0 ? 0 : (max - min) / max
  const whiteness = (min / 255) * (1 - Math.min(1, saturation * 2.5))
  const ramped = (whiteness - 0.55) / 0.3
  coverage[index] = Math.max(0, Math.min(1, ramped)) * (a / 255)
}

// Glyph bounding box, so the icon is centred on the drawing rather than on the
// source canvas (which is not square and has uneven margins).
let minX = source.width
let minY = source.height
let maxX = -1
let maxY = -1
for (let y = 0; y < source.height; y += 1) {
  for (let x = 0; x < source.width; x += 1) {
    if (coverage[y * source.width + x] > 0.5) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
if (maxX < 0) throw new Error(`No glyph found in ${SOURCE}`)

const glyphWidth = maxX - minX + 1
const glyphHeight = maxY - minY + 1
const glyphEdge = Math.max(glyphWidth, glyphHeight)
const glyphCenterX = minX + glyphWidth / 2
const glyphCenterY = minY + glyphHeight / 2

/** Box-filtered sample of the coverage map over one output pixel's footprint. */
const sampleCoverage = (x0, y0, x1, y1) => {
  const startX = Math.max(0, Math.floor(x0))
  const startY = Math.max(0, Math.floor(y0))
  const endX = Math.min(source.width - 1, Math.ceil(x1) - 1)
  const endY = Math.min(source.height - 1, Math.ceil(y1) - 1)
  if (endX < startX || endY < startY) return 0

  let total = 0
  let count = 0
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      total += coverage[y * source.width + x]
      count += 1
    }
  }
  return count === 0 ? 0 : total / count
}

for (const [folder, edge] of DENSITIES) {
  const out = new PNG({ width: edge, height: edge })

  // Source pixels per output pixel, chosen so the glyph fills GLYPH_SCALE of
  // the output edge.
  const step = glyphEdge / (edge * GLYPH_SCALE)
  const originX = glyphCenterX - (edge / 2) * step
  const originY = glyphCenterY - (edge / 2) * step

  for (let y = 0; y < edge; y += 1) {
    for (let x = 0; x < edge; x += 1) {
      const alpha = sampleCoverage(
        originX + x * step,
        originY + y * step,
        originX + (x + 1) * step,
        originY + (y + 1) * step
      )
      const offset = (y * edge + x) * 4
      // White everywhere; only the alpha channel carries the shape, which is
      // all Android reads.
      out.data[offset] = 255
      out.data[offset + 1] = 255
      out.data[offset + 2] = 255
      out.data[offset + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    }
  }

  const target = join(RES, folder, 'notification_icon.png')
  writeFileSync(target, PNG.sync.write(out))
  console.log(`wrote ${folder}/notification_icon.png (${edge}x${edge})`)
}
