import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import { webUnlockerFields, webUnlockerOperations } from './WebUnlockerDescription';
import {
	marketplaceDatasetFields,
	marketplaceDatasetOperations,
} from './MarketplaceDatasetDescription';
import { webScrapperFields, webScrapperOperations } from './WebScrapperDescription';
import { getActiveZones, getCountries, getDataSets } from './SearchFunctions';
import { brightdataApiRequest } from './GenericFunctions';

/**
 * Returns true if the value is "empty" in the context of a BrightData response.
 * - null/undefined/false
 * - Empty string or string that is just whitespace/HTML tags
 * - Empty array or array where every element is "empty"
 * - Empty object or object where every value is "empty"
 */
function isEmptyResponse(data: unknown): boolean {
	if (data === null || data === undefined || data === false) {
		return true;
	}

	if (typeof data === 'string') {
		const html = data.trim();
		if (html === '') return true;

		// If it looks like HTML, focus on the body content first
		let textToStrip = html;
		if (html.toLowerCase().includes('<body')) {
			const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
			if (bodyMatch) {
				textToStrip = bodyMatch[1];
			} else {
				// Has body tag but can't match? Treat as suspicious/empty
				return true;
			}
		}

		const stripped = textToStrip
			.replace(/<script[\s\S]*?<\/script>/gi, '')
			.replace(/<style[\s\S]*?<\/style>/gi, '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

		return stripped.length === 0;
	}

	if (Array.isArray(data)) {
		if (data.length === 0) return true;
		// If every element in the array is "empty", the whole response is empty
		return data.every((item) => isEmptyResponse(item));
	}

	if (typeof data === 'object') {
		const obj = data as Record<string, unknown>;
		if (obj.error) return true;

		const keys = Object.keys(obj);
		if (keys.length === 0) return true;

		// If it's just a status object like { "status": 200 } without other data
		if (keys.length === 1 && (keys[0] === 'status' || keys[0] === 'statusCode' || keys[0] === 'success')) {
			return true;
		}

		// Recursively check all values. If ALL are empty, the object is empty for us.
		// (e.g., { "data": "", "html": "   " } should be treated as empty)
		return keys.every((key) => {
			// Skip status fields when checking if there's *any* real content
			if (['status', 'statusCode', 'success', 'country_code'].includes(key)) return true;
			return isEmptyResponse(obj[key]);
		});
	}

	return false;
}

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
		],
	};

	methods = {
		listSearch: {
			getActiveZones: getActiveZones,
			getCountries: getCountries,
			getDataSets: getDataSets,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		if (resource === 'webUnlocker') {
			const usePersistence = this.getNodeParameter('usePersistence', 0, false) as boolean;
			const workflowStaticData = this.getWorkflowStaticData('node');
			let workingCountry = (usePersistence && workflowStaticData.lastWorkingCountry) as
				| string
				| undefined;

			for (let i = 0; i < items.length; i++) {
				try {
					const rotateCountries = this.getNodeParameter('rotateCountries', i, false) as boolean;
					const primaryCountryData = this.getNodeParameter('country', i) as { value: string };
					const primaryCountry = primaryCountryData.value;
					const zoneData = this.getNodeParameter('zone', i) as { value: string };
					const zone = zoneData.value;

					// Build list of countries to try
					let countriesToTry = [primaryCountry];

					// If we have a remembered working country, put it at the very top
					if (workingCountry) {
						countriesToTry = [workingCountry, ...countriesToTry.filter((c) => c !== workingCountry)];
					}

					if (rotateCountries) {
						const additionalCountriesStr = this.getNodeParameter('additionalCountries', i, '') as string;
						if (additionalCountriesStr) {
							const extras = additionalCountriesStr
								.split(/[ ,;]+/)
								.map((c) => c.trim())
								.filter((c) => c);
							countriesToTry = [...new Set([...countriesToTry, ...extras])];
						}
					}

					let lastError: any;
					let success = false;
					for (const country of countriesToTry) {
						try {
							let body: IDataObject = {};
							if (operation === 'request') {
								const method = this.getNodeParameter('method', i) as string;
								const url = this.getNodeParameter('url', i) as string;
								const format = this.getNodeParameter('format', i) as string;
								const dataFormat = this.getNodeParameter('data_format', i, '') as string;
								body = {
									zone,
									country,
									method,
									url,
									format: dataFormat === 'markdown' ? 'raw' : format,
								};
								if (dataFormat) {
									body.data_format = dataFormat;
								}
							} else if (operation === 'WebSearch') {
								const query = this.getNodeParameter('query', i) as string;
								const page = this.getNodeParameter('page', i, 1) as number;
								const url = `https://www.google.com/search?q=${encodeURIComponent(
									query,
								)}&start=${(page - 1) * 10}&brd_json=1`;
								body = {
									zone,
									country,
									url,
									format: 'raw',
								};
							}

							const responseData = await brightdataApiRequest.call(this, 'POST', '/request', body);

							// Treat empty / empty-HTML response as a failure — try next country
							if (isEmptyResponse(responseData)) {
								throw new NodeOperationError(
									this.getNode(),
									`Empty response received for country "${country}" — will try next country`,
								);
							}

							// Update global working country if it changed and request succeeded
							if (workingCountry !== country) {
								workingCountry = country;
								if (usePersistence) {
									workflowStaticData.lastWorkingCountry = country;
								}
							}

							const executionData = this.helpers.returnJsonArray(responseData);
							for (const entry of executionData) {
								if (typeof entry.json !== 'object' || entry.json === null) {
									entry.json = { data: entry.json };
								}
								entry.json.country_code = country;
								returnData.push(entry);
							}
							success = true;
							break;
						} catch (error) {
							lastError = error;
						}
					}
					if (!success) {
						throw lastError;
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: error.message } });
						continue;
					}
					throw error;
				}
			}
			return [returnData];
		} else {
			return await (this.helpers as any).executeRouting.call(this);
		}
	}
}
