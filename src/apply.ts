import * as vscode from 'vscode';
import { setJsonArrayAtPath, setValueAtPath } from './jsonPath.js';
import type { ApplyCatalog, CatalogSlot } from './catalog.js';
import { parseJsonArrayFromSlot } from './catalog.js';
import type { StateJson } from './stateFile.js';
import { writeStateBackup, writeStateFile } from './stateFile.js';
import { parseFiniteNumber, parseNumeric1dArrayJson, parseNumericMatrixJson } from './validation.js';

export interface ScalarEdit {
	path: string[];
	entity: string;
	valueKind: 'number';
	newValue: number;
}

export interface JsonArrayEdit {
	path: string[];
	entity: string;
	valueKind: 'matrix' | 'array';
	values: number[] | number[][];
}

export type ParameterEdit = ScalarEdit | JsonArrayEdit;

export interface ApplyEditsRequest {
	edits: Array<{
		path: string[];
		newValue: string;
		entity: string;
		valueKind: 'number' | 'matrix' | 'array';
	}>;
}

export interface ApplyEditsResult {
	ok: boolean;
	message?: string;
	errors?: Array<{ entity: string; error: string }>;
	updatedLabels?: string[];
}

function slotForPath(catalog: ApplyCatalog, path: string[]): CatalogSlot | undefined {
	const key = path.join('\0');
	for (const entry of catalog.entries) {
		const slots =
			'byQubit' in entry ? Object.values(entry.byQubit) : Object.values(entry.byPair);
		for (const slot of slots) {
			if (slot && slot.path.join('\0') === key) {
				return slot;
			}
		}
	}
	return undefined;
}

function isJsonBlobKind(valueKind: CatalogSlot['valueKind']): valueKind is 'matrix' | 'array' {
	return valueKind === 'matrix' || valueKind === 'array';
}

export async function applyParameterEdits(
	stateUri: vscode.Uri,
	backupUri: vscode.Uri,
	data: StateJson,
	rawBytes: Uint8Array,
	catalog: ApplyCatalog,
	request: ApplyEditsRequest
): Promise<{ result: ApplyEditsResult; data: StateJson; rawBytes: Uint8Array }> {
	const parsed: ParameterEdit[] = [];
	const errors: Array<{ entity: string; error: string }> = [];

	for (const edit of request.edits) {
		const trimmed = edit.newValue.trim();
		if (trimmed === '') {
			continue;
		}

		const slot = slotForPath(catalog, edit.path);
		if (!slot) {
			errors.push({ entity: edit.entity, error: 'Unknown parameter path.' });
			continue;
		}

		if (isJsonBlobKind(slot.valueKind)) {
			const existing = parseJsonArrayFromSlot(slot.matrixJson);
			if (slot.valueKind === 'array') {
				const existing1d = existing && !Array.isArray(existing[0]) ? existing : undefined;
				const arrayResult = parseNumeric1dArrayJson(
					trimmed,
					existing1d as number[] | undefined
				);
				if (!arrayResult.ok) {
					errors.push({ entity: edit.entity, error: arrayResult.error });
					continue;
				}
				parsed.push({
					path: edit.path,
					entity: edit.entity,
					valueKind: 'array',
					values: arrayResult.values,
				});
			} else {
				const existing2d =
					existing && Array.isArray(existing[0]) ? (existing as number[][]) : undefined;
				const matrixResult = parseNumericMatrixJson(trimmed, existing2d);
				if (!matrixResult.ok) {
					errors.push({ entity: edit.entity, error: matrixResult.error });
					continue;
				}
				parsed.push({
					path: edit.path,
					entity: edit.entity,
					valueKind: 'matrix',
					values: matrixResult.matrix,
				});
			}
			continue;
		}

		const newValue = parseFiniteNumber(trimmed);
		if (newValue === undefined) {
			errors.push({ entity: edit.entity, error: 'Enter a finite number.' });
			continue;
		}

		parsed.push({
			path: edit.path,
			entity: edit.entity,
			valueKind: 'number',
			newValue,
		});
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
			if (edit.valueKind === 'number') {
				setValueAtPath(data, edit.path, edit.newValue);
			} else {
				setJsonArrayAtPath(data, edit.path, edit.values);
			}
		}
		await writeStateFile(stateUri, data);
		const updatedLabels = parsed.map((e) => `${e.entity}: ${e.path.join('.')}`);
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
