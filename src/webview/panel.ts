import * as vscode from 'vscode';
import { applyParameterEdits } from '../apply.js';
import {
	buildParameterCatalog,
	buildQubitPairCatalog,
	QUBIT_PROPERTY_CATEGORY,
	QUBIT_PROPERTY_CATEGORY_LABEL,
	PAIR_PROPERTY_CATEGORY,
	PAIR_PROPERTY_CATEGORY_LABEL,
	type EditorCatalogPayload,
	type ParameterCatalog,
	type QubitPairCatalog,
} from '../catalog.js';
import {
	formatStateFilePath,
	getBackupUriForStateFile,
	promptSelectStateFileUri,
	readStateFile,
	type StateJson,
} from '../stateFile.js';
import type { EditorTarget, HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';

const EMPTY_QUBIT_CATALOG: ParameterCatalog = {
	qubits: [],
	entries: [],
	qubitPropertyCategory: QUBIT_PROPERTY_CATEGORY,
	qubitPropertyCategoryLabel: QUBIT_PROPERTY_CATEGORY_LABEL,
};

const EMPTY_PAIR_CATALOG: QubitPairCatalog = {
	pairs: [],
	entries: [],
	pairPropertyCategory: PAIR_PROPERTY_CATEGORY,
	pairPropertyCategoryLabel: PAIR_PROPERTY_CATEGORY_LABEL,
};

export class QuamStateEditorPanel {
	public static readonly viewType = 'quamStateEditor';

	private static currentPanel: QuamStateEditorPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;
	private readonly context: vscode.ExtensionContext;
	private readonly workspaceFolder: vscode.WorkspaceFolder;

	private stateUri: vscode.Uri;
	private backupUri: vscode.Uri;

	private data: StateJson = {};
	private rawBytes: Uint8Array = new Uint8Array();
	private qubitCatalog: ParameterCatalog = EMPTY_QUBIT_CATALOG;
	private qubitPairCatalog: QubitPairCatalog = EMPTY_PAIR_CATALOG;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		context: vscode.ExtensionContext,
		workspaceFolder: vscode.WorkspaceFolder,
		stateUri: vscode.Uri
	) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.context = context;
		this.workspaceFolder = workspaceFolder;
		this.stateUri = stateUri;
		this.backupUri = getBackupUriForStateFile(stateUri);

		this.panel.webview.html = this.getHtml();

		this.panel.webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
			void this.handleMessage(message);
		});

		this.panel.onDidDispose(() => {
			QuamStateEditorPanel.currentPanel = undefined;
		});
	}

	public static async createOrShow(
		extensionUri: vscode.Uri,
		context: vscode.ExtensionContext,
		workspaceFolder: vscode.WorkspaceFolder,
		stateUri: vscode.Uri
	): Promise<void> {
		const column = vscode.window.activeTextEditor?.viewColumn;

		if (QuamStateEditorPanel.currentPanel) {
			QuamStateEditorPanel.currentPanel.setStateFile(stateUri);
			QuamStateEditorPanel.currentPanel.panel.reveal(column);
			await QuamStateEditorPanel.currentPanel.reloadCatalog();
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			QuamStateEditorPanel.viewType,
			'QuAM State Editor',
			column ?? vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			}
		);

		QuamStateEditorPanel.currentPanel = new QuamStateEditorPanel(
			panel,
			extensionUri,
			context,
			workspaceFolder,
			stateUri
		);
	}

	public async changeStateFile(): Promise<void> {
		const picked = await promptSelectStateFileUri(
			this.context,
			this.workspaceFolder,
			this.stateUri
		);
		if (!picked) {
			return;
		}
		this.setStateFile(picked);
		await this.reloadCatalog();
		vscode.window.showInformationMessage(`Now editing: ${this.stateFilePathLabel()}`);
	}

	public static getCurrentPanel(): QuamStateEditorPanel | undefined {
		return QuamStateEditorPanel.currentPanel;
	}

	public getStateFileUri(): vscode.Uri {
		return this.stateUri;
	}

	public setStateFile(stateUri: vscode.Uri): void {
		this.stateUri = stateUri;
		this.backupUri = getBackupUriForStateFile(stateUri);
	}

	private postMessage(message: HostToWebviewMessage): void {
		void this.panel.webview.postMessage(message);
	}

	private stateFilePathLabel(): string {
		return formatStateFilePath(this.stateUri, this.workspaceFolder);
	}

	private catalogPayload(): EditorCatalogPayload {
		return {
			qubitCatalog: this.qubitCatalog,
			qubitPairCatalog: this.qubitPairCatalog,
		};
	}

	private postCatalog(): void {
		this.postMessage({
			type: 'catalog',
			payload: this.catalogPayload(),
			stateFilePath: this.stateFilePathLabel(),
		});
	}

	async reloadCatalog(): Promise<void> {
		try {
			const read = await readStateFile(this.stateUri);
			this.data = read.data;
			this.rawBytes = read.rawBytes;

			this.qubitCatalog =
				this.data.qubits && typeof this.data.qubits === 'object'
					? buildParameterCatalog(this.data)
					: EMPTY_QUBIT_CATALOG;

			this.qubitPairCatalog =
				this.data.qubit_pairs && typeof this.data.qubit_pairs === 'object'
					? buildQubitPairCatalog(this.data)
					: EMPTY_PAIR_CATALOG;

			const hasQubits = this.qubitCatalog.qubits.length > 0;
			const hasPairs = this.qubitPairCatalog.pairs.length > 0;

			if (!hasQubits && !hasPairs) {
				this.postMessage({
					type: 'status',
					message: `${this.stateFilePathLabel()}: no "qubits" or "qubit_pairs" found.`,
					level: 'error',
				});
			}

			this.postCatalog();
		} catch (err) {
			this.postMessage({
				type: 'status',
				message: `Could not read ${this.stateFilePathLabel()}: ${err instanceof Error ? err.message : String(err)}`,
				level: 'error',
			});
		}
	}

	private async handleMessage(message: WebviewToHostMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
			case 'reload':
				await this.reloadCatalog();
				break;
			case 'changeStateFile':
				await this.changeStateFile();
				break;
			case 'apply':
				await this.handleApply(message);
				break;
		}
	}

	private catalogForTarget(target: EditorTarget): ParameterCatalog | QubitPairCatalog {
		return target === 'qubit_pairs' ? this.qubitPairCatalog : this.qubitCatalog;
	}

	private async handleApply(
		message: Extract<WebviewToHostMessage, { type: 'apply' }>
	): Promise<void> {
		const catalog = this.catalogForTarget(message.target);

		const { result, data, rawBytes } = await applyParameterEdits(
			this.stateUri,
			this.backupUri,
			this.data,
			this.rawBytes,
			catalog,
			{ edits: message.edits }
		);

		if (result.ok) {
			this.data = data;
			this.rawBytes = rawBytes;
			this.qubitCatalog = buildParameterCatalog(this.data);
			this.qubitPairCatalog = buildQubitPairCatalog(this.data);
			this.postCatalog();
			this.postMessage({ type: 'applyResult', ok: true, updatedLabels: result.updatedLabels });

			const summary =
				result.updatedLabels && result.updatedLabels.length > 0
					? `Updated ${result.updatedLabels.length} value(s).`
					: 'Updated.';
			const action = await vscode.window.showInformationMessage(summary, 'Open state.json');
			if (action === 'Open state.json') {
				await vscode.window.showTextDocument(this.stateUri);
			}
		} else {
			this.postMessage({
				type: 'applyResult',
				ok: false,
				message: result.message,
				errors: result.errors,
			});
		}
	}

	private getHtml(): string {
		const mediaRoot = vscode.Uri.joinPath(this.extensionUri, 'media');
		const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'main.js'));
		const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles.css'));
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>QuAM State Editor</title>
</head>
<body>
	<header>
		<h1>QuAM State Editor</h1>
		<p id="status" class="status">Loading…</p>
		<p id="state-file" class="state-file"></p>
	</header>

	<nav class="domain-tabs" role="tablist" aria-label="Edit target">
		<button type="button" class="domain-tab active" data-target="qubits" role="tab">Qubit</button>
		<button type="button" class="domain-tab" data-target="qubit_pairs" role="tab">Qubit pair</button>
	</nav>

	<section class="field">
		<label id="entity-list-label">Qubits</label>
		<div id="entity-list" class="entity-list"></div>
	</section>

	<section class="field">
		<label for="category">Category</label>
		<select id="category" disabled><option value="">—</option></select>
	</section>

	<section class="field" id="location-section">
		<span class="label">Location</span>
		<div class="radio-row">
			<label><input type="radio" name="location" value="direct" checked /> On category</label>
			<label><input type="radio" name="location" value="operation" /> In operation</label>
		</div>
	</section>

	<section class="field hidden" id="operation-section">
		<label for="operation">Operation</label>
		<select id="operation" disabled><option value="">—</option></select>
	</section>

	<section class="field">
		<label for="parameter">Parameter</label>
		<select id="parameter" disabled><option value="">—</option></select>
	</section>

	<section class="field">
		<label>Values</label>
		<p id="values-hint" class="hint">Blank new value = do not change that qubit.</p>
		<table id="value-table" class="value-table">
			<thead>
				<tr>
					<th id="value-col-entity">Qubit</th>
					<th>Current</th>
					<th>New</th>
				</tr>
			</thead>
			<tbody id="value-body"></tbody>
		</table>
	</section>

	<footer class="actions">
		<button id="apply" type="button" disabled>Apply</button>
		<button id="reload" type="button" class="secondary">Reload</button>
		<button id="change-file" type="button" class="secondary">Change file…</button>
	</footer>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
