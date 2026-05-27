import * as vscode from 'vscode';
import { setValueAtPath } from './jsonPath.js';
import type { ParameterCatalog } from './catalog.js';
import type { StateJson } from './stateFile.js';
import { writeStateBackup, writeStateFile } from './stateFile.js';
import { parseFiniteNumber } from './validation.js';

export interface ParameterEdit {
	path: string[];
	newValue: number;
	qubit: string;
}

export interface ApplyEditsRequest {
	edits: Array<{ path: string[]; newValue: string; qubit: string }>;
}

export interface ApplyEditsResult {
	ok: boolean;
	message?: string;
	errors?: Array<{ qubit: string; error: string }>;
	updatedLabels?: string[];
}

function pathInCatalog(catalog: ParameterCatalog, path: string[]): boolean {
	const key = path.join('\0');
	for (const entry of catalog.entries) {
		for (const slot of Object.values(entry.byQubit)) {
			if (slot && slot.path.join('\0') === key) {
				return true;
			}
		}
	}
	return false;
}

export async function applyParameterEdits(
	stateUri: vscode.Uri,
	backupUri: vscode.Uri,
	data: StateJson,
	rawBytes: Uint8Array,
	catalog: ParameterCatalog,
	request: ApplyEditsRequest
): Promise<{ result: ApplyEditsResult; data: StateJson; rawBytes: Uint8Array }> {
	const parsed: ParameterEdit[] = [];
	const errors: Array<{ qubit: string; error: string }> = [];

	for (const edit of request.edits) {
		const trimmed = edit.newValue.trim();
		if (trimmed === '') {
			continue;
		}

		const newValue = parseFiniteNumber(trimmed);
		if (newValue === undefined) {
			errors.push({ qubit: edit.qubit, error: 'Enter a finite number.' });
			continue;
		}

		if (!pathInCatalog(catalog, edit.path)) {
			errors.push({ qubit: edit.qubit, error: 'Unknown parameter path.' });
			continue;
		}

		parsed.push({ path: edit.path, newValue, qubit: edit.qubit });
	}

	if (errors.length > 0) {
		return {
			result: { ok: false, message: 'Fix invalid values before applying.', errors },
			data,
			rawBytes,
		};
	}

	if (parsed.length === 0) {
		return {
			result: { ok: false, message: 'No values to apply (blank fields are skipped).' },
			data,
			rawBytes,
		};
	}

	try {
		await writeStateBackup(backupUri, rawBytes);
		for (const edit of parsed) {
			setValueAtPath(data, edit.path, edit.newValue);
		}
		await writeStateFile(stateUri, data);
		const updatedLabels = parsed.map((e) => `${e.qubit}: ${e.path.join('.')}`);
		const newBytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
		return {
			result: { ok: true, updatedLabels },
			data,
			rawBytes: newBytes,
		};
	} catch (err) {
		return {
			result: {
				ok: false,
				message: err instanceof Error ? err.message : String(err),
			},
			data,
			rawBytes,
		};
	}
}
