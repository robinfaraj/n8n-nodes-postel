import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { postelRequest } from '../Postel/shared/transport';

/** Events per request (the API's most). */
const PAGE_SIZE = 100;
/** Pages read in one poll when catching up on a backlog. */
const MAX_PAGES = 10;
/** Event ids already sent, so an event is never sent twice. */
const SEEN_LIMIT = PAGE_SIZE * MAX_PAGES;

interface PollState {
	since?: string;
	seen?: string[];
}

export class PostelTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Postel Trigger',
		name: 'postelTrigger',
		icon: { light: 'file:../../icons/postel.svg', dark: 'file:../../icons/postel.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description:
			'Starts the workflow when a post goes viral in your niche, a Postel post is published or fails, or a new draft is ready',
		defaults: {
			name: 'Postel Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'postelApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				default: 'viral.new',
				options: [
					{
						name: 'Post Published',
						value: 'post.published',
						description: 'A post went out on its network',
					},
					{
						name: 'Post Failed',
						value: 'post.failed',
						description: 'A post could not be published. It is back in drafts with the reason.',
					},
					{
						name: 'Draft Ready in Review',
						value: 'draft.ready',
						description: 'Postel wrote a new post for you and it is waiting in Review (Pro plan)',
					},
					{
						name: 'New Viral Post in My Niche',
						value: 'viral.new',
						description:
							'A post or video took off in your niche, as Postel scored it for you (Pro plan). Pair it with Write My Take.',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const state = this.getWorkflowStaticData('node') as PollState;
		const manual = this.getMode() === 'manual';

		// Ask a minute back from the newest event seen: ids dedupe the overlap,
		// and Postel's clock is the only one that counts
		const since = state.since
			? new Date(new Date(state.since).getTime() - 60_000).toISOString()
			: undefined;
		const page = async (before?: string) =>
			(
				(await postelRequest.call(this, 'GET', '/events', undefined, {
					type: event,
					limit: manual ? 1 : PAGE_SIZE,
					...(!manual && since ? { since } : {}),
					...(before ? { before } : {}),
				})) as { events: IDataObject[] }
			).events;

		if (manual) {
			const latest = await page();
			return latest.length ? [this.helpers.returnJsonArray(latest)] : null;
		}

		const firstPoll = state.seen === undefined;
		// Newest first; a full page means there may be more, so page back
		// (`before` is inclusive, ids dedupe the boundary) until caught up.
		// The first poll only needs to see what's there now.
		const events: IDataObject[] = [];
		const ids = new Set<string>();
		let batch = await page();
		for (let pages = 1; ; pages++) {
			for (const item of batch) {
				if (!ids.has(String(item.id))) {
					ids.add(String(item.id));
					events.push(item);
				}
			}
			if (firstPoll || batch.length < PAGE_SIZE || pages >= MAX_PAGES) break;
			const oldest = String(batch[batch.length - 1].occurredAt);
			const next = await page(oldest);
			if (next.every((item) => ids.has(String(item.id)))) break;
			batch = next;
		}

		const seen = new Set(state.seen ?? []);
		const fresh = events.filter((item) => !seen.has(String(item.id)));
		for (const item of fresh) seen.add(String(item.id));
		state.seen = [...seen].slice(-SEEN_LIMIT);
		const newest = events
			.map((item) => String(item.occurredAt))
			.sort()
			.pop();
		if (newest && newest > (state.since ?? '')) state.since = newest;

		// The first poll only remembers what's there, so old posts don't all fire at once
		if (firstPoll || fresh.length === 0) return null;
		// Oldest first, the order they happened in
		return [this.helpers.returnJsonArray(fresh.reverse())];
	}
}
