import type { Browser, Locator, Page, Request, Response } from 'playwright-core';
import { chromium } from 'playwright-core';

import { AriaSnapshotFilter, SnapshotElement } from './AriaSnapshotFilter';

type DomainSession = {
	browser: Browser | null;
	page: Page | null;
	browserClosed: boolean;
	requests: Map<Request, Response | null>;
};

export class BrowserSession {
	private readonly cdpEndpoint: string;
	private readonly domainSessions = new Map<string, DomainSession>();
	private currentDomain = 'default';
	private domRefs = new Set<string>();

	constructor({ cdpEndpoint }: { cdpEndpoint: string }) {
		this.cdpEndpoint = cdpEndpoint;
	}

	private getDomain(url: string): string {
		try {
			return new URL(url).hostname;
		} catch (error) {
			console.error(`Error extracting domain from ${url}:`, error);
			return 'default';
		}
	}

	private async getDomainSession(domain: string): Promise<DomainSession> {
		if (!this.domainSessions.has(domain)) {
			this.domainSessions.set(domain, {
				browser: null,
				page: null,
				browserClosed: true,
				requests: new Map(),
			});
		}
		return this.domainSessions.get(domain)!;
	}

	async getBrowser({ domain = 'default' }: { domain?: string } = {}): Promise<Browser> {
		const session = await this.getDomainSession(domain);
		if (session.browser) {
			try {
				await session.browser.contexts();
			} catch (error: any) {
				console.warn(
					`Browser connection lost for domain ${domain} (${error?.message || error}), reconnecting...`,
				);
				session.browser = null;
				session.page = null;
				session.browserClosed = true;
			}
		}

		if (!session.browser) {
			session.browser = await chromium.connectOverCDP(this.cdpEndpoint);
			session.browserClosed = false;
			session.browser.on('disconnected', () => {
				session.browser = null;
				session.page = null;
				session.browserClosed = true;
			});
		}
		return session.browser;
	}

	async getPage({ url }: { url?: string } = {}): Promise<Page> {
		if (url) {
			this.currentDomain = this.getDomain(url);
		}
		const domain = this.currentDomain;
		const session = await this.getDomainSession(domain);
		if (session.browserClosed || !session.page) {
			const browser = await this.getBrowser({ domain });
			const existingContexts = browser.contexts();
			if (existingContexts.length === 0) {
				const context = await browser.newContext();
				session.page = await context.newPage();
			} else {
				const existingPages = existingContexts[0]?.pages();
				if (existingPages && existingPages.length > 0) {
					session.page = existingPages[0];
				} else {
					session.page = await existingContexts[0].newPage();
				}
			}
			session.page.on('request', (request) => session.requests.set(request, null));
			session.page.on('response', (response) => session.requests.set(response.request(), response));
			session.browserClosed = false;
			session.page.once('close', () => {
				session.page = null;
			});
		}
		return session.page;
	}

	async getLocator({
		element,
		ref,
		selector,
	}: {
		element: string;
		ref?: string;
		selector?: string;
	}): Promise<Locator> {
		const page = await this.getPage();
		if (ref) {
			const trimmedRef = ref.trim();
			if (trimmedRef.startsWith('dom-') || this.domRefs.has(trimmedRef)) {
				return page.locator(`[data-fastmcp-ref="${trimmedRef}"]`).first().describe(element);
			}
			return page.locator(`aria-ref=${trimmedRef}`).describe(element);
		}
		if (selector) {
			return page.locator(selector).describe(element);
		}
		throw new Error('Either ref or selector is required to locate an element');
	}

