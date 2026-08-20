import { deleteSynthSettings, loadSynthSettings, saveSynthSettings, SynthSettings } from "./settingsStore.ts";

type Attribute = {
	name: string;
	value: string | number | boolean;
};

type Data = SynthSettings;

type Callback = (data: Data) => void;

export class Controls {
	name: string;
	el: HTMLFormElement;
	attributes: Attribute[];
	callback: Callback;
	ready: Promise<void>; // resolves once the stored values are in the form
	private touched: boolean; // the user got ahead of the stored values

	constructor(name: string, el: HTMLFormElement, callback: Callback) {
		this.name = name;
		this.el = el;
		this.callback = callback;
		this.touched = false;

		this.attributes = Array.from(el.elements).map((element) => {
			const input = element as HTMLInputElement | HTMLSelectElement;
			let value: string | number | boolean;

			if (input.type === "range" || input.type === "number") {
				value = parseFloat(input.value);
			} else if (input.type === "checkbox") {
				value = input.checked;
			} else {
				value = input.value;
			}

			return {
				name: input.name,
				value: value,
			} as Attribute;
		});

		/* listens right away, so nothing typed while the store opens gets lost */
		this.el.addEventListener("input", () => {
			this.touched = true;
			this.applyData();
			this.persistData();
		});

		this.ready = this.init();
	}

	private async init(): Promise<void> {
		await this.loadData();
		this.applyData();
		this.persistData();
	}

	async loadData(): Promise<void> {
		let obj: Data | undefined;

		try {
			obj = await loadSynthSettings(this.name);
		} catch (e) {
			console.error("Could not read the stored controls.", e);
		}

		if (!obj || this.touched) {
			return; // a live edit wins over the stored values
		}

		this.attributes.forEach((attr) => {
			if (obj[attr.name] !== undefined) {
				const input = this.el.elements.namedItem(attr.name) as HTMLInputElement | HTMLSelectElement;
				if (input) {
					if (input.type === "checkbox") {
						input.checked = obj[attr.name] === "true";
					} else {
						input.value = String(obj[attr.name]);
					}
				}
			}
		});
	}

	readData(): Data {
		return Object.fromEntries(new FormData(this.el));
	}

	persistData(): void {
		saveSynthSettings(this.name, this.readData()).catch((e) => console.error("Could not store the controls.", e));
	}

	applyData() {
		this.callback(this.readData());
	}

	forget(): void {
		deleteSynthSettings(this.name).catch((e) => console.error("Could not delete the stored controls.", e));
	}

	toggleDisable(toggle = true): void {
		Array.from(this.el.elements).forEach((element) => {
			const input = element as HTMLInputElement | HTMLSelectElement;
			input.disabled = toggle;
		});
	}
}
