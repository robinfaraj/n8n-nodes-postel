// Runs the built nodes with a stand-in for n8n's runtime. The live tests call a
// Postel API (a local dev server or a test workspace) when these are set:
//   POSTEL_TEST_URL=http://localhost:3416 POSTEL_TEST_KEY=pstl_... npm test
// Live tests create drafts and scheduled posts in that workspace.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { Postel } = require('../dist/nodes/Postel/Postel.node.js');
const { PostelTrigger } = require('../dist/nodes/PostelTrigger/PostelTrigger.node.js');
const { PostelApi } = require('../dist/credentials/PostelApi.credentials.js');
const { toInstant } = require('../dist/nodes/Postel/shared/transport.js');

const URL = process.env.POSTEL_TEST_URL;
const KEY = process.env.POSTEL_TEST_KEY;
const live = URL && KEY ? it : it.skip;

const node = {
	id: '1',
	name: 'Postel',
	type: 'n8n-nodes-postel.postel',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/** n8n's request helper, applying the credential's own `authenticate` headers. */
async function request(credentials, options) {
	const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
	for (const [name, value] of Object.entries(new PostelApi().authenticate.properties.headers)) {
		headers[name] = String(value)
			.replace(/^=/, '')
			.replace('{{$credentials.apiKey}}', credentials.apiKey);
	}
	const url = new globalThis.URL(options.url);
	for (const [k, v] of Object.entries(options.qs ?? {})) url.searchParams.set(k, String(v));
	const res = await fetch(url, {
		method: options.method,
		headers,
		...(options.body && { body: JSON.stringify(options.body) }),
	});
	return { statusCode: res.status, body: await res.json() };
}

function context(
	params,
	{
		credentials = { apiKey: KEY, baseUrl: URL },
		mode = 'trigger',
		staticData = {},
		send = (options) => request(credentials, options),
	} = {},
) {
	const helpers = {
		httpRequestWithAuthentication: (_name, options) => send(options),
		returnJsonArray: (data) => [data].flat().map((json) => ({ json })),
		constructExecutionMetaData: (items) => items,
	};
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getTimezone: () => 'Europe/Berlin',
		getCredentials: async () => credentials,
		getNode: () => node,
		getExecutionId: () => 'exec-1',
		continueOnFail: () => false,
		getMode: () => mode,
		getWorkflowStaticData: () => staticData,
		helpers,
	};
}

const run = (params) => new Postel().execute.call(context(params));
const json = (output) => output[0].map((item) => item.json);

describe('toInstant', () => {
	it('reads a date without a zone in the workflow timezone', () => {
		assert.equal(toInstant('2026-11-03T09:30:00', 'Europe/Berlin'), '2026-11-03T08:30:00.000Z');
		assert.equal(toInstant('2026-07-03T09:30:00', 'Europe/Berlin'), '2026-07-03T07:30:00.000Z');
		assert.equal(toInstant('2026-11-03T09:30:00', 'America/New_York'), '2026-11-03T14:30:00.000Z');
	});
	it('keeps a date that has a zone', () => {
		assert.equal(
			toInstant('2026-11-03T09:30:00+02:00', 'Europe/Berlin'),
			'2026-11-03T07:30:00.000Z',
		);
		assert.equal(toInstant('2026-11-03T09:30:00Z', 'Asia/Tokyo'), '2026-11-03T09:30:00.000Z');
	});
});

describe('node description', () => {
	it('declares the credential and a polling trigger', () => {
		assert.equal(new Postel().description.credentials[0].name, 'postelApi');
		assert.equal(new PostelTrigger().description.polling, true);
		assert.equal(new PostelApi().test.request.url, '/me');
	});
});

describe('with a stubbed API', () => {
	const event = (n) => ({
		id: `post.published:p${n}`,
		type: 'post.published',
		occurredAt: new Date(Date.UTC(2026, 9, 30, 0, 0, n)).toISOString(),
	});

	it('pages back through a backlog instead of dropping events', async () => {
		// 250 new events since the last poll, served newest first in pages of 100
		const all = Array.from({ length: 250 }, (_, i) => event(1000 - i));
		const calls = [];
		const send = async (options) => {
			calls.push(options.qs);
			const before = options.qs.before;
			const page = all.filter((e) => !before || e.occurredAt <= before).slice(0, options.qs.limit);
			return { statusCode: 200, body: { events: page } };
		};
		const staticData = { since: '2026-10-29T00:00:00.000Z', seen: [] };
		const out = await new PostelTrigger().poll.call(
			context({ event: 'post.published' }, { staticData, send }),
		);
		assert.equal(out[0].length, 250);
		assert.equal(new Set(out[0].map((item) => item.json.id)).size, 250);
		// Oldest first
		assert.equal(out[0][0].json.id, 'post.published:p751');
		assert.ok(calls.length >= 3);
	});

	it('sends an Idempotency-Key per run and item, so retries post once', async () => {
		const sent = [];
		const send = async (options) => {
			sent.push(options);
			return { statusCode: 201, body: { id: 'post-1', status: 'draft' } };
		};
		await new Postel().execute.call(
			context(
				{
					resource: 'post',
					operation: 'create',
					platform: 'x',
					text: 'hi',
					when: 'draft',
					options: {},
				},
				{ send },
			),
		);
		assert.equal(sent[0].headers['Idempotency-Key'], 'n8n:exec-1:1:0');
	});
});

