const messages = {
	en: {
		mainPassLabel: 'Master password:',
		passLabel: 'Password:',
		encryptedLabel: 'Code:',
		saveInBrowser: 'Save in this browser',
		copy: 'Copy',
		generatePass: 'Generate random password',
		text: 'Text',
		link: 'Link',
		qrCode: 'QR Code',
		encrypt: 'Generate code',
		decrypt: 'Translate code',
		mainPassRemoved: 'Saved master password removed from this browser',
		confirmSaveMainPass: (days) =>
			`Save the master password in this browser for ${days} days?`,
		enterMainPass: 'Enter the master password',
		enterPass: 'Enter a password',
		enterEncrypted: 'Enter a code',
		invalidEncrypted: 'Invalid code',
	},
	pt: {
		mainPassLabel: 'Senha mestre:',
		passLabel: 'Senha:',
		encryptedLabel: 'Código:',
		saveInBrowser: 'Salvar neste navegador',
		copy: 'Copiar',
		generatePass: 'Gerar senha aleatória',
		text: 'Texto',
		link: 'Link',
		qrCode: 'QR Code',
		encrypt: 'Gerar código',
		decrypt: 'Traduzir código',
		mainPassRemoved: 'Senha mestre removida deste navegador',
		confirmSaveMainPass: (days) =>
			`Salvar a senha mestre neste navegador por ${days} dias?`,
		enterMainPass: 'Digite a senha mestre',
		enterPass: 'Digite uma senha',
		enterEncrypted: 'Digite um código',
		invalidEncrypted: 'Código inválido',
	},
}

// First browser language we support, falling back to English
function detectLanguage() {
	const languages = navigator.languages?.length
		? navigator.languages
		: [navigator.language]
	for (const language of languages) {
		const base = language?.toLowerCase().split('-')[0]
		if (base in messages) return base
	}
	return 'en'
}

export const language = detectLanguage()

export function t(key, ...args) {
	const message = messages[language][key]
	return typeof message === 'function' ? message(...args) : message
}

// Fills elements marked with data-i18n (text) and data-i18n-title (tooltip)
export function translatePage() {
	document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en'
	$('[data-i18n]').each(function () {
		$(this).text(t($(this).data('i18n')))
	})
	$('[data-i18n-title]').each(function () {
		$(this).attr('title', t($(this).data('i18n-title')))
	})
}
