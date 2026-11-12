// Printable image: QR code, the code as text, and a line to write what it is for.
// Must never contain the stored password, the master password or its signature.

import { alnumSegment, byteSegment, encodeSegments } from './qrcode.js'
import { formatCode } from './encryption.js'

const WIDTH = 800
const PADDING = 48
const MONO = '"Cascadia Mono", Consolas, "DejaVu Sans Mono", "Courier New", monospace'
const SANS = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif'
const GROUPS_PER_LINE = 4

// Link with the code in the fragment. The code part uses the QR alphanumeric
// mode, which makes the QR smaller than encoding everything as bytes.
export function qrMatrixFor(prefix, code) {
	return encodeSegments([byteSegment(prefix), alnumSegment(code)], { ecl: 'Q' })
}

export function drawQR(ctx, matrix, x, y, size) {
	const quiet = 4
	const count = matrix.length + quiet * 2
	const cell = Math.floor(size / count)
	const offset = Math.floor((size - cell * count) / 2)
	ctx.fillStyle = '#fff'
	ctx.fillRect(x, y, size, size)
	ctx.fillStyle = '#000'
	matrix.forEach((row, r) =>
		row.forEach((dark, c) => {
			if (dark) {
				ctx.fillRect(x + offset + (c + quiet) * cell, y + offset + (r + quiet) * cell, cell, cell)
			}
		})
	)
}

// Returns a canvas. texts: { forLabel, site } (site may be empty)
export function renderPrintable({ code, linkPrefix, texts }) {
	const groups = formatCode(code).split('-')
	const lines = []
	for (let i = 0; i < groups.length; i += GROUPS_PER_LINE) {
		lines.push(groups.slice(i, i + GROUPS_PER_LINE).join('-'))
	}

	const qrSize = 440
	const codeLineHeight = 62
	const height =
		PADDING + qrSize + 28 + lines.length * codeLineHeight + 40 + 60 + (texts.site ? 50 : 0) + PADDING

	const canvas = document.createElement('canvas')
	canvas.width = WIDTH
	canvas.height = height
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#fff'
	ctx.fillRect(0, 0, WIDTH, height)

	drawQR(ctx, qrMatrixFor(linkPrefix, code), (WIDTH - qrSize) / 2, PADDING, qrSize)

	let y = PADDING + qrSize + 28
	ctx.fillStyle = '#000'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'top'
	ctx.font = `bold 46px ${MONO}`
	for (const line of lines) {
		ctx.fillText(line, WIDTH / 2, y)
		y += codeLineHeight
	}

	y += 40
	ctx.textAlign = 'left'
	ctx.textBaseline = 'alphabetic'
	ctx.font = `30px ${SANS}`
	const label = texts.forLabel
	ctx.fillText(label, PADDING, y + 30)
	const lineStart = PADDING + ctx.measureText(label).width + 16
	ctx.strokeStyle = '#000'
	ctx.lineWidth = 2
	ctx.beginPath()
	ctx.moveTo(lineStart, y + 34)
	ctx.lineTo(WIDTH - PADDING, y + 34)
	ctx.stroke()
	y += 60

	if (texts.site) {
		ctx.textAlign = 'center'
		ctx.fillStyle = '#555'
		ctx.font = `22px ${SANS}`
		ctx.fillText(texts.site, WIDTH / 2, y + 30)
	}
	return canvas
}
