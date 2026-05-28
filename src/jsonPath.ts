/**
 * Set a numeric leaf at path (e.g. ["qubits", "q1", "xy", "amplitude"]).
 * Supports array indices in the path (e.g. …, "filter_fir_taps", "0").
 */
export function setValueAtPath(root: unknown, path: string[], newValue: number): void {
	if (path.length === 0) {
		throw new Error('Path must not be empty.');
	}

	let current: unknown = root;
	for (let i = 0; i < path.length - 1; i++) {
		current = readPathSegment(current, path[i]);
	}

	const lastKey = path[path.length - 1];
	const existing = readPathSegment(current, lastKey);
	if (typeof existing !== 'number') {
		throw new Error(
			`Only numeric fields can be updated (expected number at "${lastKey}", found ${typeof existing}).`
		);
	}

	writePathSegment(current, lastKey, newValue);
}

/** Replace an entire numeric array (1D or 2D) at path. */
export function setJsonArrayAtPath(root: unknown, path: string[], values: number[] | number[][]): void {
	if (path.length === 0) {
		throw new Error('Path must not be empty.');
	}

	let current: unknown = root;
	for (let i = 0; i < path.length - 1; i++) {
		current = readPathSegment(current, path[i]);
	}

	const lastKey = path[path.length - 1];
	const existing = readPathSegment(current, lastKey);
	if (!Array.isArray(existing)) {
		throw new Error(`Expected an array matrix at "${lastKey}".`);
	}

	writePathSegment(current, lastKey, values);
}

/** @deprecated Use setJsonArrayAtPath */
export function setMatrixAtPath(root: unknown, path: string[], matrix: number[][]): void {
	setJsonArrayAtPath(root, path, matrix);
}

function readPathSegment(current: unknown, key: string): unknown {
	if (Array.isArray(current)) {
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= current.length) {
			throw new Error(`Invalid array index "${key}".`);
		}
		return current[index];
	}

	if (current === null || typeof current !== 'object') {
		throw new Error(`Invalid path segment "${key}".`);
	}

	return (current as Record<string, unknown>)[key];
}

function writePathSegment(current: unknown, key: string, value: unknown): void {
	if (Array.isArray(current)) {
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= current.length) {
			throw new Error(`Invalid array index "${key}".`);
		}
		current[index] = value;
		return;
	}

	if (current === null || typeof current !== 'object') {
		throw new Error(`Invalid path segment "${key}".`);
	}

	(current as Record<string, unknown>)[key] = value;
}
