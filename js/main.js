import { decrypt, encrypt } from './encryption.js'

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
	$('#encrypted').val(value)
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

function storePassword() {
	const mainPass = $('#mainPass').val()
	localStorage.setItem('mainPass', mainPass)
}

function loadPassword() {
	const mainPass = localStorage.getItem('mainPass')
	if (!mainPass) return
	if (mainPass) {
		$('#mainPass').val(mainPass)
	}
}

$('body').on('click', '.pass button', function () {
	const button = $(this)
	const input = button.closest('.field').find('input')
	input.attr('type', input.attr('type') === 'password' ? 'text' : 'password')
	button.children('img').each(function () {
		$(this).toggleClass('hidden')
	})
})

$('#encrypt').on('click', async function () {
	const mainPassInput = $('#mainPass')
	const mainPass = mainPassInput.val()
	if (!mainPass) {
		setError(mainPassInput, 'Enter a main password')
		return
	}
	const passInput = $('#pass')
	const pass = passInput.val()
	if (!pass) {
		setError(passInput, 'Enter a password')
		return
	}
	const option = $('#option').val()
	const encrypted = await encrypt(mainPass, pass)
	if (option === 'text') {
		$('#encrypted').val(encrypted)
	} else if (option === 'link') {
		$('#encrypted').val(buildURL(encrypted))
	} else if (option === 'qr') {
		const qr = $('#qr')
		qr.html('')
		appendQR(qr[0], buildURL(encrypted))
	}
})

$('#option').on('input', function () {
	const val = $(this).val()
	if (val === 'text') {
		$('#encrypted').val('').show().removeAttr('readonly')
		$('#qr').hide()
	} else if (val === 'link') {
		$('#encrypted').val('').show().attr('readonly', true)
		$('#qr').hide()
	} else {
		$('#encrypted').hide()
		$('#qr').html('').show()
	}
})

$('#decrypt').on('click', async function () {
	const mainPassInput = $('#mainPass')
	const mainPass = mainPassInput.val()
	if (!mainPass) {
		setError(mainPassInput, 'Enter a main password')
		return
	}
	const encryptedInput = $('#encrypted')
	const encrypted = encryptedInput.val()
	if (!encrypted) {
		setError(encryptedInput, 'Enter an encrypted password')
		return
	}
	const res = await decrypt({ pass: mainPass, encrypted })
	if (res === null) {
		setError(encryptedInput, 'Invalid encrypted password')
		return
	}
	$('#pass').val(res)
})

$('input[type="text"],input[type="password"],textarea').on(
	'input',
	function () {
		clearError($(this))
	}
)

$(window).on('keydown', (e) => {
	if (e.code === 'KeyS' && e.ctrlKey) {
		e.preventDefault()
		confirm('Save password?') && storePassword()
	}
})

loadFromQuery()
loadPassword()
