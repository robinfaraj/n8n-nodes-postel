import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PostelApi implements ICredentialType {
	name = 'postelApi';

	displayName = 'Postel API';

	icon: Icon = { light: 'file:../icons/postel.svg', dark: 'file:../icons/postel.dark.svg' };

	documentationUrl =
		'https://github.com/robinfaraj/n8n-nodes-postel?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'pstl_...',
			description:
				'Create one in Postel under Settings → API keys. The key acts for the workspace it was made in.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://www.postel.app',
			description: 'Leave as is unless Postel support gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'X-Postel-Client': 'n8n',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}/api/v1',
			url: '/me',
			method: 'GET',
		},
	};
}
