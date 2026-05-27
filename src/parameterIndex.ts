export interface NumericParameter {
	/** Relative path under the qubit (QuickPick label). */
	label: string;
	/** Current numeric value (QuickPick description). */
	description: string;
	/** Full JSON path (QuickPick detail). */
	detail: string;
	path: string[];
	value: number;
}

const IGNORED_KEYS = new Set([
	'__class__',
	'id',
	'macros',
	'core',
	'opx_input',
	'opx_output',
]);

/**
 * Recursively collect numeric leaf values under one qubit object.
 * Paths are rooted at ["qubits", qubitName, ...].
 */
export function scanNumericParameters(qubitName: string, qubit: unknown): NumericParameter[] {
	const results: NumericParameter[] = [];
	const basePath = ['qubits', qubitName];

	function visit(node: unknown, pathFromQubit: string[]): void {
		if (typeof node === 'number') {
			const path = [...basePath, ...pathFromQubit];
			const relative = pathFromQubit.join('.');
			results.push({
				label: relative,
				description: String(node),
				detail: `/${path.join('/')}`,
				path,
				value: node,
			});
			return;
		}

		if (node === null || typeof node !== 'object' || Array.isArray(node)) {
			return;
		}

		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (IGNORED_KEYS.has(key)) {
				continue;
			}
			visit(value, [...pathFromQubit, key]);
		}
	}

	visit(qubit, []);
	return results.sort((a, b) => a.label.localeCompare(b.label));
}
