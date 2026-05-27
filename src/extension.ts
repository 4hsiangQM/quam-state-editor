import * as vscode from 'vscode';

/** Minimal shape we need from state.json */
interface StateJson {
	qubits?: Record<string, unknown>;
	[key: string]: unknown;
}

interface NumericParameter {
	label: string;
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
function scanNumericParameters(qubitName: string, qubit: unknown): NumericParameter[] {
	const results: NumericParameter[] = [];
	const basePath = ['qubits', qubitName];

	function visit(node: unknown, pathFromQubit: string[]): void {
		if (typeof node === 'number') {
			const relative = pathFromQubit.join('.');
			results.push({
				label: `${relative} = ${node}`,
				path: [...basePath, ...pathFromQubit],
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

/**
 * Set a numeric leaf at path (e.g. ["qubits", "q1", "xy", "amplitude"]).
 * Throws if the path is invalid or the existing value is not a number.
 */
function setValueAtPath(root: unknown, path: string[], newValue: number): void {
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

function parseFiniteNumber(input: string): number | undefined {
	const trimmed = input.trim();
	if (trimmed === '') {
		return undefined;
	}
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : undefined;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "quam-state-editor" is now active!');

	const disposable = vscode.commands.registerCommand('quam-state-editor.open', async () => {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			vscode.window.showErrorMessage('Open a folder in the workspace first.');
			return;
		}

		const stateUri = vscode.Uri.joinPath(folder.uri, 'quam_state', 'state.json');

		let data: StateJson;
		let fileBytes: Uint8Array;
		try {
			fileBytes = await vscode.workspace.fs.readFile(stateUri);
			const text = new TextDecoder().decode(fileBytes);
			data = JSON.parse(text) as StateJson;
		} catch (err) {
			vscode.window.showErrorMessage(
				`Could not read quam_state/state.json: ${err instanceof Error ? err.message : String(err)}`
			);
			return;
		}

		if (!data.qubits || typeof data.qubits !== 'object') {
			vscode.window.showErrorMessage('state.json has no "qubits" object.');
			return;
		}

		const qubitNames = Object.keys(data.qubits);
		if (qubitNames.length === 0) {
			vscode.window.showWarningMessage('No qubits found in state.json.');
			return;
		}

		const qubitName = await vscode.window.showQuickPick(qubitNames, {
			placeHolder: 'Select a qubit',
		});
		if (qubitName === undefined) {
			return;
		}

		const parameters = scanNumericParameters(qubitName, data.qubits[qubitName]);
		if (parameters.length === 0) {
			vscode.window.showWarningMessage(`No numeric parameters found for qubit "${qubitName}".`);
			return;
		}

		const selected = await vscode.window.showQuickPick(parameters, {
			placeHolder: 'Select a parameter',
		});
		if (selected === undefined) {
			return;
		}

		const pathLabel = selected.path.join('.');
		const input = await vscode.window.showInputBox({
			title: 'Edit parameter',
			prompt: pathLabel,
			value: String(selected.value),
			validateInput: (text) =>
				parseFiniteNumber(text) === undefined ? 'Enter a finite number.' : undefined,
		});
		if (input === undefined) {
			return;
		}

		const newValue = parseFiniteNumber(input);
		if (newValue === undefined) {
			vscode.window.showErrorMessage('Enter a finite number.');
			return;
		}

		const choice = await vscode.window.showWarningMessage(
			`Update ${pathLabel} from ${selected.value} to ${newValue}?`,
			'Apply',
			'Cancel'
		);
		if (choice !== 'Apply') {
			return;
		}

		const backupUri = vscode.Uri.joinPath(folder.uri, 'quam_state', 'state.json.bak');
		try {
			await vscode.workspace.fs.writeFile(backupUri, fileBytes);
			setValueAtPath(data, selected.path, newValue);
			const output = new TextEncoder().encode(JSON.stringify(data, null, 2));
			await vscode.workspace.fs.writeFile(stateUri, output);
			vscode.window.showInformationMessage(`Updated ${pathLabel}`);
		} catch (err) {
			vscode.window.showErrorMessage(
				`Failed to update state.json: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
