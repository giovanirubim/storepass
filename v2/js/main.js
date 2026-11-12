import { decrypt, encrypt, formatCode, isValidCode } from './encryption.js'
import { t, translatePage } from './i18n.js'
import { generatePassword } from './password.js'
import { computeSignature, createSignatureView } from './signature.js'
import { renderPrintable } from './printable.js'
import { canScan, startScan, stopScan } from './scanner.js'
import { siteName, siteURL } from './config.js'

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]

// --- Master password (sessionStorage only: gone when the tab closes) ---

const MASTER_KEY = 'storepass.masterPass'
let masterPass = readSession()

function readSession() {
	try {
		return sessionStorage.getItem(MASTER_KEY) || ''
	} catch {
		return ''
	}
}

function setMasterPass(value) {
	masterPass = value
	try {
		if (value) sessionStorage.setItem(MASTER_KEY, value)
		else sessionStorage.removeItem(MASTER_KEY)
	} catch {}
	updateTopbar()
}

// --- Navigation: one step per screen, phone back button works ---

const NEEDS_MASTER = ['menu', 'store', 'create', 'print', 'recover', 'result']
const PARENT = {
	menu: 'start',
	store: 'menu',
	create: 'menu',
	print: 'menu',
	recover: 'menu',
	result: 'recover',
	sheet: 'start',
}
let current = null
let depth = 0
let pendingCode = '' // code opened from a link, waiting for the master password

function show(screen) {
	if (NEEDS_MASTER.includes(screen) && !masterPass) screen = 'start'
	if (current === 'recover' && screen !== 'recover') stopCamera()
	current = screen
	for (const el of $$('.screen')) el.classList.toggle('active', el.id === `screen-${screen}`)
	updateTopbar()
	window.scrollTo(0, 0)
	onShow[screen]?.()
}

function go(screen) {
	depth++
	history.pushState({ screen, depth }, '', location.pathname)
	show(screen)
}

function back() {
	if (depth > 0) history.back()
	else go(PARENT[current] ?? 'start')
}

window.addEventListener('popstate', (event) => {
	depth = event.state?.depth ?? 0
	show(event.state?.screen ?? (masterPass ? 'menu' : 'start'))
})

document.addEventListener('click', (event) => {
	const target = event.target.closest('[data-go], [data-back]')
	if (!target) return
	if (target.hasAttribute('data-back')) back()
	else go(target.dataset.go)
})

const onShow = {
	start() {
		$('#startTitle').textContent = t(pendingCode ? 'startTitleWithCode' : 'startTitle')
		focusLater('#masterPass')
	},
	store() {
		$('#storePass').value = ''
		setVisibility($('#storePass'), false)
		clearError($('#storePass'))
		focusLater('#storePass')
	},
	create() {
		if (!$('#newPass').value) $('#newPass').value = generatePassword()
	},
	recover() {
		if (pendingCode) {
			$('#code').value = formatCode(pendingCode)
			pendingCode = ''
			$('#recoverForm').requestSubmit()
		} else {
			focusLater('#code')
		}
	},
	sheet() {
		$('#sheetSiteURL').textContent = siteURL()
	},
}

function focusLater(selector) {
	// Don't pop up the keyboard on phones unless the screen is mostly that field
	setTimeout(() => $(selector)?.focus(), 50)
}

// --- Top bar: change master password, with its picture ---

const signatureView = createSignatureView($('#signature'), { thick: 4 })
const thumbView = createSignatureView($('#signatureThumb'), { thick: 1.5 })

function updateTopbar() {
	const showChange = !!masterPass && current !== 'start'
	$('#changeMasterPass').classList.toggle('hidden', !showChange)
	if (showChange) {
		thumbView.start()
		signatureFor(masterPass).then((seed) => {
			if (masterPass) thumbView.setPassword(seed)
		})
	} else {
		thumbView.stop()
	}
	if (current === 'start') signatureView.start()
	else signatureView.stop()
}

