// LICENSE_CODE ZON
export type SnapshotElement = {
	ref: string;
	role: string;
	name: string;
	url: string | null;
};

export class AriaSnapshotFilter {
	static INTERACTIVE_ROLES = new Set([
		'button',
		'link',
		'textbox',
		'searchbox',
		'combobox',
		'checkbox',
		'radio',
		'switch',
		'slider',
		'tab',
		'menuitem',
		'option',
	]);

	static parsePlaywrightSnapshot(snapshotText: string): SnapshotElement[] {
		const lines = snapshotText.split('\n');
		const elements: SnapshotElement[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || !trimmed.startsWith('-')) {
				continue;
			}
			const refMatch = trimmed.match(/\[ref=([^\]]+)\]/);
			if (!refMatch) {
				continue;
			}
			const ref = refMatch[1];
			const roleMatch = trimmed.match(/^-\s+([a-zA-Z]+)/);
			if (!roleMatch) {
				continue;
			}
			const role = roleMatch[1];
			if (!this.INTERACTIVE_ROLES.has(role)) {
				continue;
			}
			const nameMatch = trimmed.match(/"([^"]*)"/);
			const name = nameMatch ? nameMatch[1] : '';

			let url: string | null = null;
			const nextLineIndex = lines.indexOf(line) + 1;
			if (nextLineIndex < lines.length) {
				const nextLine = lines[nextLineIndex];
				const urlMatch = nextLine.match(/\/url:\s*(.+)/);
				if (urlMatch) {
					url = urlMatch[1].trim().replace(/^["']|["']$/g, '');
				}
			}
			elements.push({ ref, role, name, url });
		}
		return elements;
	}

	static formatCompact(elements: SnapshotElement[]): string {
		const lines: string[] = [];
		for (const el of elements) {
			const parts: string[] = [`[${el.ref}]`, el.role];
			if (el.name && el.name.length > 0) {
				const name = el.name.length > 60 ? `${el.name.substring(0, 57)}...` : el.name;
				parts.push(`"${name}"`);
			}
			if (el.url && el.url.length > 0 && !el.url.startsWith('#')) {
				let url = el.url;
				if (url.length > 50) {
					url = `${url.substring(0, 47)}...`;
				}
				parts.push(`-> ${url}`);
			}
			lines.push(parts.join(' '));
		}
		return lines.join('\n');
	}

	static filterSnapshot(snapshotText: string): string {
		try {
			const elements = this.parsePlaywrightSnapshot(snapshotText);
			if (elements.length === 0) {
				return 'No interactive elements found';
			}
			return this.formatCompact(elements);
		} catch (error: any) {
			return `Error filtering snapshot: ${error?.message || error}\n${error?.stack || ''}`;
		}
	}

	static formatDomElements(elements: SnapshotElement[] | null): string | null {
		if (!elements || elements.length === 0) {
			return null;
		}
		const lines: string[] = [];
		for (const el of elements) {
			const parts: string[] = [`[${el.ref}]`, el.role || 'unknown'];
			if (el.name && el.name.length > 0) {
				const name = el.name.length > 60 ? `${el.name.substring(0, 57)}...` : el.name;
				parts.push(`"${name}"`);
			}
			if (el.url && el.url.length > 0 && !el.url.startsWith('#')) {
				let url = el.url;
				if (url.length > 50) {
					url = `${url.substring(0, 47)}...`;
				}
				parts.push(`-> ${url}`);
			}
			lines.push(parts.join(' '));
		}
		return lines.join('\n');
	}
}
