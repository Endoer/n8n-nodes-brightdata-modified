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

// Resource check and operations remain the same
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

					let countriesToTry = [primaryCountry];
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

							if (!responseData || responseData === '') {
								throw new NodeOperationError(this.getNode(), 'Raw response is empty');
							}

							const executionData = this.helpers.returnJsonArray(responseData);
							const processedEntries: INodeExecutionData[] = [];

							for (const entry of executionData) {
								if (typeof entry.json !== 'object' || entry.json === null) {
									entry.json = { body: entry.json };
								}

								// IF BODY IS EMPTY -> FAIL THIS COUNTRY
								if (!entry.json.body && !entry.json.data && !entry.json.html) {
									throw new NodeOperationError(this.getNode(), 'Parsed content is empty');
								}

								entry.json.country_code = country;
								entry.json.version_check = "1.1.5-final";
								processedEntries.push(entry);
							}

							// If we reached here, data is NOT empty
							if (workingCountry !== country) {
								workingCountry = country;
								if (usePersistence) {
									workflowStaticData.lastWorkingCountry = country;
								}
							}

							returnData.push(...processedEntries);
							success = true;
							break;

						} catch (error) {
							lastError = error;
						}
					}

					if (!success) {
						throw lastError || new NodeOperationError(this.getNode(), 'All countries failed to return data');
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
