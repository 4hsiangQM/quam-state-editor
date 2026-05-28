// @ts-check
(function () {
	const vscode = acquireVsCodeApi();

	/** @type {{
	 *   qubits: string[],
	 *   entries: Array<{
	 *     key: string,
	 *     kind: 'direct' | 'operation' | 'qubitProperty',
	 *     category: string,
	 *     operation?: string,
	 *     parameter: string,
	 *     byQubit: Record<string, { path: string[], value: number } | null>
	 *   }>,
	 *   qubitPropertyCategory: string,
	 *   qubitPropertyCategoryLabel: string
	 * }} */
	let catalog = {
		qubits: [],
		entries: [],
		qubitPropertyCategory: '__qubit_property__',
		qubitPropertyCategoryLabel: 'Qubit property',
	};

	const statusEl = document.getElementById('status');
	const stateFileEl = document.getElementById('state-file');
	const qubitListEl = document.getElementById('qubit-list');
	const categoryEl = /** @type {HTMLSelectElement} */ (document.getElementById('category'));
	const locationSection = document.getElementById('location-section');
	const operationSection = document.getElementById('operation-section');
	const operationEl = /** @type {HTMLSelectElement} */ (document.getElementById('operation'));
	const parameterEl = /** @type {HTMLSelectElement} */ (document.getElementById('parameter'));
	const valueBody = document.getElementById('value-body');
	const applyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('apply'));
	const reloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById('reload'));
	const changeFileBtn = /** @type {HTMLButtonElement} */ (document.getElementById('change-file'));

	function setStatus(text, isError) {
		statusEl.textContent = text;
		statusEl.classList.toggle('error', !!isError);
	}

	function getSelectedQubits() {
		return [...qubitListEl.querySelectorAll('input[type=checkbox]:checked')].map(
			(el) => /** @type {HTMLInputElement} */ (el).value
		);
	}

	function isQubitPropertyCategory() {
		return categoryEl.value === catalog.qubitPropertyCategory;
	}

	function getLocationKind() {
		const checked = document.querySelector('input[name=location]:checked');
		return checked ? /** @type {HTMLInputElement} */ (checked).value : 'direct';
	}

	function getSelectedEntry() {
		const key = parameterEl.value;
		if (!key) {
			return undefined;
		}
		return catalog.entries.find((e) => e.key === key);
	}

	/** @param {string[]} selectedQubits */
	function entriesForSelection(selectedQubits) {
		if (selectedQubits.length === 0) {
			return [];
		}

		const category = categoryEl.value;
		if (!category) {
			return [];
		}

		if (isQubitPropertyCategory()) {
			return catalog.entries.filter(
				(entry) =>
					entry.kind === 'qubitProperty' &&
					selectedQubits.every((q) => entry.byQubit[q])
			);
		}

		const kind = getLocationKind();
		return catalog.entries.filter((entry) => {
			if (entry.kind === 'qubitProperty' || entry.category !== category || entry.kind !== kind) {
				return false;
			}
			return selectedQubits.every((q) => entry.byQubit[q]);
		});
	}

	function fillSelect(select, options, placeholder) {
		select.innerHTML = '';
		const first = document.createElement('option');
		first.value = '';
		first.textContent = placeholder;
		select.appendChild(first);
		for (const opt of options) {
			const o = document.createElement('option');
			o.value = opt.value;
			o.textContent = opt.label;
			select.appendChild(o);
		}
		select.disabled = options.length === 0;
	}

	function renderQubits() {
		qubitListEl.innerHTML = '';
		for (const name of catalog.qubits) {
			const label = document.createElement('label');
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = name;
			input.addEventListener('change', onQubitSelectionChanged);
			label.appendChild(input);
			label.appendChild(document.createTextNode(name));
			qubitListEl.appendChild(label);
		}
	}

	function updateCategories() {
		const selectedQubits = getSelectedQubits();
		const previous = categoryEl.value;
		const categories = new Set();
		let hasQubitProperty = false;

		for (const entry of catalog.entries) {
			if (selectedQubits.length > 0 && !selectedQubits.every((q) => entry.byQubit[q])) {
				continue;
			}
			if (entry.kind === 'qubitProperty') {
				hasQubitProperty = true;
			} else {
				categories.add(entry.category);
			}
		}

		/** @type {Array<{ value: string, label: string }>} */
		const options = [...categories].sort().map((c) => ({ value: c, label: c }));
		if (hasQubitProperty) {
			options.push({
				value: catalog.qubitPropertyCategory,
				label: catalog.qubitPropertyCategoryLabel,
			});
			options.sort((a, b) => a.label.localeCompare(b.label));
		}

		fillSelect(categoryEl, options, 'Select category');
		categoryEl.disabled = selectedQubits.length === 0 || options.length === 0;
		if (previous && options.some((o) => o.value === previous)) {
			categoryEl.value = previous;
		}
	}

	function updateOperations() {
		const previous = operationEl.value;
		if (isQubitPropertyCategory()) {
			fillSelect(operationEl, [], '—');
			return;
		}
		const selectedQubits = getSelectedQubits();
		const entries = entriesForSelection(selectedQubits).filter((e) => e.kind === 'operation');
		const ops = [...new Set(entries.map((e) => e.operation).filter(Boolean))].sort();
		fillSelect(
			operationEl,
			ops.map((o) => ({ value: o, label: o })),
			'Select operation'
		);
		if (previous && ops.includes(previous)) {
			operationEl.value = previous;
		}
	}

	function updateParameters() {
		const previous = parameterEl.value;
		const selectedQubits = getSelectedQubits();
		let entries = entriesForSelection(selectedQubits);

		if (!isQubitPropertyCategory() && getLocationKind() === 'operation') {
			const op = operationEl.value;
			if (!op) {
				fillSelect(parameterEl, [], 'Select operation first');
				return;
			}
			entries = entries.filter((e) => e.operation === op);
		}

		fillSelect(
			parameterEl,
			entries.map((e) => ({ value: e.key, label: e.parameter })),
			'Select parameter'
		);
		if (previous && entries.some((e) => e.key === previous)) {
			parameterEl.value = previous;
		}
	}

	function readPendingNewValues() {
		/** @type {Map<string, string>} */
		const pending = new Map();
		for (const el of valueBody.querySelectorAll('input[data-qubit]')) {
			const input = /** @type {HTMLInputElement} */ (el);
			if (input.dataset.qubit) {
				pending.set(input.dataset.qubit, input.value);
			}
		}
		return pending;
	}

	function renderValueTable() {
		const pendingNewValues = readPendingNewValues();
		valueBody.innerHTML = '';
		const selectedQubits = getSelectedQubits();
		const entry = getSelectedEntry();

		applyBtn.disabled = !entry || selectedQubits.length === 0;

		if (!entry || selectedQubits.length === 0) {
			return;
		}

		for (const qubit of selectedQubits) {
			const tr = document.createElement('tr');
			const slot = entry.byQubit[qubit];

			const tdQ = document.createElement('td');
			tdQ.textContent = qubit;
			tr.appendChild(tdQ);

			const tdCurrent = document.createElement('td');
			const tdNew = document.createElement('td');

			if (!slot) {
				tdCurrent.colSpan = 2;
				tdCurrent.className = 'missing';
				tdCurrent.textContent = 'Not available for this qubit';
				tr.appendChild(tdCurrent);
			} else {
				tdCurrent.textContent = String(slot.value);
				const input = document.createElement('input');
				input.type = 'text';
				input.dataset.qubit = qubit;
				input.placeholder = 'leave blank to skip';
				if (pendingNewValues.has(qubit)) {
					input.value = pendingNewValues.get(qubit) ?? '';
				}
				tdNew.appendChild(input);
				tr.appendChild(tdCurrent);
				tr.appendChild(tdNew);
			}

			valueBody.appendChild(tr);
		}
	}

	function syncLocationSection() {
		const isProperty = isQubitPropertyCategory();
		locationSection.classList.toggle('hidden', isProperty);
		if (isProperty) {
			operationSection.classList.add('hidden');
		} else {
			operationSection.classList.toggle('hidden', getLocationKind() !== 'operation');
		}
	}

	function refreshParameterUi() {
		syncLocationSection();
		updateOperations();
		updateParameters();
		renderValueTable();
	}

	function onQubitSelectionChanged() {
		updateCategories();
		refreshParameterUi();
	}

	function onQubitOrLocationChanged() {
		updateCategories();
		refreshParameterUi();
	}

	function onCategoryChanged() {
		parameterEl.value = '';
		syncLocationSection();
		updateOperations();
		updateParameters();
		renderValueTable();
	}

	function onOperationChanged() {
		updateParameters();
		renderValueTable();
	}

	function resetCatalogUi() {
		categoryEl.value = '';
		parameterEl.value = '';
		operationEl.value = '';
		const directRadio = document.querySelector('input[name=location][value=direct]');
		if (directRadio instanceof HTMLInputElement) {
			directRadio.checked = true;
		}
		valueBody.innerHTML = '';
	}

	function onCatalog(message) {
		catalog = message.payload;
		if (stateFileEl && message.stateFilePath) {
			stateFileEl.textContent = `File: ${message.stateFilePath}`;
		}
		resetCatalogUi();
		renderQubits();
		setStatus(
			catalog.qubits.length === 0
				? 'No qubits in state.json.'
				: `Loaded ${catalog.qubits.length} qubit(s), ${catalog.entries.length} parameter(s).`
		);
		onQubitOrLocationChanged();
	}

	applyBtn.addEventListener('click', () => {
		const entry = getSelectedEntry();
		if (!entry) {
			return;
		}

		/** @type {Array<{ qubit: string, path: string[], newValue: string }>} */
		const edits = [];
		const inputs = valueBody.querySelectorAll('input[data-qubit]');
		for (const el of inputs) {
			const input = /** @type {HTMLInputElement} */ (el);
			const qubit = input.dataset.qubit;
			const slot = entry.byQubit[qubit];
			if (!slot) {
				continue;
			}
			edits.push({
				qubit,
				path: slot.path,
				newValue: input.value,
			});
		}

		vscode.postMessage({ type: 'apply', entryKey: entry.key, edits });
	});

	reloadBtn.addEventListener('click', () => {
		setStatus('Reloading…');
		vscode.postMessage({ type: 'reload' });
	});

	changeFileBtn.addEventListener('click', () => {
		setStatus('Choose another state.json…');
		vscode.postMessage({ type: 'changeStateFile' });
	});

	document.querySelectorAll('input[name=location]').forEach((el) => {
		el.addEventListener('change', onQubitOrLocationChanged);
	});
	categoryEl.addEventListener('change', onCategoryChanged);
	operationEl.addEventListener('change', onOperationChanged);
	parameterEl.addEventListener('change', renderValueTable);

	window.addEventListener('message', (event) => {
		const message = event.data;
		switch (message.type) {
			case 'catalog':
				onCatalog(message);
				break;
			case 'applyResult':
				if (message.ok) {
					setStatus(
						message.updatedLabels
							? `Applied: ${message.updatedLabels.join('; ')}`
							: 'Applied.'
					);
					renderValueTable();
				} else {
					let text = message.message || 'Apply failed.';
					if (message.errors?.length) {
						text +=
							' ' +
							message.errors.map((e) => `${e.qubit}: ${e.error}`).join('; ');
					}
					setStatus(text, true);
				}
				break;
			case 'status':
				setStatus(message.message, message.level === 'error');
				break;
		}
	});

	vscode.postMessage({ type: 'ready' });
})();
