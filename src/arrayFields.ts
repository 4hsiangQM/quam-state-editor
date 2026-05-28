/** Qubit resonator matrices edited as whole JSON in the webview. */
export const QUBIT_MATRIX_FIELD_NAMES = new Set(['confusion_matrix', 'gef_confusion_matrix']);

/** Qubit-pair confusion matrices — intentionally excluded from the editor. */
export const QUBIT_PAIR_SKIP_FIELD_NAMES = new Set([
	'confusion',
	'confusion_3q',
	'confusion_4q',
	'confusion_5q',
]);

/** 1D numeric arrays edited as whole JSON (same UI as confusion matrices). */
export const WHOLE_JSON_ARRAY_FIELD_NAMES = new Set(['flux_values', 'J_vs_flux']);

/** 1D numeric arrays expanded to scalar parameters (field[i]). */
export const SCALAR_ARRAY_FIELD_NAMES = new Set(['filter_fir_taps', 'filter_iir_taps']);

export function isNumeric1dArray(value: unknown): value is number[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((element) => typeof element === 'number')
	);
}

export function isNumeric2dMatrix(value: unknown): value is number[][] {
	if (!Array.isArray(value) || value.length === 0) {
		return false;
	}
	const firstRow = value[0];
	if (!Array.isArray(firstRow) || firstRow.length === 0) {
		return false;
	}
	const width = firstRow.length;
	return value.every(
		(row) =>
			Array.isArray(row) &&
			row.length === width &&
			row.every((element) => typeof element === 'number')
	);
}
