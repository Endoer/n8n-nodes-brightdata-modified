import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { webUnlockerOperations, webUnlockerFields } from './WebUnlockerDescription';
import {
	marketplaceDatasetOperations,
	marketplaceDatasetFields,
} from './MarketplaceDatasetDescription';
import { webScrapperOperations, webScrapperFields } from './WebScrapperDescription';
import { browserOperations, browserFields } from './BrowserDescription';
import { getActiveZones, getCountries, getDataSets } from './SearchFunctions';
import {
	closeBrowserSession,
	getDefaultBrowserZone,
	getOrCreateBrowserSession,
} from './BrowserFunctions';

const resolveZone = (value: unknown): string | undefined => {
	if (!value) {
		return undefined;
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'object' && value !== null && 'value' in value) {
		const zoneValue = (value as { value?: string }).value;
		return typeof zoneValue === 'string' ? zoneValue : undefined;
	}
	return undefined;
};

export class BrightData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BrightData',
		name: 'brightData',
		icon: 'file:brightdatasquared.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Interact with Bright Data to scrape websites or use existing datasets from the marketplace to generate adapted snapshots',
		defaults: {
			name: 'BrightData',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'brightdataApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://api.brightdata.com',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Marketplace Dataset',
						value: 'marketplaceDataset',
					},
					{
						name: 'Browser',
						value: 'browser',
					},
					{
						name: 'Web Scraper',
						value: 'webScrapper',
					},
					{
						name: 'Web Unlocker',
						value: 'webUnlocker',
					},
				],
				default: 'webUnlocker',
			},
			...webUnlockerOperations,
			...webUnlockerFields,
			...marketplaceDatasetOperations,
			...marketplaceDatasetFields,
			...webScrapperOperations,
			...webScrapperFields,
			...browserOperations,
			...browserFields,
		],
	};

	methods = {
		listSearch: {
			getActiveZones: getActiveZones,
			getCountries: getCountries,
			getDataSets: getDataSets,
		},
	};

	customOperations = {
		browser: {
			navigate: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const url = this.getNodeParameter('url', i) as string;
					const countryRaw = (this.getNodeParameter('country', i) as string) || '';
					const country = countryRaw.trim() ? countryRaw.trim() : undefined;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
							country,
						});
						const page = await session.getPage({ url });
						await session.clearRequests();
						await page.goto(url, { timeout: 120000, waitUntil: 'domcontentloaded' });
						returnData.push({
							json: {
								message: `Successfully navigated to ${page.url()}`,
								title: await page.title(),
								url: page.url(),
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			goBack: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						await page.goBack();
						returnData.push({
							json: {
								message: 'Successfully navigated back',
								title: await page.title(),
								url: page.url(),
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			goForward: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						await page.goForward();
						returnData.push({
							json: {
								message: 'Successfully navigated forward',
								title: await page.title(),
								url: page.url(),
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			scroll: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						await page.evaluate(() => {
							const win = (globalThis as any).window;
							const doc = (globalThis as any).document;
							win.scrollTo(0, doc.body.scrollHeight);
						});
						returnData.push({
							json: {
								message: 'Successfully scrolled to the bottom of the page',
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			click: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const element = this.getNodeParameter('element', i) as string;
					const ref = (this.getNodeParameter('ref', i) as string) || '';
					const selector = (this.getNodeParameter('selector', i) as string) || '';
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const locator = await session.getLocator({
							element,
							ref: ref.trim() ? ref.trim() : undefined,
							selector: selector.trim() ? selector.trim() : undefined,
						});
						await locator.click({ timeout: 5000 });
						returnData.push({
							json: {
								message: `Successfully clicked element: ${element}`,
								ref: ref.trim() || undefined,
								selector: selector.trim() || undefined,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			type: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const element = this.getNodeParameter('element', i) as string;
					const ref = (this.getNodeParameter('ref', i) as string) || '';
					const selector = (this.getNodeParameter('selector', i) as string) || '';
					const text = this.getNodeParameter('text', i) as string;
					const submit = this.getNodeParameter('submit', i) as boolean;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const locator = await session.getLocator({
							element,
							ref: ref.trim() ? ref.trim() : undefined,
							selector: selector.trim() ? selector.trim() : undefined,
						});
						await locator.fill(text);
						if (submit) {
							await locator.press('Enter');
						}
						returnData.push({
							json: {
								message: `Successfully typed into element: ${element}`,
								submitted: submit,
								ref: ref.trim() || undefined,
								selector: selector.trim() || undefined,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			scrollToElement: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const element = this.getNodeParameter('element', i) as string;
					const ref = (this.getNodeParameter('ref', i) as string) || '';
					const selector = (this.getNodeParameter('selector', i) as string) || '';
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const locator = await session.getLocator({
							element,
							ref: ref.trim() ? ref.trim() : undefined,
							selector: selector.trim() ? selector.trim() : undefined,
						});
						await locator.scrollIntoViewIfNeeded();
						returnData.push({
							json: {
								message: `Successfully scrolled to element: ${element}`,
								ref: ref.trim() || undefined,
								selector: selector.trim() || undefined,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			waitForElement: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const element = this.getNodeParameter('element', i) as string;
					const ref = (this.getNodeParameter('ref', i) as string) || '';
					const selector = (this.getNodeParameter('selector', i) as string) || '';
					const timeout = this.getNodeParameter('timeout', i) as number;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const locator = await session.getLocator({
							element,
							ref: ref.trim() ? ref.trim() : undefined,
							selector: selector.trim() ? selector.trim() : undefined,
						});
						await locator.waitFor({ timeout: timeout || 30000 });
						returnData.push({
							json: {
								message: `Successfully waited for element: ${element}`,
								timeout: timeout || 30000,
								ref: ref.trim() || undefined,
								selector: selector.trim() || undefined,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			screenshot: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const fullPage = this.getNodeParameter('full_page', i) as boolean;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						const buffer = await page.screenshot({ fullPage });
						const binaryPropertyName = 'screenshot';
						const binaryData = await this.helpers.prepareBinaryData(
							buffer,
							'screenshot.png',
							'image/png',
						);
						returnData.push({
							json: {
								message: 'Screenshot captured',
								fullPage,
							},
							binary: {
								[binaryPropertyName]: binaryData,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			getHtml: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const fullPage = this.getNodeParameter('full_page', i) as boolean;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						let html = '';
						if (!fullPage) {
							html = await page.$eval('body', (body) => body.innerHTML);
						} else {
							html = await page.content();
						}
						returnData.push({
							json: {
								html,
								fullPage,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			getText: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const page = await session.getPage();
						const text = await page.$eval('body', (body) => body.innerText);
						returnData.push({
							json: {
								text,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			getSnapshot: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const filtered = this.getNodeParameter('filtered', i) as boolean;
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const snapshot = await session.captureSnapshot({ filtered });
						returnData.push({
							json: snapshot,
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			fillForm: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const fieldsParam = this.getNodeParameter('fields', i) as {
						field?: Array<{
							name: string;
							type: string;
							ref: string;
							value: string;
						}>;
					};
					const fields = fieldsParam?.field || [];
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();

					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const results: string[] = [];

						for (const field of fields) {
							const locator = await session.getLocator({
								element: field.name,
								ref: field.ref,
							});
							if (field.type === 'textbox' || field.type === 'slider') {
								await locator.fill(field.value);
								results.push(`Filled ${field.name} with "${field.value}"`);
							} else if (field.type === 'checkbox' || field.type === 'radio') {
								const checked = field.value === 'true';
								await locator.setChecked(checked);
								results.push(`Set ${field.name} to ${checked ? 'checked' : 'unchecked'}`);
							} else if (field.type === 'combobox') {
								await locator.selectOption({ label: field.value });
								results.push(`Selected "${field.value}" in ${field.name}`);
							}
						}

						returnData.push({
							json: {
								message: 'Successfully filled form',
								results,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			getNetworkRequests: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || undefined;
					const zone = resolveZone(this.getNodeParameter('zone', i)) || getDefaultBrowserZone();
					try {
						const session = await getOrCreateBrowserSession.call(this, {
							sessionId,
							zone,
						});
						const requests = await session.getRequests();
						const results: Array<{
							method: string;
							url: string;
							status?: number;
							statusText?: string;
						}> = [];

						requests.forEach((response, request) => {
							const result = {
								method: request.method().toUpperCase(),
								url: request.url(),
							} as {
								method: string;
								url: string;
								status?: number;
								statusText?: string;
							};
							if (response) {
								result.status = response.status();
								result.statusText = response.statusText();
							}
							results.push(result);
						});

						returnData.push({
							json: {
								total: results.length,
								requests: results,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
			closeSession: async function (this: IExecuteFunctions) {
				const items = this.getInputData();
				const returnData = [];

				for (let i = 0; i < items.length; i++) {
					const sessionId = (this.getNodeParameter('sessionId', i) as string) || 'default';
					try {
						await closeBrowserSession.call(this, sessionId);
						returnData.push({
							json: {
								message: `Closed browser session ${sessionId}`,
								sessionId,
							},
						});
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}

				return [returnData];
			},
		},
	};
}
