import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { postDescription } from './descriptions';
import { viralPostDescription } from './viralDescriptions';
import { postelRequest, toInstant } from './shared/transport';

export class Postel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Postel',
		name: 'postel',
		icon: { light: 'file:../../icons/postel.svg', dark: 'file:../../icons/postel.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Find viral posts in your niche, write your take in your voice, and schedule or publish posts to X, LinkedIn, Bluesky and Mastodon',
		defaults: {
			name: 'Postel',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'postelApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Post', value: 'post' },
					{ name: 'Viral Post', value: 'viralPost' },
					{ name: 'Channel', value: 'channel' },
				],
				default: 'post',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['channel'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the networks you can post to, and which are connected',
						action: 'Get many channels',
					},
				],
				default: 'getAll',
			},
			...postDescription,
			...viralPostDescription,
		],
	};

	methods = {
		loadOptions: {
			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { channels } = (await postelRequest.call(this, 'GET', '/channels')) as {
					channels: Array<{ id: string; label: string }>;
				};
				// Connected channels come first, labelled with their account
				return channels.map((channel) => ({ name: channel.label, value: channel.id }));
			},
			async getFormats(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { formats } = (await postelRequest.call(this, 'GET', '/viral/formats')) as {
					formats: Array<{ id: string; name: string; question: string }>;
				};
				return formats.map((format) => ({
					name: format.name,
					value: format.id,
					description: format.question,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const timeZone = this.getTimezone();
		// One key per item of this run: n8n's "Retry On Fail" sends the same
		// request again, and Postel answers it with the first result
		const idempotencyKey = (i: number) => ({
			'Idempotency-Key': `n8n:${this.getExecutionId()}:${this.getNode().id}:${i}`,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				let result: IDataObject | IDataObject[];

				if (resource === 'viralPost') {
					if (operation === 'search') {
						const filters = this.getNodeParameter('viralFilters', i, {}) as IDataObject;
						const { posts } = await postelRequest.call(
							this,
							'GET',
							'/viral/posts',
							undefined,
							{
								network: this.getNodeParameter('network', i) as string,
								limit: this.getNodeParameter('limit', i) as number,
								...(this.getNodeParameter('query', i, '')
									? { query: this.getNodeParameter('query', i) }
									: {}),
								...Object.fromEntries(
									Object.entries(filters).filter(
										([, value]) => value !== '' && value !== undefined,
									),
								),
							},
							i,
						);
						result = posts as IDataObject[];
					} else if (operation === 'get') {
						const id = this.getNodeParameter('viralPostId', i) as string;
						result = await postelRequest.call(
							this,
							'GET',
							`/viral/posts/${encodeURIComponent(id)}`,
							undefined,
							undefined,
							i,
						);
					} else {
						const from = this.getNodeParameter('takeFrom', i) as string;
						result = await postelRequest.call(
							this,
							'POST',
							'/viral/takes',
							{
								...(from === 'post'
									? { viralPostId: this.getNodeParameter('viralPostId', i) }
									: { format: this.getNodeParameter('format', i) }),
								answer: this.getNodeParameter('answer', i, '') as string,
								platforms: this.getNodeParameter('platforms', i) as string[],
							},
							undefined,
							i,
							// The execution id makes the key unique per run, so a daily
							// workflow still gets a new draft
							idempotencyKey(i),
						);
					}
				} else if (resource === 'channel') {
					const { channels } = await postelRequest.call(
						this,
						'GET',
						'/channels',
						undefined,
						undefined,
						i,
					);
					result = channels as IDataObject[];
				} else if (operation === 'create') {
					const when = this.getNodeParameter('when', i) as string;
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const body: IDataObject = {
						platform: this.getNodeParameter('platform', i) as string,
						text: this.getNodeParameter('text', i) as string,
					};
					if (when === 'schedule') {
						body.scheduledAt = toInstant(
							this.getNodeParameter('scheduledAt', i) as string,
							timeZone,
						);
					}
					if (when === 'now') body.publishNow = true;
					const mediaUrls = String(options.mediaUrls ?? '')
						.split(/[\s,]+/)
						.filter(Boolean);
					if (mediaUrls.length) body.mediaUrls = mediaUrls;
					if (options.firstComment) body.firstComment = options.firstComment;
					result = await postelRequest.call(
						this,
						'POST',
						'/posts',
						body,
						undefined,
						i,
						idempotencyKey(i),
					);
				} else if (operation === 'generate') {
					const options = this.getNodeParameter('generateOptions', i, {}) as IDataObject;
					result = await postelRequest.call(
						this,
						'POST',
						'/posts/generate',
						{
							prompt: this.getNodeParameter('prompt', i) as string,
							platform: this.getNodeParameter('platform', i) as string,
							...(options.thread !== undefined && { thread: options.thread }),
							...(options.voiceProfileId ? { voiceProfileId: options.voiceProfileId } : {}),
						},
						undefined,
						i,
						idempotencyKey(i),
					);
				} else if (operation === 'schedule') {
					const postId = this.getNodeParameter('postId', i) as string;
					const options = this.getNodeParameter('scheduleOptions', i, {}) as IDataObject;
					result = await postelRequest.call(
						this,
						'POST',
						`/posts/${encodeURIComponent(postId)}/schedule`,
						{
							scheduledAt: toInstant(this.getNodeParameter('scheduledAt', i) as string, timeZone),
							...(options.firstComment !== undefined && { firstComment: options.firstComment }),
						},
						undefined,
						i,
					);
				} else if (operation === 'publish') {
					const postId = this.getNodeParameter('postId', i) as string;
					result = await postelRequest.call(
						this,
						'POST',
						`/posts/${encodeURIComponent(postId)}/publish`,
						{},
						undefined,
						i,
					);
				} else if (operation === 'get') {
					const postId = this.getNodeParameter('postId', i) as string;
					result = await postelRequest.call(
						this,
						'GET',
						`/posts/${encodeURIComponent(postId)}`,
						undefined,
						undefined,
						i,
					);
				} else {
					// getAll
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					const posts: IDataObject[] = [];
					let cursor: string | undefined;
					do {
						const page = await postelRequest.call(
							this,
							'GET',
							'/posts',
							undefined,
							{
								limit: Math.min(100, limit - posts.length),
								...(filters.status ? { status: filters.status } : {}),
								...(filters.platform ? { platform: filters.platform } : {}),
								...(cursor ? { cursor } : {}),
							},
							i,
						);
						posts.push(...(page.posts as IDataObject[]));
						cursor = (page.nextCursor as string | null) ?? undefined;
					} while (cursor && posts.length < limit);
					result = posts;
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Keeps Postel's sentence as the message and its error code as the description
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
					description: (error as NodeApiError).description ?? undefined,
				});
			}
		}

		return [returnData];
	}
}
