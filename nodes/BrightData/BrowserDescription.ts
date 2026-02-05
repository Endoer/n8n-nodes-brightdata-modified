import { INodeProperties } from 'n8n-workflow';

// When the resource `` is selected, this `operation` parameter will be shown.
export const browserOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['browser'],
			},
		},
		options: [
			{
				name: 'Click',
				value: 'click',
				action: 'Click an element',
			},
			{
				name: 'Close Session',
				value: 'closeSession',
				action: 'Close the active browser session',
			},
			{
				name: 'Fill Form',
				value: 'fillForm',
				action: 'Fill multiple form fields',
			},
			{
				name: 'Get HTML',
				value: 'getHtml',
				action: 'Get page HTML content',
			},
			{
				name: 'Get Network Requests',
				value: 'getNetworkRequests',
				action: 'Get captured network requests',
			},
			{
				name: 'Get Snapshot',
				value: 'getSnapshot',
				action: 'Get ARIA accessibility snapshot',
			},
			{
				name: 'Get Text',
				value: 'getText',
				action: 'Get page text content',
			},
			{
				name: 'Go Back',
				value: 'goBack',
				action: 'Navigate back in history',
			},
			{
				name: 'Go Forward',
				value: 'goForward',
				action: 'Navigate forward in history',
			},
			{
				name: 'Navigate',
				value: 'navigate',
				action: 'Navigate to a URL',
			},
			{
				name: 'Screenshot',
				value: 'screenshot',
				action: 'Capture a screenshot',
			},
			{
				name: 'Scroll',
				value: 'scroll',
				action: 'Scroll to bottom of page',
			},
			{
				name: 'Scroll To Element',
				value: 'scrollToElement',
				action: 'Scroll an element into view',
			},
			{
				name: 'Type',
				value: 'type',
				action: 'Type text into an input',
			},
			{
				name: 'Wait For Element',
				value: 'waitForElement',
				action: 'Wait for an element to appear',
			},
		],
		default: 'navigate',
	},
];

const browserParameters: INodeProperties[] = [
	{
		displayName: 'Zone',
		name: 'zone',
		type: 'resourceLocator',
		default: {
			mode: 'list',
			value: 'n8n_browser',
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a Zone ...',
				typeOptions: {
					searchListMethod: 'getActiveZones',
					searchable: true,
				},
			},
		],
		required: true,
		description: 'Select the browser zone',
		displayOptions: {
			show: {
				resource: ['browser'],
			},
		},
	},
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		default: '',
		description: 'Optional session ID to share browser sessions across nodes',
		displayOptions: {
			show: {
				resource: ['browser'],
			},
		},
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		description: 'The URL to navigate to',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['navigate'],
			},
		},
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
		description: 'Optional 2-letter ISO country code (e.g., "US", "GB")',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['navigate'],
			},
		},
	},
	{
		displayName: 'Element Description',
		name: 'element',
		type: 'string',
		default: '',
		required: true,
		description: 'Description of the target element (for clarity in logs)',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['click', 'type', 'scrollToElement', 'waitForElement'],
			},
		},
	},
	{
		displayName: 'Ref',
		name: 'ref',
		type: 'string',
		default: '',
		description: 'Ref value from the ARIA snapshot (preferred)',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['click', 'type', 'scrollToElement', 'waitForElement'],
			},
		},
	},
	{
		displayName: 'CSS Selector',
		name: 'selector',
		type: 'string',
		default: '',
		description: 'CSS selector for the element (alternative to ref)',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['click', 'type', 'scrollToElement', 'waitForElement'],
			},
		},
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		required: true,
		description: 'Text to type into the input',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['type'],
			},
		},
	},
	{
		displayName: 'Submit',
		name: 'submit',
		type: 'boolean',
		default: false,
		description: 'Whether to submit the form after typing (press Enter)',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['type'],
			},
		},
	},
	{
		displayName: 'Full Page',
		name: 'full_page',
		type: 'boolean',
		default: false,
		description: 'Whether to capture the full page (larger images)',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['screenshot'],
			},
		},
	},
	{
		displayName: 'Full Page',
		name: 'full_page',
		type: 'boolean',
		default: false,
		description: 'Whether to get full HTML including head and script tags',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['getHtml'],
			},
		},
	},
	{
		displayName: 'Filtered',
		name: 'filtered',
		type: 'boolean',
		default: false,
		description: 'Whether to return a compacted snapshot',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['getSnapshot'],
			},
		},
	},
	{
		displayName: 'Timeout (Ms)',
		name: 'timeout',
		type: 'number',
		default: 30000,
		description: 'Maximum time to wait in milliseconds',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['waitForElement'],
			},
		},
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		description: 'Fields to fill in',
		displayOptions: {
			show: {
				resource: ['browser'],
				operation: ['fillForm'],
			},
		},
		options: [
			{
				name: 'field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description: 'Human-readable field name',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{
								name: 'Checkbox',
								value: 'checkbox',
							},
							{
								name: 'Combobox',
								value: 'combobox',
							},
							{
								name: 'Radio',
								value: 'radio',
							},
							{
								name: 'Slider',
								value: 'slider',
							},
							{
								name: 'Textbox',
								value: 'textbox',
							},
						],
						default: 'textbox',
						required: true,
						description: 'Type of the field',
					},
					{
						displayName: 'Ref',
						name: 'ref',
						type: 'string',
						default: '',
						required: true,
						description: 'Exact target field reference from the page snapshot',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						required: true,
						description:
							'Value to fill in the field. For checkbox use "true"/"false". For combobox use option label.',
					},
				],
			},
		],
	},
];

export const browserFields: INodeProperties[] = [...browserParameters];
