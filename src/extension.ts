import * as vscode from 'vscode';

/** Minimal shape we need from state.json */
interface StateJson {
	qubits?: Record<string, unknown>;
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
		try {
			const bytes = await vscode.workspace.fs.readFile(stateUri);
			const text = new TextDecoder().decode(bytes);
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

		const selected = await vscode.window.showQuickPick(qubitNames, {
			placeHolder: 'Select a qubit',
		});

		if (selected !== undefined) {
			vscode.window.showInformationMessage(`Selected qubit: ${selected}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
