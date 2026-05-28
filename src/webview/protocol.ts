import type { EditorCatalogPayload } from '../catalog.js';

export type EditorTarget = 'qubits' | 'qubit_pairs';

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'reload' }
	| { type: 'changeStateFile' }
	| {
			type: 'apply';
			target: EditorTarget;
			entryKey: string;
			edits: Array<{
				entity: string;
				path: string[];
				newValue: string;
				valueKind: 'number' | 'matrix' | 'array';
			}>;
	  };

export type HostToWebviewMessage =
	| { type: 'catalog'; payload: EditorCatalogPayload; stateFilePath: string }
	| {
			type: 'applyResult';
			ok: boolean;
			message?: string;
			errors?: Array<{ entity: string; error: string }>;
			updatedLabels?: string[];
	  }
	| { type: 'status'; message: string; level?: 'info' | 'error' };
