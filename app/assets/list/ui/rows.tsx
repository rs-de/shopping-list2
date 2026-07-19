import { type Handle, on, ref } from "remix/ui"

import type { T } from "../../../i18n.ts"
import type { Article } from "../../../utils/articles.ts"

type EditableArticleRowProps = {
	article: Article
	checked: boolean
	t: T
	onToggle: (id: string, checked: boolean) => void
	onTextInput: (id: string, text: string) => void
	onTextSubmit: (id: string, text: string) => void
}

/** Used by articles + plan mode (both allow editing article text). */
export function EditableArticleRow(handle: Handle<EditableArticleRowProps>) {
	return () => {
		const { article, checked, t, onToggle, onTextInput, onTextSubmit } =
			handle.props
		return (
			<li class={`sl-item${checked ? " sl-item--checked" : ""}`}>
				<form
					method="post"
					mix={on<HTMLFormElement>("submit", (e) => {
						e.preventDefault()
						const text = (
							(e as unknown as SubmitEvent).target as HTMLFormElement
						).elements.namedItem("text") as HTMLInputElement
						onTextSubmit(article.id, text.value)
					})}
				>
					<input type="hidden" name="_action" value="changeArticle" />
					<input type="hidden" name="id" value={article.id} />
					<input
						type="text"
						name="text"
						class="sl-item-input"
						defaultValue={article.text}
						maxLength={75}
						autoComplete="off"
						enterKeyHint="done"
						aria-label={t("Article text")}
						mix={[
							ref((node) => {
								;(node as HTMLInputElement).value = article.text
							}),
							on("input", (e) => {
								onTextInput(
									article.id,
									(e.currentTarget as HTMLInputElement).value,
								)
							}),
						]}
					/>
				</form>
				<label class="sl-item-check">
					<input
						type="checkbox"
						aria-label={t("Select article")}
						name="selected"
						value={article.id}
						form="articles-form"
						checked={checked}
						mix={on("change", (e) => {
							onToggle(
								article.id,
								(e.currentTarget as HTMLInputElement).checked,
							)
						})}
					/>
				</label>
			</li>
		)
	}
}

type CheckoffArticleRowProps = {
	article: Article
	checked: boolean
	t: T
	onToggle: (id: string, checked: boolean) => void
}

/**
 * Used by shopping mode only. Plain text, not a disabled/readonly input —
 * a disabled input still looks and half-behaves like an editable control
 * (cursor, focus quirks, mobile keyboard flash risk), which is exactly the
 * accidental-edit confusion this mode exists to avoid.
 */
export function CheckoffArticleRow(handle: Handle<CheckoffArticleRowProps>) {
	return () => {
		const { article, checked, t, onToggle } = handle.props
		return (
			<li class={`sl-item${checked ? " sl-item--checked" : ""}`}>
				<span class="sl-item-text">{article.text}</span>
				<label class="sl-item-check">
					<input
						type="checkbox"
						aria-label={t("Select article")}
						name="selected"
						value={article.id}
						form="articles-form"
						checked={checked}
						mix={on("change", (e) => {
							onToggle(
								article.id,
								(e.currentTarget as HTMLInputElement).checked,
							)
						})}
					/>
				</label>
			</li>
		)
	}
}
