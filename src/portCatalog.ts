import type { CatalogEntry, CatalogSlot, CatalogValueKind, PairCatalogEntry } from './catalog.js';
import type { StateJson } from './stateFile.js';
import { PORT_MATRIX_FIELD_NAMES, PORT_SKIP_FIELD_NAMES } from './arrayFields.js';
import { scanEntityParameters } from './parameterIndex.js';
import {
	getPortObjectAtPath,
	resolvePortForPairCoupler,
	resolvePortsForQubitChannel,
	type OpxKey,
	type ResolvedPortLink,
} from './portResolver.js';
import type { WiringJson } from './wiringFile.js';

function portEntryKey(category: string, opxKey: OpxKey, parameter: string): string {
	return `port|${category}|${opxKey}|${parameter}`;
}

function scannedToSlot(
	path: string[],
	valueKind: CatalogValueKind,
	value: number,
	displayValue: string
): CatalogSlot {
	if (valueKind === 'matrix' || valueKind === 'array') {
		return { path, valueKind, matrixJson: displayValue };
	}
	return { path, valueKind: 'number', value, matrixJson: displayValue };
}

function mergePortScanIntoQubitEntries(
	entries: Map<string, CatalogEntry>,
	qubitName: string,
	category: string,
	link: ResolvedPortLink,
	state: StateJson
): void {
	const portObject = getPortObjectAtPath(state, link.portPath);
	if (!portObject || typeof portObject !== 'object') {
		return;
	}

	const scanned = scanEntityParameters({
		basePath: link.portPath,
		root: portObject,
		matrixFieldNames: PORT_MATRIX_FIELD_NAMES,
		skipFieldNames: PORT_SKIP_FIELD_NAMES,
	});

	for (const param of scanned) {
		const parameter = param.label;
		const key = portEntryKey(category, link.opxKey, parameter);
		let entry = entries.get(key);
		if (!entry) {
			entry = {
				key,
				kind: 'port',
				category,
				parameter,
				opxKey: link.opxKey,
				portPathLabel: link.portPathLabel,
				byQubit: {},
			};
			entries.set(key, entry);
		}

		entry.byQubit[qubitName] = scannedToSlot(
			param.path,
			param.valueKind,
			param.value,
			param.displayValue
		);
	}
}

function getQubitChannelCategories(qubit: unknown): string[] {
	if (!qubit || typeof qubit !== 'object' || Array.isArray(qubit)) {
		return [];
	}

	const categories: string[] = [];
	for (const [key, value] of Object.entries(qubit as Record<string, unknown>)) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		const channel = value as Record<string, unknown>;
		if ('opx_output' in channel || 'opx_input' in channel || 'operations' in channel) {
			categories.push(key);
		}
	}
	return categories.sort();
}

/** Build port catalog entries merged into qubit parameter catalog. */
export function buildQubitPortCatalogEntries(
	state: StateJson,
	wiringDocument: WiringJson | undefined
): CatalogEntry[] {
	if (!wiringDocument?.wiring || !state.qubits) {
		return [];
	}

	const entries = new Map<string, CatalogEntry>();
	const qubitNames = Object.keys(state.qubits).sort();

	for (const qubitName of qubitNames) {
		const qubit = state.qubits[qubitName];
		for (const category of getQubitChannelCategories(qubit)) {
			const result = resolvePortsForQubitChannel(state, wiringDocument, qubitName, category);
			if (!result.ok) {
				continue;
			}
			for (const link of result.links) {
				mergePortScanIntoQubitEntries(entries, qubitName, category, link, state);
			}
		}
	}

	return [...entries.values()].sort((a, b) => {
		const cat = a.category.localeCompare(b.category);
		if (cat !== 0) {
			return cat;
		}
		const opxA = a.opxKey ?? '';
		const opxB = b.opxKey ?? '';
		const opx = opxA.localeCompare(opxB);
		if (opx !== 0) {
			return opx;
		}
		return a.parameter.localeCompare(b.parameter, undefined, { numeric: true });
	});
}

function mergePortScanIntoPairEntries(
	entries: Map<string, PairCatalogEntry>,
	pairName: string,
	link: ResolvedPortLink,
	state: StateJson
): void {
	const category = 'coupler';
	const portObject = getPortObjectAtPath(state, link.portPath);
	if (!portObject || typeof portObject !== 'object') {
		return;
	}

	const scanned = scanEntityParameters({
		basePath: link.portPath,
		root: portObject,
		matrixFieldNames: PORT_MATRIX_FIELD_NAMES,
		skipFieldNames: PORT_SKIP_FIELD_NAMES,
	});

	for (const param of scanned) {
		const parameter = param.label;
		const key = portEntryKey(category, link.opxKey, parameter);
		let entry = entries.get(key);
		if (!entry) {
			entry = {
				key,
				kind: 'port',
				category,
				parameter,
				opxKey: link.opxKey,
				portPathLabel: link.portPathLabel,
				byPair: {},
			};
			entries.set(key, entry);
		}

		entry.byPair[pairName] = scannedToSlot(
			param.path,
			param.valueKind,
			param.value,
			param.displayValue
		);
	}
}

/** Build port catalog entries merged into qubit pair parameter catalog. */
export function buildPairPortCatalogEntries(
	state: StateJson,
	wiringDocument: WiringJson | undefined
): PairCatalogEntry[] {
	if (!wiringDocument?.wiring || !state.qubit_pairs) {
		return [];
	}

	const entries = new Map<string, PairCatalogEntry>();
	const pairNames = Object.keys(state.qubit_pairs).sort();

	for (const pairName of pairNames) {
		const result = resolvePortForPairCoupler(state, wiringDocument, pairName);
		if (!result.ok) {
			continue;
		}
		for (const link of result.links) {
			mergePortScanIntoPairEntries(entries, pairName, link, state);
		}
	}

	return [...entries.values()].sort((a, b) => a.parameter.localeCompare(b.parameter, undefined, { numeric: true }));
}
