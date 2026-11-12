const messages = {
	en: {
		changeMasterPass: 'Change master password',
		back: 'Back',
		show: 'Show',
		hide: 'Hide',
		copy: 'Copy',
		copied: 'Copied!',
		working: 'Working…',

		startTitle: 'To get started, type your master password.',
		startTitleWithCode: 'A code was opened. Type your master password to read it.',
		masterPassLabel: 'Master password',
		signatureTitle: 'Your picture',
		signatureHint:
			'This picture comes from your master password. If it looks different from usual, check what you typed.',
		signatureEmpty: 'Your picture will appear here as you type.',
		continue: 'Continue',
		enterMasterPass: 'Type your master password',
		masterPassTip:
			'Tip: a good master password is a few random words, like "lemon window cloud tiger".',

		menuTitle: 'What do you want to do?',
		menuStore: 'Store a password I already have',
		menuCreate: 'Create a new password',
		menuRecover: 'Recover a password from a code',

		storeTitle: 'Type the password you want to store.',
		passwordLabel: 'Password',
		enterPassword: 'Type a password',
		generateCode: 'Generate code',

		createTitle: 'Here is a new password.',
		createHint:
			'Use it on the site or app (copy it there), then generate the code to print.',
		reroll: 'Another one',

		printTitle: 'Your code is ready.',
		printHint:
			'Print it or save the image. On the line, write by hand what the password is for.',
		downloadImage: 'Save image',
		print: 'Print',
		done: 'Done',
		imageFor: 'For:',

		recoverTitle: 'Type the code, or scan its QR code.',
		codeLabel: 'Code',
		scan: 'Scan QR code',
		stopScan: 'Stop camera',
		cameraError: 'Could not open the camera.',
		open: 'Open',
		enterCode: 'Type a code',
		invalidCode: 'Invalid code, check that it was typed correctly',
		wrongPass: "The master password doesn't match this code",

		resultTitle: 'Your password:',
		oldFormat:
			'This code is in the old format. It still works, but you can generate a new code and print it to replace the old one.',
		newCode: 'Generate new code',
		recoverAnother: 'Recover another',

		recoverySheet: 'Recovery sheet',
		sheetPrintHint:
			'Print this sheet once and keep it with the backup of your master password, for example in a sealed envelope held by someone you trust.',
		sheetTitle: 'StorePass — recovery sheet',
		sheetWhatTitle: 'What is this',
		sheetWhat:
			'StorePass protects passwords written on paper. Each password becomes a code, printed with a QR code. The code only opens with the master password.',
		sheetSite: 'Site:',
		sheetSiteHint:
			'Scan the QR code with a phone, or open the site and type the code and the master password.',
		sheetNoSiteTitle: 'If the site is not available',
		sheetNoSite:
			'Any computer browser can open the code with the small program below:',
		sheetStep1: 'Open a browser (Chrome, Firefox, Edge or Safari) on a computer.',
		sheetStep2:
			'Press F12 (or right-click the page and choose "Inspect") and open the "Console" tab.',
		sheetStep3:
			'Type the program below exactly as written. If you paste it instead, some browsers ask you to type "allow pasting" first.',
		sheetStep4:
			'In the last line, replace the example code and master password with yours, keeping the quotes, and press Enter.',
		sheetStep5:
			'The password appears below. An error saying "OperationError" means the master password or the code is wrong.',
		sheetQrHint:
			'If you only have the QR code: scan it with any reader. The code is everything after the "#" in the link.',
		sheetTestTitle: 'Checking the program',
		sheetTest:
			'Run it first with the example already in the last line. If it shows the result below, it was typed correctly.',
		sheetTestPass: 'Master password:',
		sheetTestCode: 'Code:',
		sheetTestResult: 'Result:',
	},
	pt: {
		changeMasterPass: 'Trocar senha mestre',
		back: 'Voltar',
		show: 'Mostrar',
		hide: 'Esconder',
		copy: 'Copiar',
		copied: 'Copiado!',
		working: 'Aguarde…',

		startTitle: 'Para começar, digite sua senha mestre.',
		startTitleWithCode: 'Um código foi aberto. Digite sua senha mestre para lê-lo.',
		masterPassLabel: 'Senha mestre',
		signatureTitle: 'Sua figura',
		signatureHint:
			'Esta figura vem da sua senha mestre. Se ela estiver diferente do normal, confira o que você digitou.',
		signatureEmpty: 'Sua figura aparece aqui enquanto você digita.',
		continue: 'Continuar',
		enterMasterPass: 'Digite sua senha mestre',
		masterPassTip:
			'Dica: uma boa senha mestre é formada por algumas palavras aleatórias, como "limão janela nuvem tigre".',

		menuTitle: 'O que você quer fazer?',
		menuStore: 'Guardar uma senha que eu já tenho',
		menuCreate: 'Criar uma senha nova',
		menuRecover: 'Recuperar uma senha a partir de um código',

		storeTitle: 'Digite a senha que você quer guardar.',
		passwordLabel: 'Senha',
		enterPassword: 'Digite uma senha',
		generateCode: 'Gerar código',

		createTitle: 'Aqui está uma senha nova.',
		createHint:
			'Use-a no site ou aplicativo (copie e cole lá) e depois gere o código para imprimir.',
		reroll: 'Outra',

		printTitle: 'Seu código está pronto.',
		printHint:
			'Imprima ou salve a imagem. Na linha, escreva à mão para que serve a senha.',
		downloadImage: 'Salvar imagem',
		print: 'Imprimir',
		done: 'Concluir',
		imageFor: 'Para:',

		recoverTitle: 'Digite o código ou escaneie o QR code.',
		codeLabel: 'Código',
		scan: 'Escanear QR code',
		stopScan: 'Desligar câmera',
		cameraError: 'Não foi possível abrir a câmera.',
		open: 'Abrir',
		enterCode: 'Digite um código',
		invalidCode: 'Código inválido, confira se foi digitado corretamente',
		wrongPass: 'A senha mestre não corresponde a este código',

		resultTitle: 'Sua senha:',
		oldFormat:
			'Este código está no formato antigo. Ele continua funcionando, mas você pode gerar um código novo e imprimi-lo para substituir o antigo.',
		newCode: 'Gerar código novo',
		recoverAnother: 'Recuperar outra',

		recoverySheet: 'Folha de recuperação',
		sheetPrintHint:
			'Imprima esta folha uma vez e guarde-a junto com a cópia da sua senha mestre, por exemplo num envelope lacrado com alguém de confiança.',
		sheetTitle: 'StorePass — folha de recuperação',
		sheetWhatTitle: 'O que é isto',
		sheetWhat:
			'O StorePass protege senhas anotadas em papel. Cada senha vira um código, impresso junto com um QR code. O código só abre com a senha mestre.',
		sheetSite: 'Site:',
		sheetSiteHint:
			'Escaneie o QR code com um celular, ou abra o site e digite o código e a senha mestre.',
		sheetNoSiteTitle: 'Se o site não estiver disponível',
		sheetNoSite:
			'Qualquer navegador de computador consegue abrir o código com o pequeno programa abaixo:',
		sheetStep1: 'Abra um navegador (Chrome, Firefox, Edge ou Safari) num computador.',
		sheetStep2:
			'Aperte F12 (ou clique com o botão direito na página e escolha "Inspecionar") e abra a aba "Console".',
		sheetStep3:
			'Digite o programa abaixo exatamente como está escrito. Se você colar em vez de digitar, alguns navegadores pedem que você digite "allow pasting" antes.',
		sheetStep4:
			'Na última linha, troque o código e a senha mestre de exemplo pelos seus, mantendo as aspas, e aperte Enter.',
		sheetStep5:
			'A senha aparece logo abaixo. Um erro com "OperationError" significa que a senha mestre ou o código estão errados.',
		sheetQrHint:
			'Se você só tiver o QR code: escaneie com qualquer leitor. O código é tudo o que vem depois do "#" no link.',
		sheetTestTitle: 'Conferindo o programa',
		sheetTest:
			'Rode primeiro com o exemplo que já está na última linha. Se mostrar o resultado abaixo, foi digitado corretamente.',
		sheetTestPass: 'Senha mestre:',
		sheetTestCode: 'Código:',
		sheetTestResult: 'Resultado:',
	},
}

// First browser language we support, otherwise English
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
	const message = messages[language][key] ?? messages.en[key] ?? key
	return typeof message === 'function' ? message(...args) : message
}

// Fills elements marked with data-i18n (text), data-i18n-title (tooltip)
// and data-i18n-label (aria-label)
export function translatePage(root = document) {
	document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en'
	for (const el of root.querySelectorAll('[data-i18n]')) {
		el.textContent = t(el.dataset.i18n)
	}
	for (const el of root.querySelectorAll('[data-i18n-title]')) {
		el.title = t(el.dataset.i18nTitle)
	}
	for (const el of root.querySelectorAll('[data-i18n-label]')) {
		el.setAttribute('aria-label', t(el.dataset.i18nLabel))
	}
}
