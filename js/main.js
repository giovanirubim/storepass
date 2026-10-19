import { decrypt, encrypt } from './encryption.js'
import { t, translatePage } from './i18n.js'
import { generatePassword } from './password.js'

function buildURL(encrypted) {
	const search = '?decrypt=' + encodeURIComponent(encrypted)
	return window.location.href.replace(/\?.*/, '') + search
}

function appendQR(dom, url) {
	new QRCode(dom, {
		text: url,
		width: 180,
		height: 180,
		colorDark: '#000',
		colorLight: '#fff',
		correctLevel: QRCode.CorrectLevel.L,
	})
}

function loadFromQuery() {
	const { search } = window.location
	const args = new URLSearchParams(search)
	const value = args.get('decrypt')
	if (!value) return
	lastEncrypted = value
	$('#option').val('link')
	renderOutput()
}

function setError(input, message) {
	const parent = input.closest('.field')
	const err = parent.find('.err-msg')
	if (err.length) {
		err.text(message)
	} else {
		parent.append(`<div class="err-msg"></div>`)
		parent.find('.err-msg').text(message)
	}
}

function clearError(input) {
	input.closest('.field').find('.err-msg').remove()
}

const MAIN_PASS_KEY = 'mainPass'
const MAIN_PASS_TTL_DAYS = 30

function storePassword() {
	const mainPass = $('#mainPass').val()
	if (!mainPass) {
		localStorage.removeItem(MAIN_PASS_KEY)
		return
	}
	const expiresAt = Date.now() + MAIN_PASS_TTL_DAYS * 24 * 60 * 60 * 1000
	localStorage.setItem(
		MAIN_PASS_KEY,
		JSON.stringify({ password: mainPass, expiresAt })
	)
}

function readStoredPassword() {
	const raw = localStorage.getItem(MAIN_PASS_KEY)
	if (!raw) return null
	try {
		const data = JSON.parse(raw)
		if (typeof data?.password === 'string') return data
	} catch {}
	// Saved before expiration existed: a plain string with no expiry
	return { password: raw, expiresAt: null }
}

function loadPassword() {
	const stored = readStoredPassword()
	if (!stored) return
	if (stored.expiresAt === null) {
		// Migrate the old format, starting its expiration from now
		$('#mainPass').val(stored.password)
		storePassword()
		return
	}
	if (stored.expiresAt <= Date.now()) {
		localStorage.removeItem(MAIN_PASS_KEY)
		return
	}
	$('#mainPass').val(stored.password)
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text)
	} catch {
		const tmp = $('<textarea>').val(text).appendTo('body')
		tmp[0].select()
		document.execCommand('copy')
		tmp.remove()
	}
}

$('body').on('click', '.copy', async function () {
	const button = $(this)
	const text = $(button.data('target')).val()
	if (!text) return
	await copyText(text)
	flashCheck(button)
})

// Swaps the button's icon for the check icon for a moment
function flashCheck(button) {
	const [icon, checkIcon] = button.children('img')
	$(icon).addClass('hidden')
	$(checkIcon).removeClass('hidden')
	clearTimeout(button.data('timeout'))
	button.data(
		'timeout',
		setTimeout(() => {
			$(icon).removeClass('hidden')
			$(checkIcon).addClass('hidden')
		}, 1000)
	)
}

$('#saveMainPass').on('click', function () {
	if (!$('#mainPass').val()) {
		storePassword()
		alert(t('mainPassRemoved'))
		return
	}
	if (!confirm(t('confirmSaveMainPass', MAIN_PASS_TTL_DAYS))) return
	storePassword()
	flashCheck($(this))
})

$('body').on('click', '.pass button.toggle', function () {
	const button = $(this)
	const input = button.closest('.field').find('input')
	input.attr('type', input.attr('type') === 'password' ? 'text' : 'password')
	button.children('img').each(function () {
		$(this).toggleClass('hidden')
	})
})

$('#generatePass').on('click', function () {
	// Trigger input so errors and stale generated codes are cleared
	$('#pass').val(generatePassword()).trigger('input')
	$('#encrypt').click()
})

// Last code shown, reused when switching the output type
let lastEncrypted = null
// Whether lastEncrypted came from "Generate code" (and so from the inputs)
let generated = false

$('#encrypt').on('click', async function () {
	const mainPassInput = $('#mainPass')
	const mainPass = mainPassInput.val()
	if (!mainPass) {
		setError(mainPassInput, t('enterMainPass'))
		return
	}
	const passInput = $('#pass')
	const pass = passInput.val()
	if (!pass) {
		setError(passInput, t('enterPass'))
		return
	}
	lastEncrypted = await encrypt(mainPass, pass)
	generated = true
	renderOutput()
})

function renderOutput() {
	const option = $('#option').val()
	const encryptedInput = $('#encrypted')
	const qr = $('#qr')
	encryptedInput.siblings('.copy').toggle(option !== 'qr')
	$('#decrypt').prop('disabled', option === 'qr')
	if (option === 'text') {
		encryptedInput.val(lastEncrypted ?? '').show().removeAttr('readonly')
		qr.hide()
	} else if (option === 'link') {
		encryptedInput
			.val(lastEncrypted ? buildURL(lastEncrypted) : '')
			.show()
			.attr('readonly', true)
		qr.hide()
	} else if (option === 'qr') {
		encryptedInput.hide()
		qr.html('').show()
		if (lastEncrypted) appendQR(qr[0], buildURL(lastEncrypted))
	}
}

$('#option').on('input', renderOutput)

// Typing a code by hand replaces the last code
$('#encrypted').on('input', function () {
	lastEncrypted = null
	generated = false
})

// A generated code no longer matches once its inputs change
$('#mainPass, #pass').on('input', function () {
	if (!generated) return
	lastEncrypted = null
	generated = false
	renderOutput()
})

$('#decrypt').on('click', async function () {
	const mainPassInput = $('#mainPass')
	const mainPass = mainPassInput.val()
	if (!mainPass) {
		setError(mainPassInput, t('enterMainPass'))
		return
	}
	const encryptedInput = $('#encrypted')
	const encrypted = getCodeToTranslate()
	if (!encrypted) {
		setError(encryptedInput, t('enterEncrypted'))
		return
	}
	if (await translateCode(mainPass, encrypted)) {
		// Keep the code so switching to link or QR shows it
		lastEncrypted = encrypted
		generated = false
	} else {
		setError(encryptedInput, t('invalidEncrypted'))
	}
})

function getCodeToTranslate() {
	const option = $('#option').val()
	const value = $('#encrypted').val().trim()
	return option === 'link' ? codeFromLink(value) : value
}

function codeFromLink(link) {
	try {
		return new URL(link).searchParams.get('decrypt')
	} catch {
		return null
	}
}

async function translateCode(mainPass, encrypted) {
	const res = await decrypt({ pass: mainPass, encrypted })
	if (res === null) return false
	$('#pass').val(res)
	return true
}

$('input[type="text"],input[type="password"],textarea').on(
	'input',
	function () {
		clearError($(this))
	}
)

translatePage()
renderOutput()
loadFromQuery()
loadPassword()

if (lastEncrypted && $('#mainPass').val()) {
	translateCode($('#mainPass').val(), lastEncrypted)
}
