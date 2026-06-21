import { run } from "remix/ui";

run({
	async loadModule(moduleUrl, exportName) {
		const mod = await import(moduleUrl);
		return mod[exportName];
	},
});
