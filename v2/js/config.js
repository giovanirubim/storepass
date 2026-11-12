// Address printed in the QR codes. Leave empty to use the address the page was
// opened from. Set it to a custom domain (e.g. 'https://storepass.example.com/')
// so printed QRs keep working if the hosting changes.
export const SITE_URL = ''

export function siteURL() {
	if (SITE_URL) return SITE_URL
	const { origin, pathname } = window.location
	return origin + pathname.replace(/index\.html$/, '')
}

// Short form for printing, e.g. "storepass.example.com"
export function siteName() {
	try {
		const url = new URL(siteURL())
		if (!/^https?:$/.test(url.protocol)) return ''
		return (url.host + url.pathname).replace(/\/$/, '')
	} catch {
		return ''
	}
}
