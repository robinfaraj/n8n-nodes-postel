import type { INodeProperties } from 'n8n-workflow';

const showPost = (operation: string[]) => ({ show: { resource: ['post'], operation } });

const platformField = (operation: string[]): INodeProperties => ({
	displayName: 'Channel Name or ID',
	name: 'platform',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getChannels' },
	required: true,
	default: '',
	displayOptions: showPost(operation),
	description:
		'Where the post goes. Connect channels in Postel under Settings → Channels. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
});

const postIdField = (operation: string[]): INodeProperties => ({
	displayName: 'Post ID',
	name: 'postId',
	type: 'string',
	required: true,
	default: '',
	displayOptions: showPost(operation),
	description: 'The ID of a Postel post, for example from a Create or Generate step',
});

export const postDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['post'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Save a post as a draft, schedule it, or publish it now',
				action: 'Create a post',
			},
			{
				name: 'Generate in My Voice',
				value: 'generate',
				description:
					'Postel writes a post from your prompt in your own voice and saves it as a draft',
				action: 'Generate a post in my voice',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a post',
				action: 'Get a post',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List posts, newest first',
				action: 'Get many posts',
			},
			{
				name: 'Publish Now',
				value: 'publish',
				description:
					'Publish a draft within a minute. The step returns at once; use the Postel Trigger (Post Published or Post Failed) to act on the outcome.',
				action: 'Publish a post now',
			},
			{
				name: 'Schedule',
				value: 'schedule',
				description: 'Schedule a draft for a time',
				action: 'Schedule a post',
			},
		],
		default: 'create',
	},

	// Create
	platformField(['create']),
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		displayOptions: showPost(['create']),
		description:
			'The post. On X, Bluesky and Mastodon, a line with only --- starts the next post of a thread.',
	},
	{
		displayName: 'When',
		name: 'when',
		type: 'options',
		default: 'draft',
		displayOptions: showPost(['create']),
		options: [
			{
				name: 'Save as Draft',
				value: 'draft',
				description: 'Review it in Postel before it goes out',
			},
			{
				name: 'Schedule',
				value: 'schedule',
				description: 'Publish at a set time (paid plan)',
			},
			{
				name: 'Publish Now',
				value: 'now',
				description:
					'Publish within a minute (paid plan). The step returns at once with status scheduled; the Postel Trigger tells you when it is live.',
			},
		],
	},
	{
		displayName: 'Scheduled Time',
		name: 'scheduledAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['post'], operation: ['create'], when: ['schedule'] } },
		description: "When to publish, in the workflow's timezone",
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showPost(['create']),
		options: [
			{
				displayName: 'First Comment',
				name: 'firstComment',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description:
					'LinkedIn only: a comment Postel posts under the post right after it goes out, up to 1,250 characters',
			},
			{
				displayName: 'Media URLs',
				name: 'mediaUrls',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/photo.jpg',
				description:
					'Public image or video links, separated by commas (up to 4). X takes up to 4 images, or one video or GIF.',
			},
		],
	},

	// Generate
	platformField(['generate']),
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: showPost(['generate']),
		placeholder: 'What we shipped this week: faster exports and a new calendar view',
		description:
			'What the post should be about: an idea, notes, or the gist of a link. Uses 1 AI credit and takes 5 to 30 seconds.',
	},
	{
		displayName: 'Options',
		name: 'generateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showPost(['generate']),
		options: [
			{
				displayName: 'Thread',
				name: 'thread',
				type: 'boolean',
				default: false,
				description: 'Whether to write a thread instead of one post (X only)',
			},
			{
				displayName: 'Voice Profile ID',
				name: 'voiceProfileId',
				type: 'string',
				default: '',
				description: 'Write in another voice profile from Postel. Leave empty for your own voice.',
			},
		],
	},

	// Schedule, publish, get
	postIdField(['schedule', 'publish', 'get']),
	{
		displayName: 'Scheduled Time',
		name: 'scheduledAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: showPost(['schedule']),
		description: "When to publish, in the workflow's timezone",
	},
	{
		displayName: 'Options',
		name: 'scheduleOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showPost(['schedule']),
		options: [
			{
				displayName: 'First Comment',
				name: 'firstComment',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'LinkedIn only: replaces the saved first comment. Leave empty to remove it.',
			},
		],
	},

	// Get many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: showPost(['getAll']),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['post'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showPost(['getAll']),
		options: [
			{
				displayName: 'Channel Name or ID',
				name: 'platform',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChannels' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'draft',
				options: [
					{ name: 'Draft', value: 'draft' },
					{ name: 'Pending Approval', value: 'pending_approval' },
					{ name: 'Published', value: 'published' },
					{ name: 'Scheduled', value: 'scheduled' },
				],
			},
		],
	},
];
