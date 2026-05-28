import type { StateJson } from './stateFile.js';
import type { ScannedParameter } from './parameterIndex.js';
import { scanNumericParameters, scanQubitPairParameters } from './parameterIndex.js';
import { isNumeric1dArray, isNumeric2dMatrix } from './arrayFields.js';

export type ParameterKind = 'direct' | 'operation' | 'qubitProperty' | 'matrix' | 'array';

export type CatalogValueKind = 'number' | 'matrix' | 'array';

export interface CatalogSlot {
	path: string[];
	valueKind: CatalogValueKind;
	value?: number;
	matrixJson?: string;
}

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
	byQubit: Record<string, CatalogSlot | null>;
}

export interface ParameterCatalog {
	qubits: string[];
	entries: CatalogEntry[];
	qubitPropertyCategory: string;
	qubitPropertyCategoryLabel: string;
}

export const QUBIT_PROPERTY_CATEGORY = '__qubit_property__';
export const QUBIT_PROPERTY_CATEGORY_LABEL = 'Qubit property';

function formatParameterName(segments: string[]): string {
	if (segments.length >= 2 && /^\d+$/.test(segments[segments.length - 1] ?? '')) {
		const index = segments[segments.length - 1];
		const field = segments.slice(0, -1).join('.');
		return `${field}[${index}]`;
	}
	return segments.join('.');
}

function classifyQubitPathFromScan(path: string[], valueKind: CatalogValueKind): ClassifiedParameter | null {
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
	const tail = path.slice(3);

	if (valueKind === 'matrix' || valueKind === 'array') {
		return {
			kind: valueKind,
			category,
			parameter: tail.join('.'),
		};
	}

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
		parameter: formatParameterName(tail),
	};
}

/** Classify a scanned path into qubit property, direct (under category), operation, or matrix. */
export function classifyParameterPath(
	path: string[],
	valueKind: CatalogValueKind = 'number'
): ClassifiedParameter | null {
	return classifyQubitPathFromScan(path, valueKind);
}

function entryKey(classified: ClassifiedParameter): string {
	if (classified.kind === 'qubitProperty') {
		return `qubitProperty|${classified.parameter}`;
	}
	if (classified.kind === 'matrix') {
		return `matrix|${classified.category}|${classified.parameter}`;
	}
	if (classified.kind === 'array') {
		return `array|${classified.category}|${classified.parameter}`;
	}
	if (classified.kind === 'operation') {
		return `operation|${classified.category}|${classified.operation}|${classified.parameter}`;
	}
	return `direct|${classified.category}|${classified.parameter}`;
}

function scannedToSlot(param: ScannedParameter): CatalogSlot {
	if (param.valueKind === 'matrix' || param.valueKind === 'array') {
		return {
			path: param.path,
			valueKind: param.valueKind,
			matrixJson: param.displayValue,
		};
	}
	return {
		path: param.path,
		valueKind: 'number',
		value: param.value,
	};
}

function mergeParameter(
	entries: Map<string, CatalogEntry>,
	qubitName: string,
	param: ScannedParameter
): void {
	const classified = classifyParameterPath(param.path, param.valueKind);
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

	entry.byQubit[qubitName] = scannedToSlot(param);
}

function sortCatalogEntries(entries: CatalogEntry[]): CatalogEntry[] {
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
			if (a.kind === 'matrix' || a.kind === 'array') {
				return -1;
			}
			if (b.kind === 'matrix' || b.kind === 'array') {
				return 1;
			}
			return a.kind === 'direct' ? -1 : 1;
		}
		const opA = a.operation ?? '';
		const opB = b.operation ?? '';
		const op = opA.localeCompare(opB);
		if (op !== 0) {
			return op;
		}
		return a.parameter.localeCompare(b.parameter, undefined, { numeric: true });
	});
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

	return {
		qubits: qubitNames,
		entries: sortCatalogEntries([...entries.values()]),
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
	byPair: Record<string, CatalogSlot | null>;
}

export interface QubitPairCatalog {
	pairs: string[];
	entries: PairCatalogEntry[];
	pairPropertyCategory: string;
	pairPropertyCategoryLabel: string;
}

export function classifyQubitPairPath(
	path: string[],
	valueKind: CatalogValueKind = 'number'
): ClassifiedParameter | null {
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

	if (path[2] === 'extras' && path.length === 4 && valueKind === 'array') {
		return {
			kind: 'array',
			category: 'extras',
			parameter: path[3],
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
			parameter: formatParameterName(path.slice(3)),
		};
	}

	if (path[2] === 'gates' && path.length >= 5) {
		return {
			kind: 'operation',
			category: 'gates',
			operation: path[3],
			parameter: formatParameterName(path.slice(4)),
		};
	}

	if (path[2] === 'extras') {
		const tail = path.slice(3);
		return {
			kind: 'direct',
			category: 'extras',
			parameter: formatParameterName(tail),
		};
	}

	return null;
}

function mergePairParameter(
	entries: Map<string, PairCatalogEntry>,
	pairName: string,
	param: ScannedParameter
): void {
	const classified = classifyQubitPairPath(param.path, param.valueKind);
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

	entry.byPair[pairName] = scannedToSlot(param);
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
			if (a.kind === 'matrix' || a.kind === 'array') {
				return -1;
			}
			if (b.kind === 'matrix' || b.kind === 'array') {
				return 1;
			}
			return a.kind === 'direct' ? -1 : 1;
		}
		const opA = a.operation ?? '';
		const opB = b.operation ?? '';
		const op = opA.localeCompare(opB);
		if (op !== 0) {
			return op;
		}
		return a.parameter.localeCompare(b.parameter, undefined, { numeric: true });
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

export type ApplyCatalog = ParameterCatalog | QubitPairCatalog;

export interface EditorCatalogPayload {
	qubitCatalog: ParameterCatalog;
	qubitPairCatalog: QubitPairCatalog;
}

export function parseJsonArrayFromSlot(
	matrixJson: string | undefined
): number[] | number[][] | undefined {
	if (!matrixJson) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(matrixJson) as unknown;
		if (isNumeric1dArray(parsed)) {
			return parsed;
		}
		return isNumeric2dMatrix(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

/** @deprecated Use parseJsonArrayFromSlot */
export function parseMatrixJsonFromSlot(matrixJson: string | undefined): number[][] | undefined {
	const parsed = parseJsonArrayFromSlot(matrixJson);
	return parsed && Array.isArray(parsed[0]) ? (parsed as number[][]) : undefined;
}
