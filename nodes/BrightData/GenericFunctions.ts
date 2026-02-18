import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
} from 'n8n-workflow';

export async function brightdataApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	method: string,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
	headers: IDataObject = {},
	option: IDataObject = {},
): Promise<any> {
	endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

	const options: any = {
		method,
		body,
		qs: query,
		url: `https://api.brightdata.com${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...headers,
		},
		json: true,
		...option,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'brightdataApi', options);
	} catch (error) {
		throw error;
	}
}
