import * as vscode from 'vscode';
import { applyParameterEdits } from './apply.js';
import { buildParameterCatalog } from './catalog.js';
import { scanNumericParameters } from './parameterIndex.js';
import {
	getStateBackupUri,
	getStateFileUri,
	readStateFile,
} from './stateFile.js';
import { parseFiniteNumber } from './validation.js';
import { QuamStateEditorPanel } from './webview/panel.js';

async function runQuickPickFlow(folder: vscode.WorkspaceFolder): Promise<void> {
	const stateUri = getStateFileUri(folder);
	const backupUri = getStateBackupUri(folder);

	let data;
	let rawBytes: Uint8Array;
	try {
		const read = await readStateFile(stateUri);
		data = read.data;
		rawBytes = read.rawBytes;
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

	const catalog = buildParameterCatalog(data);

	const { result } = await applyParameterEdits(stateUri, backupUri, data, rawBytes, catalog, {
		edits: [{ qubit: qubitName, path: selected.path, newValue: String(newValue) }],
	});

	if (result.ok) {
		const action = await vscode.window.showInformationMessage(
			`Updated ${pathLabel}`,
			'Open state.json'
		);
		if (action === 'Open state.json') {
			await vscode.window.showTextDocument(stateUri);
		}
	} else {
		vscode.window.showErrorMessage(
			result.message ?? `Failed to update state.json.`
		);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "quam-state-editor" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('quam-state-editor.open', () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				vscode.window.showErrorMessage('Open a folder in the workspace first.');
				return;
			}
			QuamStateEditorPanel.createOrShow(context.extensionUri, folder);
		}),
		vscode.commands.registerCommand('quam-state-editor.openQuickPick', () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				vscode.window.showErrorMessage('Open a folder in the workspace first.');
				return;
			}
			void runQuickPickFlow(folder);
		})
	);
}

export function deactivate() {}
