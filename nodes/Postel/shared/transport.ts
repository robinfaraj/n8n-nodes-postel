import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type PostelContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

/**
 * Calls Postel's public API (v1). Postel answers errors as `{ error, code }`
 * where `error` is a sentence the user can act on, so that is what n8n shows.
 */
export async function postelRequest(
	this: PostelContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	itemIndex?: number,
	headers?: Record<string, string>,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('postelApi');
	const baseUrl = String(credentials.baseUrl || 'https://www.postel.app').replace(/\/$/, '');
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'postelApi', {
		method,
		url: `${baseUrl}/api/v1${path}`,
		body,
		qs,
		...(headers && { headers }),
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	})) as { statusCode: number; body: IDataObject | string };

	const data = typeof response.body === 'object' && response.body !== null ? response.body : {};
	if (response.statusCode >= 400) {
		const message =
			typeof data.error === 'string'
				? data.error
				: `Postel answered with HTTP ${response.statusCode}`;
		throw new NodeApiError(this.getNode(), data as JsonObject, {
			message,
			description: typeof data.code === 'string' ? `Postel error code: ${data.code}` : undefined,
			httpCode: String(response.statusCode),
			itemIndex,
		});
	}
	return data;
}

/**
 * n8n date fields come without a timezone ("2026-11-03T09:30:00") and mean
 * the workflow's timezone. Postel needs an exact instant, so the offset is
 * added here. Values that already carry one pass through.
 */
export function toInstant(value: string, timeZone: string): string {
	const trimmed = value.trim();
	if (/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) return new Date(trimmed).toISOString();
	const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
	if (!match) return trimmed;
	const [, y, mo, d, h, mi, s = '0'] = match;
	const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
	// The zone's offset at that moment, read back through Intl
	const offsetAt = (instant: number) => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		}).formatToParts(new Date(instant));
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
		const wall = Date.UTC(
			get('year'),
			get('month') - 1,
			get('day'),
			get('hour'),
			get('minute'),
			get('second'),
		);
		return wall - instant;
	};
	const first = asUtc - offsetAt(asUtc);
	// Second pass settles times next to a daylight-saving change
	return new Date(asUtc - offsetAt(first)).toISOString();
}
