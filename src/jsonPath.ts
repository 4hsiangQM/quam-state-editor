/**
 * Set a numeric leaf at path (e.g. ["qubits", "q1", "xy", "amplitude"]).
 * Throws if the path is invalid or the existing value is not a number.
 */
export function setValueAtPath(root: unknown, path: string[], newValue: number): void {
	if (path.length === 0) {
		throw new Error('Path must not be empty.');
	}

	let current: unknown = root;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (current === null || typeof current !== 'object' || Array.isArray(current)) {
			throw new Error(`Invalid path segment "${key}".`);
		}
		current = (current as Record<string, unknown>)[key];
	}

	const lastKey = path[path.length - 1];
	if (current === null || typeof current !== 'object' || Array.isArray(current)) {
		throw new Error(`Invalid path segment "${lastKey}".`);
	}

	const parent = current as Record<string, unknown>;
	const existing = parent[lastKey];
	if (typeof existing !== 'number') {
		throw new Error(
			`Only numeric fields can be updated (expected number at "${lastKey}", found ${typeof existing}).`
		);
	}

	parent[lastKey] = newValue;
}
