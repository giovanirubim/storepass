// QR scanning with the camera, using the browser's BarcodeDetector.
// Where it isn't available, the phone's own camera app opens the link anyway.

export const canScan =
	'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

let stream = null
let timer = null

export async function startScan(video, onResult) {
	stopScan(video)
	const detector = new BarcodeDetector({ formats: ['qr_code'] })
	stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' },
		audio: false,
	})
	video.srcObject = stream
	await video.play()
	const tick = async () => {
		if (!stream) return
		try {
			const [found] = await detector.detect(video)
			if (found?.rawValue) {
				stopScan(video)
				onResult(found.rawValue)
				return
			}
		} catch {}
		timer = setTimeout(tick, 250)
	}
	tick()
}

export function stopScan(video) {
	clearTimeout(timer)
	stream?.getTracks().forEach((track) => track.stop())
	stream = null
	if (video) video.srcObject = null
}
