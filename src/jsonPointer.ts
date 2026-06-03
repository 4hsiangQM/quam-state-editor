/** Parse `#/a/b/c` into JSON Pointer segments (without leading `#/`). */
export function parseJsonPointer(ref: string): string[] | null {
	if (!ref.startsWith('#/')) {
		return null;
	}
	return ref.slice(2).split('/');
}

/** Walk a plain object by pointer segments. */
export function resolveJsonPointer(root: unknown, segments: string[]): unknown {
	let current = root;
	for (const segment of segments) {
		if (current === null || typeof current !== 'object' || Array.isArray(current)) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

/** Resolve a `#/...` reference against a single document root. */
export function resolveJsonPointerRef(root: unknown, ref: string): unknown {
	const segments = parseJsonPointer(ref);
	if (!segments) {
		return undefined;
	}
	return resolveJsonPointer(root, segments);
}

/** Convert `#/ports/mw_outputs/con1/6/2` to path `['ports','mw_outputs','con1','6','2']`. */
export function portPathFromRef(ref: string): string[] | null {
	const segments = parseJsonPointer(ref);
	if (!segments || segments[0] !== 'ports' || segments.length < 2) {
		return null;
	}
	return segments;
}

export function formatPortPathLabel(portPath: string[]): string {
	if (portPath.length <= 1 || portPath[0] !== 'ports') {
		return portPath.join('/');
	}
	return portPath.slice(1).join('/');
}

/** Strip parameter tail from a full state path to the port object label (e.g. analog_outputs/con1/1/1). */
export function portObjectPathLabelFromParameterPath(path: string[]): string {
	if (path[0] !== 'ports') {
		return path.join('/');
	}
	if (path.length >= 5) {
		return path.slice(1, 5).join('/');
	}
	return formatPortPathLabel(path);
}

/**
 * Resolve QuAM cross-document JSON pointers.
 * - `#/wiring/...` → wiring document (wiring.json root)
 * - `#/ports/...`, `#/qubits/...`, etc. → state document
 */
export function resolveQuamRef(ref: unknown, state: unknown, wiringDocument: unknown): unknown {
	if (typeof ref !== 'string' || !ref.startsWith('#/')) {
		return ref;
	}
	const segments = parseJsonPointer(ref);
	if (!segments || segments.length === 0) {
		return undefined;
	}
	if (segments[0] === 'wiring') {
		return resolveJsonPointer(wiringDocument, segments);
	}
	return resolveJsonPointer(state, segments);
}
