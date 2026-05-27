import type { StateJson } from './stateFile.js';
import type { NumericParameter } from './parameterIndex.js';
import { scanNumericParameters } from './parameterIndex.js';

export type ParameterKind = 'direct' | 'operation';

export interface ClassifiedParameter {
	kind: ParameterKind;
	category: string;
	operation?: string;
	parameter: string;
}

export interface CatalogEntry {
	key: string;
	kind: ParameterKind;
	category: string;
	operation?: string;
	parameter: string;
	byQubit: Record<string, { path: string[]; value: number } | null>;
}

export interface ParameterCatalog {
	qubits: string[];
	entries: CatalogEntry[];
}

/** Classify a scanned path into direct (under category) or operation (under operations/). */
export function classifyParameterPath(path: string[]): ClassifiedParameter | null {
	if (path.length < 4 || path[0] !== 'qubits') {
		return null;
	}

	const category = path[2];
	if (path[3] === 'operations' && path.length >= 6) {
		return {
			kind: 'operation',
			category,
			operation: path[4],
			parameter: path[5],
		};
	}

	if (path[3] === 'operations') {
		return null;
	}

	if (path.length === 4) {
		return { kind: 'direct', category, parameter: path[3] };
	}

	return {
		kind: 'direct',
		category,
		parameter: path.slice(3).join('.'),
	};
}

function entryKey(classified: ClassifiedParameter): string {
	if (classified.kind === 'operation') {
		return `operation|${classified.category}|${classified.operation}|${classified.parameter}`;
	}
	return `direct|${classified.category}|${classified.parameter}`;
}

function mergeParameter(
	entries: Map<string, CatalogEntry>,
	qubitName: string,
	param: NumericParameter
): void {
	const classified = classifyParameterPath(param.path);
	if (!classified) {
		return;
	}

	const key = entryKey(classified);
	let entry = entries.get(key);
	if (!entry) {
		entry = {
			key,
			kind: classified.kind,
			category: classified.category,
			operation: classified.operation,
			parameter: classified.parameter,
			byQubit: {},
		};
		entries.set(key, entry);
	}

	entry.byQubit[qubitName] = { path: param.path, value: param.value };
}

export function buildParameterCatalog(data: StateJson): ParameterCatalog {
	if (!data.qubits || typeof data.qubits !== 'object') {
		return { qubits: [], entries: [] };
	}

	const qubitNames = Object.keys(data.qubits).sort();
	const entries = new Map<string, CatalogEntry>();

	for (const qubitName of qubitNames) {
		const params = scanNumericParameters(qubitName, data.qubits[qubitName]);
		for (const param of params) {
			mergeParameter(entries, qubitName, param);
		}
	}

	const sortedEntries = [...entries.values()].sort((a, b) => {
		const cat = a.category.localeCompare(b.category);
		if (cat !== 0) {
			return cat;
		}
		if (a.kind !== b.kind) {
			return a.kind === 'direct' ? -1 : 1;
		}
		const opA = a.operation ?? '';
		const opB = b.operation ?? '';
		const op = opA.localeCompare(opB);
		if (op !== 0) {
			return op;
		}
		return a.parameter.localeCompare(b.parameter);
	});

	return { qubits: qubitNames, entries: sortedEntries };
}
