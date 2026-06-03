import type { StateJson } from './stateFile.js';
import type { WiringJson } from './wiringFile.js';
import {
	formatPortPathLabel,
	portPathFromRef,
	resolveQuamRef,
} from './jsonPointer.js';

export type OpxKey = 'opx_input' | 'opx_output';

export interface ResolvedPortLink {
	opxKey: OpxKey;
	portPath: string[];
	portPathLabel: string;
}

export type PortResolutionResult =
	| { ok: true; links: ResolvedPortLink[] }
	| { ok: false; error: string };

const OPX_KEYS: OpxKey[] = ['opx_input', 'opx_output'];

/** Map state.json channel category to wiring.json channel key. */
export function stateCategoryToWiringChannel(category: string): string {
	return category === 'resonator' ? 'rr' : category;
}

/** Map state pair id (e.g. coupler_q1_q2) to wiring pair id (e.g. q1-2). */
export function pairNameToWiringId(pairName: string): string | null {
	const match = /^coupler_(q\d+)_q(\d+)$/.exec(pairName);
	if (!match) {
		return null;
	}
	return `${match[1]}-${match[2]}`;
}

function resolveOpxRefToPortLink(
	state: StateJson,
	wiringDocument: WiringJson,
	opxKey: OpxKey,
	opxRef: unknown
): ResolvedPortLink | null {
	if (typeof opxRef !== 'string' || !opxRef.startsWith('#/')) {
		return null;
	}

	const wiringLeaf = resolveQuamRef(opxRef, state, wiringDocument);
	if (typeof wiringLeaf !== 'string') {
		return null;
	}

	const portPath = portPathFromRef(wiringLeaf);
	if (!portPath) {
		return null;
	}

	return {
		opxKey,
		portPath,
		portPathLabel: formatPortPathLabel(portPath),
	};
}

function getQubitChannelObject(
	state: StateJson,
	qubitName: string,
	category: string
): Record<string, unknown> | null {
	const qubits = state.qubits;
	if (!qubits || typeof qubits !== 'object') {
		return null;
	}
	const qubit = qubits[qubitName];
	if (!qubit || typeof qubit !== 'object' || Array.isArray(qubit)) {
		return null;
	}
	const channel = (qubit as Record<string, unknown>)[category];
	if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
		return null;
	}
	return channel as Record<string, unknown>;
}

/** Resolve hardware port paths for a qubit channel category (xy, z, resonator, …). */
export function resolvePortsForQubitChannel(
	state: StateJson,
	wiringDocument: WiringJson | undefined,
	qubitName: string,
	category: string
): PortResolutionResult {
	if (!wiringDocument?.wiring) {
		return { ok: false, error: 'wiring.json is missing or invalid' };
	}

	const channel = getQubitChannelObject(state, qubitName, category);
	if (!channel) {
		return { ok: false, error: `Channel "${category}" not found for qubit "${qubitName}"` };
	}

	const links: ResolvedPortLink[] = [];
	for (const opxKey of OPX_KEYS) {
		const link = resolveOpxRefToPortLink(state, wiringDocument, opxKey, channel[opxKey]);
		if (link) {
			links.push(link);
		}
	}

	if (links.length === 0) {
		return {
			ok: false,
			error: `No wired ports for qubit "${qubitName}" channel "${category}"`,
		};
	}

	return { ok: true, links };
}

/** Resolve hardware port path for a qubit pair coupler. */
export function resolvePortForPairCoupler(
	state: StateJson,
	wiringDocument: WiringJson | undefined,
	pairName: string
): PortResolutionResult {
	if (!wiringDocument?.wiring) {
		return { ok: false, error: 'wiring.json is missing or invalid' };
	}

	const pairs = state.qubit_pairs;
	if (!pairs || typeof pairs !== 'object') {
		return { ok: false, error: 'No qubit_pairs in state.json' };
	}

	const pair = pairs[pairName];
	if (!pair || typeof pair !== 'object' || Array.isArray(pair)) {
		return { ok: false, error: `Pair "${pairName}" not found` };
	}

	const coupler = (pair as Record<string, unknown>).coupler;
	if (!coupler || typeof coupler !== 'object' || Array.isArray(coupler)) {
		return { ok: false, error: `Coupler not found for pair "${pairName}"` };
	}

	const link = resolveOpxRefToPortLink(
		state,
		wiringDocument,
		'opx_output',
		(coupler as Record<string, unknown>).opx_output
	);

	if (!link) {
		return {
			ok: false,
			error: `No wired port for pair "${pairName}" coupler`,
		};
	}

	return { ok: true, links: [link] };
}

/** Get port object at path in state.json (for scanning parameters). */
export function getPortObjectAtPath(state: StateJson, portPath: string[]): unknown {
	let current: unknown = state;
	for (const segment of portPath) {
		if (current === null || typeof current !== 'object' || Array.isArray(current)) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}
