type Attribute = {
	name: string;
	value: string | number | boolean;
};

type Data = { [k: string]: FormDataEntryValue };

type Callback = (data: Data) => void;

export class Controls {
	name: string;
	el: HTMLFormElement;
	attributes: Attribute[];
	callback: Callback;

	constructor(name: string, el: HTMLFormElement, callback: Callback) {
		this.name = name;
		this.el = el;
		this.callback = callback;

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

		this.loadData();
		this.applyData();
		this.persistData();

		this.el.addEventListener("change", () => {
			this.applyData();
			this.persistData();
		});
	}

	loadData(): void {
		const str = localStorage.getItem(this.name);
		const obj = JSON.parse(str || "{}") as { [k: string]: FormDataEntryValue };

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
		localStorage.setItem(this.name, JSON.stringify(this.readData()));
	}

	applyData() {
		this.callback(this.readData());
	}

	toggleDisable(toggle = true): void {
		Array.from(this.el.elements).forEach((element) => {
			const input = element as HTMLInputElement | HTMLSelectElement;
			input.disabled = toggle;
		});
	}
}
