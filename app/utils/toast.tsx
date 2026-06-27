import { on } from "remix/ui"

type Variant = "success" | "error"
type Action = { label: string; onClick: () => void }

export function createToast(update: () => unknown, signal: AbortSignal) {
	let message: string | null = null
	let variant: Variant = "success"
	let action: Action | null = null
	let timer: ReturnType<typeof setTimeout> | null = null

	signal.addEventListener("abort", () => {
		if (timer) clearTimeout(timer)
	})

	function show(
		msg: string,
		v: Variant = "success",
		opts: { duration?: number; action?: Action } = {},
	) {
		if (timer) clearTimeout(timer)
		message = msg
		variant = v
		action = opts.action ?? null
		update()
		if (!action) {
			timer = setTimeout(() => {
				message = null
				timer = null
				update()
			}, opts.duration ?? 2000)
		}
	}

	function dismiss() {
		if (timer) clearTimeout(timer)
		message = null
		action = null
		timer = null
		update()
	}

	function render() {
		if (!message) return null
		return (
			<div class={`sl-toast sl-toast--${variant}`} role="status">
				<span>{message}</span>
				{action && (
					<button
						class="sl-toast__action"
						type="button"
						mix={on("click", action.onClick)}
					>
						{action.label}
					</button>
				)}
			</div>
		)
	}

	return { show, dismiss, render }
}
