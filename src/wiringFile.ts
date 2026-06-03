import * as vscode from 'vscode';

export interface WiringJson {
	wiring?: {
		qubits?: Record<string, unknown>;
		qubit_pairs?: Record<string, unknown>;
	};
	network?: Record<string, unknown>;
}

export function getWiringFileUri(stateUri: vscode.Uri): vscode.Uri {
	return vscode.Uri.joinPath(stateUri, '..', 'wiring.json');
}

export async function wiringFileExists(stateUri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(getWiringFileUri(stateUri));
		return true;
	} catch {
		return false;
	}
}

export async function readWiringFile(stateUri: vscode.Uri): Promise<WiringJson | undefined> {
	const wiringUri = getWiringFileUri(stateUri);
	try {
		const rawBytes = await vscode.workspace.fs.readFile(wiringUri);
		const text = new TextDecoder().decode(rawBytes);
		return JSON.parse(text) as WiringJson;
	} catch {
		return undefined;
	}
}

export function formatWiringFilePath(stateUri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): string {
	const wiringUri = getWiringFileUri(stateUri);
	const relative = vscode.workspace.asRelativePath(wiringUri, false);
	if (relative && !relative.startsWith('/') && !relative.includes(':\\')) {
		return relative;
	}
	return wiringUri.fsPath;
}
