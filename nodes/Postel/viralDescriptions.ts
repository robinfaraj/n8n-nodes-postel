import type { INodeProperties } from 'n8n-workflow';

const showViral = (operation: string[]) => ({
	show: { resource: ['viralPost'], operation },
});

export const viralPostDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['viralPost'] } },
		options: [
			{
				name: 'Find',
				value: 'search',
				description: 'Find posts and videos that took off, from individual creators',
				action: 'Find viral posts',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a viral post',
				action: 'Get a viral post',
			},
			{
				name: 'Write My Take',
				value: 'writeTake',
				description:
					'Postel writes your own post in your voice from a viral post or a format, and saves it as a draft',
				action: 'Write my take on a viral post',
			},
		],
		default: 'search',
	},

	// Find
	{
		displayName: 'Topic or Keywords',
		name: 'query',
		type: 'string',
		default: '',
		displayOptions: showViral(['search']),
		placeholder: 'pricing',
		description: "Leave empty to browse what's doing best",
	},
	{
		displayName: 'Network',
		name: 'network',
		type: 'options',
		default: 'x',
		displayOptions: showViral(['search']),
		options: [
			{ name: 'Instagram (Videos)', value: 'instagram' },
			{ name: 'TikTok (Videos)', value: 'tiktok' },
			{ name: 'X (Posts)', value: 'x' },
			{ name: 'YouTube (Videos)', value: 'youtube' },
		],
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 50,
		displayOptions: showViral(['search']),
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'viralFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showViral(['search']),
		options: [
			{
				displayName: 'Days Back',
				name: 'days',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 60 },
				default: 7,
				description: 'How far back to look',
			},
			{
				displayName: 'Format Name or ID',
				name: 'format',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getFormats' },
				default: '',
				description:
					'X only: posts in this format. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Minimum Outlier Score',
				name: 'minOutlierScore',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 10,
				description:
					"How far it outran normal. X: views ÷ followers. Videos: times the creator's usual views.",
			},
			{
				displayName: 'Minimum Views',
				name: 'minViews',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 10000,
			},
			{
				displayName: 'Video Length',
				name: 'length',
				type: 'options',
				default: 'short',
				options: [
					{ name: 'Short-Form', value: 'short' },
					{ name: 'Long-Form', value: 'long' },
				],
			},
		],
	},

	// Get
	{
		displayName: 'Viral Post ID',
		name: 'viralPostId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showViral(['get']),
		description: 'The ID from a Find step or the Postel Trigger',
	},

	// Write my take
	{
		displayName: 'Write From',
		name: 'takeFrom',
		type: 'options',
		default: 'post',
		displayOptions: showViral(['writeTake']),
		options: [
			{ name: 'A Viral X Post', value: 'post' },
			{ name: 'A Format', value: 'format' },
		],
	},
	{
		displayName: 'Viral Post ID',
		name: 'viralPostId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['viralPost'], operation: ['writeTake'], takeFrom: ['post'] },
		},
		description: 'An X post from a Find step or the Postel Trigger',
	},
	{
		displayName: 'Format Name or ID',
		name: 'format',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFormats' },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['viralPost'], operation: ['writeTake'], takeFrom: ['format'] },
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Your Answer',
		name: 'answer',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: showViral(['writeTake']),
		description:
			"What the post is about, in your words: the facts Postel may use. Needed for a format (it's the reply to the format's question); optional for a post.",
	},
	{
		displayName: 'Networks',
		name: 'platforms',
		type: 'multiOptions',
		default: ['linkedin'],
		displayOptions: showViral(['writeTake']),
		options: [
			{ name: 'LinkedIn', value: 'linkedin' },
			{ name: 'X', value: 'x' },
		],
		description: 'One draft per network. Uses 1 AI credit each.',
	},
];