$('#changeMasterPass').addEventListener('click', () => {
	setMasterPass('')
	$('#masterPass').value = ''
	renderSignature()
	go('start')
})

// --- Helpers ---

function setError(input, key) {
	input.closest('.field').querySelector('.error').textContent = key ? t(key) : ''
	input.setAttribute('aria-invalid', key ? 'true' : 'false')
}

function clearError(input) {
	setError(input, null)
}

for (const input of $$('input, textarea')) {
	input.addEventListener('input', () => input.closest('.field') && clearError(input))
}

async function busy(button, task) {
	const label = button.innerHTML
	button.disabled = true
	button.textContent = t('working')
	try {
		return await task()
	} finally {
		button.disabled = false
		button.innerHTML = label
	}
}

function setVisibility(input, visible) {
	input.type = visible ? 'text' : 'password'
	const button = input.parentElement.querySelector('.toggle-visibility')
	if (!button) return
	const key = visible ? 'hide' : 'show'
	button.title = t(key)
	button.setAttribute('aria-label', t(key))
	button.querySelector('img').src = `./img/${visible ? 'eye-closed' : 'eye-open'}.svg`
}

for (const button of $$('.toggle-visibility')) {
	button.addEventListener('click', () => {
		const input = $(`#${button.dataset.target}`)
		setVisibility(input, input.type === 'password')
	})
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text)
	} catch {
		const tmp = document.createElement('textarea')
		tmp.value = text
		document.body.append(tmp)
		tmp.select()
		document.execCommand('copy')
		tmp.remove()
	}
}

for (const button of $$('.copy')) {
	button.addEventListener('click', async () => {
		const text = $(`#${button.dataset.target}`).value
		if (!text) return
		await copyText(text)
		const img = button.querySelector('img')
		img.src = './img/check.svg'
		button.title = t('copied')
		clearTimeout(button.timer)
		button.timer = setTimeout(() => {
			img.src = './img/copy.svg'
			button.title = t('copy')
		}, 1500)
	})
}

// --- 1. Start: master password + visual signature ---

const signatureCache = new Map()
function signatureFor(pass) {
	if (!signatureCache.has(pass)) signatureCache.set(pass, computeSignature(pass))
	return signatureCache.get(pass)
}

let signatureTimer = null
let signatureRun = 0

function renderSignature() {
	const pass = $('#masterPass').value
	const box = $('#signature')
	const hint = $('#signatureHint')
	clearTimeout(signatureTimer)
	const run = ++signatureRun
	if (!pass) {
		signatureView.setPassword('') // neutral figure
		box.classList.remove('loading')
		hint.textContent = t('signatureEmpty')
		return
	}
	box.classList.add('loading')
	signatureTimer = setTimeout(async () => {
		const seed = await signatureFor(pass)
		if (run !== signatureRun) return // typed again meanwhile
		signatureView.setPassword(seed)
		box.classList.remove('loading')
		hint.textContent = t('signatureHint')
	}, 400)
}

$('#masterPass').addEventListener('input', renderSignature)

$('#startForm').addEventListener('submit', (event) => {
	event.preventDefault()
	const input = $('#masterPass')
	if (!input.value) {
		setError(input, 'enterMasterPass')
		input.focus()
		return
	}
	setMasterPass(input.value)
	setVisibility(input, false)
	go(pendingCode ? 'recover' : 'menu')
})

// --- 3. Store an existing password ---

$('#storeForm').addEventListener('submit', async (event) => {
	event.preventDefault()
	const input = $('#storePass')
	if (!input.value) {
		setError(input, 'enterPassword')
		input.focus()
		return
	}
	await generateAndPrint(input.value, event.submitter ?? $('#storeForm .primary'))
})

// --- 4. Create a new password ---

// A fresh password each time it's opened from the menu, but the same one when
// coming back to it (the user may already be using it somewhere)
$('[data-go="create"]').addEventListener('click', () => {
	$('#newPass').value = generatePassword()
})

$('#rerollPass').addEventListener('click', () => {
	$('#newPass').value = generatePassword()
})