describe('viral posts, stubbed', () => {
	it('writes my take with a key unique to the run, from a post', async () => {
		const sent = [];
		const send = async (options) => {
			sent.push(options);
			return { statusCode: 201, body: { post: { id: 'post-1' }, posts: [], failed: [] } };
		};
		await new Postel().execute.call(
			context(
				{
					resource: 'viralPost',
					operation: 'writeTake',
					takeFrom: 'post',
					viralPostId: 'tw-1',
					answer: '',
					platforms: ['linkedin'],
				},
				{ send },
			),
		);
		assert.ok(sent[0].url.endsWith('/api/v1/viral/takes'));
		assert.deepEqual(sent[0].body, { viralPostId: 'tw-1', answer: '', platforms: ['linkedin'] });
		assert.equal(sent[0].headers['Idempotency-Key'], 'n8n:exec-1:1:0');
	});

	it('passes only the filters that are set', async () => {
		const sent = [];
		const send = async (options) => {
			sent.push(options);
			return { statusCode: 200, body: { posts: [{ id: 'tw-1' }] } };
		};
		const out = await new Postel().execute.call(
			context(
				{
					resource: 'viralPost',
					operation: 'search',
					query: 'pricing',
					network: 'x',
					limit: 5,
					viralFilters: { minOutlierScore: 20, format: '' },
				},
				{ send },
			),
		);
		assert.deepEqual(sent[0].qs, { network: 'x', limit: 5, query: 'pricing', minOutlierScore: 20 });
		assert.equal(json(out)[0].id, 'tw-1');
	});
});

describe('against the Postel API', () => {
	live('finds viral X posts and lists formats for the dropdown', async () => {
		const posts = json(
			await run({
				resource: 'viralPost',
				operation: 'search',
				query: '',
				network: 'x',
				limit: 3,
				viralFilters: { minViews: 0, days: 60 },
			}),
		);
		assert.ok(Array.isArray(posts));
		const formats = await new Postel().methods.loadOptions.getFormats.call(context({}));
		assert.ok(formats.length > 0);
	});

	live('lists channels for the dropdown', async () => {
		const options = await new Postel().methods.loadOptions.getChannels.call(context({}));
		assert.ok(options.some((o) => o.value === 'x'));
	});

	live('saves a thread as a draft', async () => {
		const [post] = json(
			await run({
				resource: 'post',
				operation: 'create',
				platform: 'x',
				text: 'n8n test part one\n---\npart two',
				when: 'draft',
				options: {},
			}),
		);
		assert.equal(post.status, 'draft');
		assert.deepEqual(post.thread, ['n8n test part one', 'part two']);
	});

	live('schedules with a first comment, in the workflow timezone', async () => {
		const [post] = json(
			await run({
				resource: 'post',
				operation: 'create',
				platform: 'linkedin',
				text: `n8n scheduled ${Date.now()}`,
				when: 'schedule',
				scheduledAt: `2099-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}T09:${10 + Math.floor(Math.random() * 49)}:00`,
				options: { firstComment: 'More at postel.app' },
			}),
		);
		assert.equal(post.status, 'scheduled');
		assert.equal(post.firstComment, 'More at postel.app');
	});

	live("shows Postel's own sentence when something is refused", async () => {
		await assert.rejects(
			run({ resource: 'post', operation: 'publish', postId: 'does-not-exist' }),
			/no post with this id/,
		);
	});

	live('turns a bad key into a clear error', async () => {
		await assert.rejects(
			new Postel().execute.call(
				context(
					{ resource: 'channel', operation: 'getAll' },
					{ credentials: { apiKey: 'pstl_wrong', baseUrl: URL } },
				),
			),
			/API key isn't valid/,
		);
	});

	live('pages through posts', async () => {
		const posts = json(
			await run({ resource: 'post', operation: 'getAll', returnAll: false, limit: 3, filters: {} }),
		);
		assert.equal(posts.length, 3);
	});

	live('trigger: remembers on the first poll, then sends only new events', async () => {
		const staticData = {};
		const trigger = new PostelTrigger();
		const params = { event: 'post.failed' };
		assert.equal(await trigger.poll.call(context(params, { staticData })), null);
		assert.ok(Array.isArray(staticData.seen));
		// Nothing new since: no run
		assert.equal(await trigger.poll.call(context(params, { staticData })), null);
		// A test run in the editor shows the latest event
		const manual = await trigger.poll.call(context(params, { mode: 'manual' }));
		if (manual) assert.equal(manual[0][0].json.type, 'post.failed');
	});
});
