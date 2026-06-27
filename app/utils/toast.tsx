type Variant = "success" | "error"

export function createToast(update: () => unknown, signal: AbortSignal) {
	let message: string | null = null
	let variant: Variant = "success"
	let timer: ReturnType<typeof setTimeout> | null = null

	signal.addEventListener("abort", () => {
		if (timer) clearTimeout(timer)
	})

	function show(msg: string, v: Variant = "success", duration = 2000) {
		if (timer) clearTimeout(timer)
		message = msg
		variant = v
		update()
		timer = setTimeout(() => {
			message = null
			timer = null
			update()
		}, duration)
	}

	function render() {
		if (!message) return null
		return (
			<div class={`sl-toast sl-toast--${variant}`} role="status">
				{message}
			</div>
		)
	}

	return { show, render }
}