$('#createGenerate').addEventListener('click', async (event) => {
	await generateAndPrint($('#newPass').value, event.currentTarget)
})

// --- Print screen ---

async function generateAndPrint(password, button) {
	const code = await busy(button, () => encrypt(masterPass, password))
	const canvas = renderPrintable({
		code,
		linkPrefix: siteURL() + '#',
		texts: { forLabel: t('imageFor'), site: siteName() },
	})
	const url = canvas.toDataURL('image/png')
	$('#printImage').src = url
	$('#printImage').alt = formatCode(code)
	$('#downloadImage').href = url
	$('#downloadImage').download = `storepass-${code.slice(1, 6)}.png`
	go('print')
}

$('#printButton').addEventListener('click', () => window.print())
$('#printSheet').addEventListener('click', () => window.print())

// --- 5. Recover ---

// Accepts a bare code or a whole link (new #CODE or old ?decrypt=CODE)
function extractCode(text) {
	const value = text.trim()
	if (/^https?:\/\//i.test(value)) {
		try {
			const url = new URL(value)
			if (url.hash.length > 1) return decodeURIComponent(url.hash.slice(1))
			const old = url.searchParams.get('decrypt')
			if (old) return old
		} catch {}
	}
	return value
}

$('#recoverForm').addEventListener('submit', async (event) => {
	event.preventDefault()
	const input = $('#code')
	const code = extractCode(input.value)
	if (!code) {
		setError(input, 'enterCode')
		return
	}
	if (!isValidCode(code)) {
		setError(input, 'invalidCode')
		return
	}
	stopCamera()
	const button = $('#recoverForm .primary')
	const result = await busy(button, () => decrypt(code, masterPass))
	if (!result.ok) {
		setError(input, result.error)
		return
	}
	showResult(result)
})

let recovered = null

function showResult(result) {
	recovered = result.password
	$('#resultPass').value = result.password
	$('#oldFormat').classList.toggle('hidden', result.version !== 1)
	$('#code').value = ''
	go('result')
}

$('#newCodeButton').addEventListener('click', (event) => {
	if (recovered) generateAndPrint(recovered, event.currentTarget)
})

// Camera scanning, where the browser supports it
const video = $('#scanVideo')
let scanning = false

function stopCamera() {
	if (!scanning) return
	scanning = false
	stopScan(video)
	$('#scanner').classList.add('hidden')
	$('#scanButton span').textContent = t('scan')
}

if (canScan) {
	$('#scanButton').classList.remove('hidden')
	$('#scanButton').addEventListener('click', async () => {
		if (scanning) return stopCamera()
		clearError($('#code'))
		scanning = true
		$('#scanner').classList.remove('hidden')
		$('#scanButton span').textContent = t('stopScan')
		try {
			await startScan(video, (text) => {
				scanning = false
				$('#scanner').classList.add('hidden')
				$('#scanButton span').textContent = t('scan')
				$('#code').value = extractCode(text)
				$('#recoverForm').requestSubmit()
			})
		} catch {
			stopCamera()
			setError($('#code'), 'cameraError')
		}
	})
}

// --- Start ---

// A code in the link (#CODE, or the old ?decrypt=CODE) goes straight to recovery.
// Remove it from the address bar right away.
function readCodeFromURL() {
	const hash = decodeURIComponent(location.hash.slice(1)).trim()
	const old = new URLSearchParams(location.search).get('decrypt')
	return hash || old || ''
}

translatePage()
pendingCode = readCodeFromURL()
const first = pendingCode ? 'recover' : masterPass ? 'menu' : 'start'
history.replaceState({ screen: first, depth: 0 }, '', location.pathname)
if (masterPass) $('#masterPass').value = masterPass
renderSignature()
show(first)

// Opening another link in the same tab only changes the fragment
window.addEventListener('hashchange', () => {
	const code = readCodeFromURL()
	if (!code) return
	pendingCode = code
	history.replaceState({ screen: 'recover', depth }, '', location.pathname)
	show('recover')
})
