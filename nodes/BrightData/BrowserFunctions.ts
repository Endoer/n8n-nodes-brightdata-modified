import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { BrowserSession } from './BrowserSession';

type BrightDataRequestContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

const BROWSER_SESSION_KEY = 'brightdata_browser_sessions';
const DEFAULT_BROWSER_ZONE = 'n8n_browser';

type ManagedBrowserSession = {
	session: BrowserSession;
	zone: string;
	country?: string | null;
};

type ZoneSearchItem = {
	name: string;
	type?: string;
};

type ZoneSearchResponse = ZoneSearchItem[];

const activeSessions = new Map<string, ManagedBrowserSession>();

export async function closeBrowserSession(
	this: IExecuteFunctions,
	sessionId?: string,
): Promise<void> {
	const id = sessionId || 'default';
	const existing = activeSessions.get(id);
	if (existing) {
		await existing.session.close();
		activeSessions.delete(id);
	}
	setBrowserSessionState.call(this, id, undefined);
}

export type BrowserSessionState = {
	sessionId: string;
	zone: string;
	country?: string | null;
	createdAt: string;
};

async function brightDataRequest<T>(
	this: BrightDataRequestContext,
	options: IHttpRequestOptions,
): Promise<T> {
	return (await this.helpers.requestWithAuthentication.call(this, 'brightdataApi', {
		json: true,
		...options,
	})) as T;
}

export async function getCustomerId(this: BrightDataRequestContext): Promise<string> {
	const response = (await brightDataRequest.call(this, {
		method: 'GET',
		url: 'https://api.brightdata.com/status',
	})) as { customer?: string };
	if (!response?.customer) {
		throw new Error('Failed to resolve Bright Data customer id');
	}
	return response.customer;
}

export async function getZonePassword(
	this: BrightDataRequestContext,
	zone: string,
): Promise<string> {
	try {
		const response = (await brightDataRequest.call(this, {
			method: 'GET',
			url: `https://api.brightdata.com/zone/passwords?zone=${encodeURIComponent(zone)}`,
		})) as { passwords?: string[] };
		const password = response?.passwords?.[0];
		if (!password) {
			throw new Error('No passwords returned for zone');
		}
		return password;
	} catch (error: any) {
		const statusCode = error?.httpCode ?? error?.statusCode;
		if (statusCode === 422) {
			throw new Error(`Browser zone '${zone}' does not exist`);
		}
		throw new Error(`Error retrieving browser credentials: ${error?.message || error}`);
	}
}

export async function ensureBrowserZoneExists(
	this: BrightDataRequestContext,
	zone: string,
): Promise<void> {
	const zones = (await brightDataRequest.call(this, {
		method: 'GET',
		url: 'https://api.brightdata.com/zone/get_active_zones',
	})) as ZoneSearchResponse;
	const hasZone = zones.some((item) => item.name === zone);
	if (hasZone) {
		return;
	}
	await brightDataRequest.call(this, {
		method: 'POST',
		url: 'https://api.brightdata.com/zone',
		body: {
			zone: { name: zone, type: 'browser_api' },
			plan: { type: 'browser_api' },
		},
	});
}

export async function calculateCdpEndpoint(
	this: BrightDataRequestContext,
	zone: string,
	country?: string,
): Promise<string> {
	await ensureBrowserZoneExists.call(this, zone);
	const customer = await getCustomerId.call(this);
	const password = await getZonePassword.call(this, zone);
	const normalizedCountry = country ? country.toLowerCase() : '';
	const countrySuffix = normalizedCountry ? `-country-${normalizedCountry}` : '';
	return `wss://brd-customer-${customer}-zone-${zone}${countrySuffix}:${password}@brd.superproxy.io:9222`;
}

export function getDefaultBrowserZone(): string {
	return process.env.BROWSER_ZONE || DEFAULT_BROWSER_ZONE;
}

export function getBrowserSessionState(
	this: IExecuteFunctions,
	sessionId = 'default',
): BrowserSessionState | undefined {
	const data = this.getWorkflowStaticData('global') as Record<string, unknown>;
	const sessions = (data[BROWSER_SESSION_KEY] || {}) as Record<string, BrowserSessionState>;
	return sessions[sessionId];
}

export function setBrowserSessionState(
	this: IExecuteFunctions,
	sessionId: string,
	state?: BrowserSessionState,
): void {
	const data = this.getWorkflowStaticData('global') as Record<string, unknown>;
	const sessions = (data[BROWSER_SESSION_KEY] || {}) as Record<string, BrowserSessionState>;
	if (state) {
		sessions[sessionId] = state;
	} else {
		delete sessions[sessionId];
	}
	data[BROWSER_SESSION_KEY] = sessions;
}

export async function getOrCreateBrowserSession(
	this: IExecuteFunctions,
	options: { sessionId?: string; zone?: string; country?: string | null },
): Promise<BrowserSession> {
	const sessionId = options.sessionId || 'default';
	const existing = activeSessions.get(sessionId);
	const zone = options.zone || existing?.zone || getDefaultBrowserZone();
	const normalizedCountry =
		options.country !== undefined && options.country !== null
			? options.country.toLowerCase()
			: (existing?.country ?? null);

	if (!existing || existing.zone !== zone || existing.country !== normalizedCountry) {
		if (existing) {
			await existing.session.close();
		}
		const cdpEndpoint = await calculateCdpEndpoint.call(this, zone, normalizedCountry || undefined);
		const session = new BrowserSession({ cdpEndpoint });
		activeSessions.set(sessionId, { session, zone, country: normalizedCountry });
		setBrowserSessionState.call(this, sessionId, {
			sessionId,
			zone,
			country: normalizedCountry,
			createdAt: new Date().toISOString(),
		});
	}

	return activeSessions.get(sessionId)!.session;
}
