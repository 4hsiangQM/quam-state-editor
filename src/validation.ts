import { isNumeric1dArray, isNumeric2dMatrix } from './arrayFields.js';

export function parseFiniteNumber(text: string): number | undefined {
	const trimmed = text.trim();
	if (trimmed === '') {
		return undefined;
	}
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : undefined;
}

export function parseNumericMatrixJson(
	text: string,
	existing?: number[][]
): { ok: true; matrix: number[][] } | { ok: false; error: string } {
	const trimmed = text.trim();
	if (trimmed === '') {
		return { ok: false, error: 'Enter a JSON matrix.' };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { ok: false, error: 'Invalid JSON.' };
	}

	if (!isNumeric2dMatrix(parsed)) {
		return { ok: false, error: 'Expected a rectangular 2D array of numbers.' };
	}

	if (existing) {
		if (parsed.length !== existing.length) {
			return {
				ok: false,
				error: `Row count must stay ${existing.length} (got ${parsed.length}).`,
			};
		}
		const expectedWidth = existing[0]?.length ?? 0;
		if (parsed[0]?.length !== expectedWidth) {
			return {
				ok: false,
				error: `Column count must stay ${expectedWidth} (got ${parsed[0]?.length ?? 0}).`,
			};
		}
	}

	return { ok: true, matrix: parsed };
}

export function parseNumeric1dArrayJson(
	text: string,
	existing?: number[]
): { ok: true; values: number[] } | { ok: false; error: string } {
	const trimmed = text.trim();
	if (trimmed === '') {
		return { ok: false, error: 'Enter a JSON array.' };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { ok: false, error: 'Invalid JSON.' };
	}

	if (!isNumeric1dArray(parsed)) {
		return { ok: false, error: 'Expected a 1D array of numbers.' };
	}

	if (existing && parsed.length !== existing.length) {
		return {
			ok: false,
			error: `Length must stay ${existing.length} (got ${parsed.length}).`,
		};
	}

	return { ok: true, values: parsed };
}
