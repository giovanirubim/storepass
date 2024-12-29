export const fixTypos = (str) => {
	const typosFixed = str
		.split('')
		.map((char) => {
			if ('Oo'.includes(char)) return '0'
			if ('IiLl'.includes(char)) return '1'
			if ('Ss'.includes(char)) return '5'
			if ('Zz'.includes(char)) return '2'
			if ('gG'.includes(char)) return '9'
			if ('_'.includes(char)) return '-'
			return char
		})
		.join('')
		.toLowerCase()
	return typosFixed
}
