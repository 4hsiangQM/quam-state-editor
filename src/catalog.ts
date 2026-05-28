import type { StateJson } from './stateFile.js';
import type { NumericParameter } from './parameterIndex.js';
import { scanNumericParameters, scanQubitPairParameters } from './parameterIndex.js';

export type ParameterKind = 'direct' | 'operation' | 'qubitProperty';

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
	/** Category dropdown value for qubit-level properties (display: qubitPropertyCategoryLabel). */
	qubitPropertyCategory: string;
	qubitPropertyCategoryLabel: string;
}

/** Internal category id for qubit-root numeric fields (anharmonicity, T1, …). */
export const QUBIT_PROPERTY_CATEGORY = '__qubit_property__';
export const QUBIT_PROPERTY_CATEGORY_LABEL = 'Qubit property';

/** Classify a scanned path into qubit property, direct (under category), or operation. */
export function classifyParameterPath(path: string[]): ClassifiedParameter | null {
	if (path.length < 3 || path[0] !== 'qubits') {
		return null;
	}

	if (path.length === 3) {
		return {
			kind: 'qubitProperty',
			category: QUBIT_PROPERTY_CATEGORY,
			parameter: path[2],
		};
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
	if (classified.kind === 'qubitProperty') {
		return `qubitProperty|${classified.parameter}`;
	}
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
		return {
			qubits: [],
			entries: [],
			qubitPropertyCategory: QUBIT_PROPERTY_CATEGORY,
			qubitPropertyCategoryLabel: QUBIT_PROPERTY_CATEGORY_LABEL,
		};
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
		if (a.kind === 'qubitProperty' && b.kind !== 'qubitProperty') {
			return -1;
		}
		if (b.kind === 'qubitProperty' && a.kind !== 'qubitProperty') {
			return 1;
		}
		if (a.kind === 'qubitProperty' && b.kind === 'qubitProperty') {
			return a.parameter.localeCompare(b.parameter);
		}
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

	return {
		qubits: qubitNames,
		entries: sortedEntries,
		qubitPropertyCategory: QUBIT_PROPERTY_CATEGORY,
		qubitPropertyCategoryLabel: QUBIT_PROPERTY_CATEGORY_LABEL,
	};
}

export const PAIR_PROPERTY_CATEGORY = '__pair_property__';
export const PAIR_PROPERTY_CATEGORY_LABEL = 'Pair property';

export interface PairCatalogEntry {
	key: string;
	kind: ParameterKind;
	category: string;
	operation?: string;
	parameter: string;
	byPair: Record<string, { path: string[]; value: number } | null>;
}

export interface QubitPairCatalog {
	pairs: string[];
	entries: PairCatalogEntry[];
	pairPropertyCategory: string;
	pairPropertyCategoryLabel: string;
}

/** Classify a qubit_pair path (mirrors qubit rules where structure matches). */
export function classifyQubitPairPath(path: string[]): ClassifiedParameter | null {
	if (path.length < 3 || path[0] !== 'qubit_pairs') {
		return null;
	}

	if (path.length === 3) {
		return {
			kind: 'qubitProperty',
			category: PAIR_PROPERTY_CATEGORY,
			parameter: path[2],
		};
	}

	if (path[2] === 'coupler') {
		if (path[3] === 'operations' && path.length >= 6) {
			return {
				kind: 'operation',
				category: 'coupler',
				operation: path[4],
				parameter: path[5],
			};
		}
		if (path[3] === 'operations') {
			return null;
		}
		if (path.length === 4) {
			return { kind: 'direct', category: 'coupler', parameter: path[3] };
		}
		return {
			kind: 'direct',
			category: 'coupler',
			parameter: path.slice(3).join('.'),
		};
	}

	if (path[2] === 'gates' && path.length >= 5) {
		return {
			kind: 'operation',
			category: 'gates',
			operation: path[3],
			parameter: path.slice(4).join('.'),
		};
	}

	if (path[2] === 'extras' && path.length === 4) {
		return { kind: 'direct', category: 'extras', parameter: path[3] };
	}

	if (path[2] === 'extras') {
		return { kind: 'direct', category: 'extras', parameter: path.slice(3).join('.') };
	}

	return null;
}

function mergePairParameter(
	entries: Map<string, PairCatalogEntry>,
	pairName: string,
	param: NumericParameter
): void {
	const classified = classifyQubitPairPath(param.path);
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
			byPair: {},
		};
		entries.set(key, entry);
	}

	entry.byPair[pairName] = { path: param.path, value: param.value };
}

function sortPairEntries(entries: PairCatalogEntry[]): PairCatalogEntry[] {
	return [...entries].sort((a, b) => {
		if (a.kind === 'qubitProperty' && b.kind !== 'qubitProperty') {
			return -1;
		}
		if (b.kind === 'qubitProperty' && a.kind !== 'qubitProperty') {
			return 1;
		}
		if (a.kind === 'qubitProperty' && b.kind === 'qubitProperty') {
			return a.parameter.localeCompare(b.parameter);
		}
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
}

export function buildQubitPairCatalog(data: StateJson): QubitPairCatalog {
	if (!data.qubit_pairs || typeof data.qubit_pairs !== 'object') {
		return {
			pairs: [],
			entries: [],
			pairPropertyCategory: PAIR_PROPERTY_CATEGORY,
			pairPropertyCategoryLabel: PAIR_PROPERTY_CATEGORY_LABEL,
		};
	}

	const pairNames = Object.keys(data.qubit_pairs).sort();
	const entries = new Map<string, PairCatalogEntry>();

	for (const pairName of pairNames) {
		const params = scanQubitPairParameters(pairName, data.qubit_pairs[pairName]);
		for (const param of params) {
			mergePairParameter(entries, pairName, param);
		}
	}

	return {
		pairs: pairNames,
		entries: sortPairEntries([...entries.values()]),
		pairPropertyCategory: PAIR_PROPERTY_CATEGORY,
		pairPropertyCategoryLabel: PAIR_PROPERTY_CATEGORY_LABEL,
	};
}

export interface EditorCatalogPayload {
	qubitCatalog: ParameterCatalog;
	qubitPairCatalog: QubitPairCatalog;
}