	async captureSnapshot({
		filtered = false,
	}: {
		filtered?: boolean;
	} = {}): Promise<{
		url: string;
		title: string;
		ariaSnapshot: string;
		domSnapshot?: string | null;
	}> {
		const page = await this.getPage();
		try {
			const fullSnapshot = await (page as any)._snapshotForAI();
			if (!filtered) {
				return {
					url: page.url(),
					title: await page.title(),
					ariaSnapshot: fullSnapshot,
				};
			}
			const filteredSnapshot = AriaSnapshotFilter.filterSnapshot(fullSnapshot);
			const domSnapshot = await page.evaluate(() => {
				const doc = (globalThis as any).document;
				const win = (globalThis as any).window;
				const css = (globalThis as any).CSS;
				const selectors = [
					'a[href]',
					'button',
					'input',
					'select',
					'textarea',
					'option',
					'.radio-item',
					'[role]',
					'[tabindex]',
					'[onclick]',
					'[data-spm-click]',
					'[data-click]',
					'[data-action]',
					'[data-spm-anchor-id]',
					'[aria-pressed]',
					'[aria-label]',
					'[aria-haspopup]',
				];
				const nodes = Array.from(doc.querySelectorAll(selectors.join(','))) as any[];
				const elements: Array<{ ref: string; role: string; name: string; url: string }> = [];
				let counter = 0;

				const collapse = (text: string | null | undefined) =>
					(text || '').replace(/\s+/g, ' ').trim();

				const getLabelledby = (el: any) => {
					const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/);
					return ids
						.map((id: string) => {
							const ref = doc.getElementById(id);
							return ref ? collapse(ref.innerText || ref.textContent || '') : '';
						})
						.filter(Boolean)
						.join(' ');
				};

				const getLabelFor = (el: any) => {
					const id = el.id && el.id.trim ? el.id.trim() : '';
					if (!id) {
						return '';
					}
					const escapedId = css?.escape ? css.escape(id) : id;
					const lbl = doc.querySelector(`label[for="${escapedId}"]`);
					return lbl ? collapse(lbl.innerText || lbl.textContent || '') : '';
				};

				const isIntrinsic = (el: any) => {
					const tag = (el.tagName || '').toLowerCase();
					if (['a', 'input', 'button', 'select', 'textarea', 'option'].includes(tag)) {
						return true;
					}
					const role = (el.getAttribute('role') || '').toLowerCase();
					if (['button', 'link', 'radio', 'option', 'tab', 'checkbox', 'menuitem'].includes(role)) {
						return true;
					}
					if (el.classList.contains('radio-item')) {
						return true;
					}
					return (
						el.hasAttribute('onclick') ||
						el.hasAttribute('data-click') ||
						el.hasAttribute('data-action') ||
						el.hasAttribute('data-spm-click') ||
						el.hasAttribute('data-spm-anchor-id')
					);
				};

				const isClickable = (el: any) => {
					const style = win.getComputedStyle(el);
					if (
						style.display === 'none' ||
						style.visibility === 'hidden' ||
						style.pointerEvents === 'none'
					) {
						return false;
					}
					const rect = el.getBoundingClientRect();
					if (!rect || rect.width === 0 || rect.height === 0) {
						return false;
					}
					const centerX = rect.left + rect.width / 2;
					const centerY = rect.top + rect.height / 2;
					if (centerX < 0 || centerX > win.innerWidth || centerY < 0 || centerY > win.innerHeight) {
						return false;
					}
					const topEl = doc.elementFromPoint(centerX, centerY);
					if (topEl && (topEl === el || topEl.contains(el) || el.contains(topEl))) {
						return true;
					}
					return isIntrinsic(el);
				};

				for (const el of nodes) {
					if (!isClickable(el)) {
						continue;
					}

					let name =
						collapse(el.getAttribute('aria-label')) ||
						collapse(getLabelledby(el)) ||
						collapse(el.getAttribute('title')) ||
						collapse(el.getAttribute('alt')) ||
						collapse(el.getAttribute('placeholder')) ||
						collapse(getLabelFor(el));

					if (!name) {
						name = collapse(el.innerText || el.textContent || '');
					}

					if (name.length > 80) {
						name = `${name.slice(0, 77)}...`;
					}

					const url = el.href || el.getAttribute('data-url') || '';

					if (!name && !url) {
						continue;
					}
					const htmlEl = el as any;
					if (!htmlEl.dataset.fastmcpRef) {
						htmlEl.dataset.fastmcpRef = `dom-${++counter}`;
					}
					elements.push({
						ref: htmlEl.dataset.fastmcpRef,
						role: el.getAttribute('role') || (el.tagName || '').toLowerCase(),
						name,
						url: url.toString(),
					});
				}
				return elements;
			});

			this.domRefs = new Set((domSnapshot as SnapshotElement[]).map((el) => el.ref));
			return {
				url: page.url(),
				title: await page.title(),
				ariaSnapshot: filteredSnapshot,
				domSnapshot: AriaSnapshotFilter.formatDomElements(domSnapshot as SnapshotElement[]),
			};
		} catch (error: any) {
			throw new Error(`Error capturing ARIA snapshot: ${error?.message || error}`);
		}
	}

	async clearRequests(): Promise<void> {
		const session = await this.getDomainSession(this.currentDomain);
		session.requests.clear();
	}

	async getRequests(): Promise<Map<Request, Response | null>> {
		const session = await this.getDomainSession(this.currentDomain);
		return session.requests;
	}

	async close(domain?: string | null): Promise<void> {
		if (domain) {
			const session = this.domainSessions.get(domain);
			if (session?.browser) {
				try {
					await session.browser.close();
				} catch (error) {
					console.error(`Error closing browser for domain ${domain}:`, error);
				}
				session.browser = null;
				session.page = null;
				session.browserClosed = true;
				session.requests.clear();
				this.domainSessions.delete(domain);
			}
			return;
		}
		for (const [domainKey, session] of this.domainSessions.entries()) {
			if (session.browser) {
				try {
					await session.browser.close();
				} catch (error) {
					console.error(`Error closing browser for domain ${domainKey}:`, error);
				}
				session.browser = null;
				session.page = null;
				session.browserClosed = true;
				session.requests.clear();
			}
		}
		this.domainSessions.clear();
		this.currentDomain = 'default';
	}
}
