import type { ParameterCatalog } from '../catalog.js';

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'reload' }
	| {
			type: 'apply';
			entryKey: string;
			edits: Array<{ qubit: string; path: string[]; newValue: string }>;
	  };

export type HostToWebviewMessage =
	| { type: 'catalog'; payload: ParameterCatalog }
	| {
			type: 'applyResult';
			ok: boolean;
			message?: string;
			errors?: Array<{ qubit: string; error: string }>;
			updatedLabels?: string[];
	  }
	| { type: 'status'; message: string; level?: 'info' | 'error' };
