import {
	isNumeric1dArray,
	isNumeric2dMatrix,
	QUBIT_MATRIX_FIELD_NAMES,
	QUBIT_PAIR_SKIP_FIELD_NAMES,
	SCALAR_ARRAY_FIELD_NAMES,
	WHOLE_JSON_ARRAY_FIELD_NAMES,
} from './arrayFields.js';

export type ParameterValueKind = 'number' | 'matrix' | 'array';

export interface ScannedParameter {
	label: string;
	description: string;
	detail: string;
	path: string[];
	valueKind: ParameterValueKind;
	/** Scalar value, or unused for matrix entries. */
	value: number;
	/** Pretty JSON for matrix entries (Current column / default New). */
	displayValue: string;
}

/** @deprecated Use ScannedParameter */
export type NumericParameter = ScannedParameter;

const IGNORED_KEYS = new Set([
	'__class__',
	'id',
	'macros',
	'core',
	'opx_input',
	'opx_output',
]);

export interface EntityScanOptions {
	basePath: string[];
	root: unknown;
	matrixFieldNames?: Set<string>;
	jsonArrayFieldNames?: Set<string>;
	skipFieldNames?: Set<string>;
	scalarArrayFieldNames?: Set<string>;
}

function formatJsonArray(values: number[] | number[][]): string {
	return JSON.stringify(values);
}

export function scanEntityParameters(options: EntityScanOptions): ScannedParameter[] {
	const {
		basePath,
		root,
		matrixFieldNames = new Set<string>(),
		jsonArrayFieldNames = new Set<string>(),
		skipFieldNames = new Set<string>(),
		scalarArrayFieldNames = new Set<string>(),
	} = options;
	const results: ScannedParameter[] = [];

	function visit(node: unknown, pathFromEntity: string[]): void {
		if (typeof node === 'number') {
			const path = [...basePath, ...pathFromEntity];
			const relative = pathFromEntity.join('.');
			results.push({
				label: relative,
				description: String(node),
				detail: `/${path.join('/')}`,
				path,
				valueKind: 'number',
				value: node,
				displayValue: String(node),
			});
			return;
		}

		if (node === null || typeof node !== 'object' || Array.isArray(node)) {
			return;
		}

		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (IGNORED_KEYS.has(key) || skipFieldNames.has(key)) {
				continue;
			}

			const childPath = [...pathFromEntity, key];
			const relative = childPath.join('.');

			if (matrixFieldNames.has(key) && isNumeric2dMatrix(value)) {
				const path = [...basePath, ...childPath];
				const json = formatJsonArray(value);
				results.push({
					label: relative,
					description: json,
					detail: `/${path.join('/')}`,
					path,
					valueKind: 'matrix',
					value: 0,
					displayValue: json,
				});
				continue;
			}

			if (jsonArrayFieldNames.has(key) && isNumeric1dArray(value)) {
				const path = [...basePath, ...childPath];
				const json = formatJsonArray(value);
				results.push({
					label: relative,
					description: json,
					detail: `/${path.join('/')}`,
					path,
					valueKind: 'array',
					value: 0,
					displayValue: json,
				});
				continue;
			}

			if (scalarArrayFieldNames.has(key) && isNumeric1dArray(value)) {
				for (let index = 0; index < value.length; index++) {
					const elementPath = [...childPath, String(index)];
					const elementRelative = `${relative}[${index}]`;
					const path = [...basePath, ...elementPath];
					const elementValue = value[index];
					results.push({
						label: elementRelative,
						description: String(elementValue),
						detail: `/${path.join('/')}`,
						path,
						valueKind: 'number',
						value: elementValue,
						displayValue: String(elementValue),
					});
				}
				continue;
			}

			visit(value, childPath);
		}
	}

	visit(root, []);
	return results.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Recursively collect editable parameters under one qubit object.
 * Paths are rooted at ["qubits", qubitName, ...].
 */
export function scanNumericParameters(qubitName: string, qubit: unknown): ScannedParameter[] {
	return scanEntityParameters({
		basePath: ['qubits', qubitName],
		root: qubit,
		matrixFieldNames: QUBIT_MATRIX_FIELD_NAMES,
		scalarArrayFieldNames: SCALAR_ARRAY_FIELD_NAMES,
	});
}

/**
 * Recursively collect editable parameters under one qubit_pair object.
 * Paths are rooted at ["qubit_pairs", pairName, ...].
 */
export function scanQubitPairParameters(pairName: string, pair: unknown): ScannedParameter[] {
	return scanEntityParameters({
		basePath: ['qubit_pairs', pairName],
		root: pair,
		skipFieldNames: QUBIT_PAIR_SKIP_FIELD_NAMES,
		jsonArrayFieldNames: WHOLE_JSON_ARRAY_FIELD_NAMES,
		scalarArrayFieldNames: SCALAR_ARRAY_FIELD_NAMES,
	});
}
