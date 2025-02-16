const strToBuff = (text) => {
	return new TextEncoder().encode(text)
}

const buffToHex = (buff) => {
	return [...new Uint8Array(buff)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}

const strToHex = (str) => {
	return buffToHex(strToBuff(str))
}

const hexToStr = (hex) => {
	return new TextDecoder().decode(
		new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16))).buffer
	)
}

const strToSha256Hex = async (str) => {
	const hashBuff = await crypto.subtle.digest('SHA-256', strToBuff(str))
	return buffToHex(hashBuff)
}

const encryptionHash = async (salt, pass, len) => {
	let res = ''
	let suffix = ''
	while (res.length < len) {
		res += await strToSha256Hex(salt + pass + suffix)
		suffix = ':' + (Number(suffix.replace(':', '') || '0') + 1)
	}
	return res.slice(0, len)
}

const xorHexStr = (a, b) => {
	if (!a || !b) return ''
	return (
		(`0x${a[0]}` ^ `0x${b[0]}`).toString(16) +
		xorHexStr(a.slice(1), b.slice(1))
	)
}

const fixTypos = (str) => {
	const typosFixed = str
		.replace(/\s/g, '')
		.split('')
		.map((char) => {
			if ('Oo'.includes(char)) return '0'
			if ('IiLl'.includes(char)) return '1'
			if ('Zz'.includes(char)) return '2'
			if ('Ss'.includes(char)) return '5'
			if ('G'.includes(char)) return '6'
			if ('g'.includes(char)) return '9'
			if ('_'.includes(char)) return '-'
			return char
		})
		.join('')
		.toLowerCase()
	return typosFixed
}

export const encrypt = async (pass, text) => {
	const salt = 'x'
		.repeat(6)
		.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
	const hexText = strToHex(text)
	const hash = await encryptionHash(salt, pass, hexText.length)
	const content = xorHexStr(hash, hexText)
	const checksum = (await strToSha256Hex(salt + content)).slice(0, 2)
	return `${salt}.${content}.${checksum}`
}

export const decrypt = async ({ pass, encrypted }) => {
	const finish = async (salt, content, checksum) => {
		const check = (await strToSha256Hex(salt + content)).slice(0, 2)
		if (check !== checksum) return null
		const hash = await encryptionHash(salt, pass, content.length)
		return hexToStr(xorHexStr(hash, content))
	}
	const fixed = fixTypos(encrypted)
	if (/^[0-9a-f]{6}\/[0-9a-f]+-[0-9a-f]{2}$/.test(fixed)) {
		const [salt, content, checksum] = fixed.split(/[./]/)
		return finish(salt, content, checksum)
	}
	if (/^[0-9a-f]{6}\.[0-9a-f]+\.[0-9a-f]{2}$/.test(fixed)) {
		const [salt, content, checksum] = fixed.split('.')
		return finish(salt, content, checksum)
	}
	return null
}
