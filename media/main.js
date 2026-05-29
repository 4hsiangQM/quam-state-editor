// @ts-check
(function () {
	const vscode = acquireVsCodeApi();

	/** @typedef {'qubits' | 'qubit_pairs'} EditorTarget */

	/** @type {{
	 *   qubitCatalog: {
	 *     qubits: string[],
	 *     entries: Array<{
	 *       key: string,
	 *       kind: 'direct' | 'operation' | 'qubitProperty' | 'matrix',
	 *       category: string,
	 *       operation?: string,
	 *       parameter: string,
	 *       byQubit: Record<string, { path: string[], valueKind: 'number' | 'matrix', value?: number, matrixJson?: string } | null>
	 *     }>,
	 *     qubitPropertyCategory: string,
	 *     qubitPropertyCategoryLabel: string
	 *   },
	 *   qubitPairCatalog: {
	 *     pairs: string[],
	 *     entries: Array<{
	 *       key: string,
	 *       kind: 'direct' | 'operation' | 'qubitProperty',
	 *       category: string,
	 *       operation?: string,
	 *       parameter: string,
	 *       byPair: Record<string, { path: string[], valueKind: 'number' | 'matrix', value?: number, matrixJson?: string } | null>
	 *     }>,
	 *     pairPropertyCategory: string,
	 *     pairPropertyCategoryLabel: string
	 *   }
	 * }} */
	let payload = {
		qubitCatalog: {
			qubits: [],
			entries: [],
			qubitPropertyCategory: '__qubit_property__',
			qubitPropertyCategoryLabel: 'Qubit property',
		},
		qubitPairCatalog: {
			pairs: [],
			entries: [],
			pairPropertyCategory: '__pair_property__',
			pairPropertyCategoryLabel: 'Pair property',
		},
	};

	/** @type {EditorTarget} */
	let activeTarget = 'qubits';

	const statusEl = document.getElementById('status');
	const stateFileEl = document.getElementById('state-file');
	const domainTabs = document.querySelectorAll('.domain-tab');
	const entityListLabel = document.getElementById('entity-list-label');
	const entityListEl = document.getElementById('entity-list');
	const categoryEl = /** @type {HTMLSelectElement} */ (document.getElementById('category'));
	const locationSection = document.getElementById('location-section');
	const locationDirectLabel = document.getElementById('location-direct-label');
	const locationOperationLabel = document.getElementById('location-operation-label');
	const operationSection = document.getElementById('operation-section');
	const operationEl = /** @type {HTMLSelectElement} */ (document.getElementById('operation'));
	const parameterEl = /** @type {HTMLSelectElement} */ (document.getElementById('parameter'));
	const valuesHintEl = document.getElementById('values-hint');
	const valueColEntity = document.getElementById('value-col-entity');
	const valueBody = document.getElementById('value-body');
	const applyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('apply'));
	const reloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById('reload'));
	const changeFileBtn = /** @type {HTMLButtonElement} */ (document.getElementById('change-file'));

	function activeCatalog() {
		return activeTarget === 'qubit_pairs' ? payload.qubitPairCatalog : payload.qubitCatalog;
	}

	function entityNames() {
		const cat = activeCatalog();
		return activeTarget === 'qubit_pairs' ? cat.pairs : cat.qubits;
	}

	function slotForEntry(entry, entityName) {
		return activeTarget === 'qubit_pairs' ? entry.byPair[entityName] : entry.byQubit[entityName];
	}

	function propertyCategoryId() {
		const cat = activeCatalog();
		return activeTarget === 'qubit_pairs'
			? payload.qubitPairCatalog.pairPropertyCategory
			: payload.qubitCatalog.qubitPropertyCategory;
	}

	function propertyCategoryLabel() {
		const cat = activeCatalog();
		return activeTarget === 'qubit_pairs'
			? payload.qubitPairCatalog.pairPropertyCategoryLabel
			: payload.qubitCatalog.qubitPropertyCategoryLabel;
	}

	function setStatus(text, isError) {
		statusEl.textContent = text;
		statusEl.classList.toggle('error', !!isError);
	}

	function getSelectedEntities() {
		return [...entityListEl.querySelectorAll('input[type=checkbox]:checked')].map(
			(el) => /** @type {HTMLInputElement} */ (el).value
		);
	}

	function isPropertyCategory() {
		return categoryEl.value === propertyCategoryId();
	}

	function getLocationKind() {
		const checked = document.querySelector('input[name=location]:checked');
		return checked ? /** @type {HTMLInputElement} */ (checked).value : 'direct';
	}

	function isJsonBlobKind(valueKind) {
		return valueKind === 'matrix' || valueKind === 'array';
	}

	function getSelectedEntry() {
		const key = parameterEl.value;
		if (!key) {
			return undefined;
		}
		return activeCatalog().entries.find((e) => e.key === key);
	}

	/** @param {string[]} selectedEntities */
	function entriesForSelection(selectedEntities) {
		if (selectedEntities.length === 0) {
			return [];
		}

		const category = categoryEl.value;
		if (!category) {
			return [];
		}

		if (isPropertyCategory()) {
			return activeCatalog().entries.filter(
				(entry) =>
					entry.kind === 'qubitProperty' &&
					selectedEntities.every((name) => slotForEntry(entry, name))
			);
		}

		const kind = getLocationKind();
		return activeCatalog().entries.filter((entry) => {
			if (entry.kind === 'qubitProperty' || entry.category !== category) {
				return false;
			}
			if (entry.kind === 'matrix' || entry.kind === 'array') {
				return kind === 'direct' && selectedEntities.every((name) => slotForEntry(entry, name));
			}
			if (entry.kind !== kind) {
				return false;
			}
			return selectedEntities.every((name) => slotForEntry(entry, name));
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

	function renderEntityList() {
		entityListEl.innerHTML = '';
		for (const name of entityNames()) {
			const label = document.createElement('label');
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = name;
			input.addEventListener('change', onEntitySelectionChanged);
			label.appendChild(input);
			label.appendChild(document.createTextNode(name));
			entityListEl.appendChild(label);
		}
	}

	function updateCategories() {
		const selected = getSelectedEntities();
		const previous = categoryEl.value;
		const categories = new Set();
		let hasProperty = false;

		for (const entry of activeCatalog().entries) {
			if (selected.length > 0 && !selected.every((name) => slotForEntry(entry, name))) {
				continue;
			}
			if (entry.kind === 'qubitProperty') {
				hasProperty = true;
			} else {
				categories.add(entry.category);
			}
		}

		/** @type {Array<{ value: string, label: string }>} */
		const options = [...categories].sort().map((c) => ({ value: c, label: c }));
		if (hasProperty) {
			options.push({
				value: propertyCategoryId(),
				label: propertyCategoryLabel(),
			});
			options.sort((a, b) => a.label.localeCompare(b.label));
		}

		fillSelect(categoryEl, options, 'Select category');
		categoryEl.disabled = selected.length === 0 || options.length === 0;
		if (previous && options.some((o) => o.value === previous)) {
			categoryEl.value = previous;
		}
	}

	function updateOperations() {
		const previous = operationEl.value;
		if (isPropertyCategory()) {
			fillSelect(operationEl, [], '—');
			return;
		}
		const selected = getSelectedEntities();
		const entries = entriesForSelection(selected).filter((e) => e.kind === 'operation');
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
		const selected = getSelectedEntities();
		let entries = entriesForSelection(selected);

		if (!isPropertyCategory() && getLocationKind() === 'operation') {
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
		for (const el of valueBody.querySelectorAll('input[data-entity], textarea[data-entity]')) {
			const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el);
			if (input.dataset.entity) {
				pending.set(input.dataset.entity, input.value);
			}
		}
		return pending;
	}

	function formatCurrentValue(slot) {
		if (isJsonBlobKind(slot.valueKind)) {
			return slot.matrixJson ?? '';
		}
		return String(slot.value ?? '');
	}

	function truncateDisplay(text, maxLen) {
		if (text.length <= maxLen) {
			return text;
		}
		return `${text.slice(0, maxLen)}…`;
	}

	function renderValueTable() {
		const pendingNewValues = readPendingNewValues();
		valueBody.innerHTML = '';
		const selected = getSelectedEntities();
		const entry = getSelectedEntry();

		applyBtn.disabled = !entry || selected.length === 0;

		if (!entry || selected.length === 0) {
			return;
		}

		const missingLabel =
			activeTarget === 'qubit_pairs' ? 'Not available for this pair' : 'Not available for this qubit';

		for (const entityName of selected) {
			const tr = document.createElement('tr');
			const slot = slotForEntry(entry, entityName);

			const tdEntity = document.createElement('td');
			tdEntity.textContent = entityName;
			tr.appendChild(tdEntity);

			const tdCurrent = document.createElement('td');
			const tdNew = document.createElement('td');

			if (!slot) {
				tdCurrent.colSpan = 2;
				tdCurrent.className = 'missing';
				tdCurrent.textContent = missingLabel;
				tr.appendChild(tdCurrent);
			} else {
				const currentText = formatCurrentValue(slot);
				tdCurrent.textContent = isJsonBlobKind(slot.valueKind)
					? truncateDisplay(currentText, 80)
					: currentText;
				if (isJsonBlobKind(slot.valueKind)) {
					tdCurrent.title = currentText;
				}

				if (isJsonBlobKind(slot.valueKind)) {
					const textarea = document.createElement('textarea');
					textarea.rows = 5;
					textarea.dataset.entity = entityName;
					textarea.dataset.valueKind = slot.valueKind;
					textarea.placeholder = 'Paste JSON array; leave blank to skip';
					textarea.className = 'matrix-input';
					if (pendingNewValues.has(entityName)) {
						textarea.value = pendingNewValues.get(entityName) ?? '';
					}
					tdNew.appendChild(textarea);
				} else {
					const input = document.createElement('input');
					input.type = 'text';
					input.dataset.entity = entityName;
					input.dataset.valueKind = 'number';
					input.placeholder = 'leave blank to skip';
					if (pendingNewValues.has(entityName)) {
						input.value = pendingNewValues.get(entityName) ?? '';
					}
					tdNew.appendChild(input);
				}
				tr.appendChild(tdCurrent);
				tr.appendChild(tdNew);
			}

			valueBody.appendChild(tr);
		}
	}

	/** @param {'direct' | 'operation'} locationKind @param {string[]} selectedEntities */
	function categoryEntriesForLocationKind(locationKind, selectedEntities) {
		const category = categoryEl.value;
		if (!category || isPropertyCategory() || selectedEntities.length === 0) {
			return [];
		}

		return activeCatalog().entries.filter((entry) => {
			if (entry.kind === 'qubitProperty' || entry.category !== category) {
				return false;
			}
			if (locationKind === 'direct') {
				if (entry.kind !== 'direct' && entry.kind !== 'matrix' && entry.kind !== 'array') {
					return false;
				}
			} else if (entry.kind !== 'operation') {
				return false;
			}
			return selectedEntities.every((name) => slotForEntry(entry, name));
		});
	}

	function setLocationKind(kind) {
		const radio = document.querySelector(`input[name=location][value=${kind}]`);
		if (radio instanceof HTMLInputElement) {
			radio.checked = true;
		}
	}

	function syncLocationSection() {
		const isProperty = isPropertyCategory();
		if (isProperty) {
			locationSection.classList.add('hidden');
			operationSection.classList.add('hidden');
			return;
		}

		const selected = getSelectedEntities();
		const hasDirect = categoryEntriesForLocationKind('direct', selected).length > 0;
		const hasOperation = categoryEntriesForLocationKind('operation', selected).length > 0;

		locationDirectLabel?.classList.toggle('hidden', !hasDirect);
		locationOperationLabel?.classList.toggle('hidden', !hasOperation);

		const currentKind = getLocationKind();
		if (currentKind === 'direct' && !hasDirect && hasOperation) {
			setLocationKind('operation');
		} else if (currentKind === 'operation' && !hasOperation && hasDirect) {
			setLocationKind('direct');
		} else if (!hasDirect && hasOperation) {
			setLocationKind('operation');
		} else if (hasDirect && !hasOperation) {
			setLocationKind('direct');
		}

		const showLocationChoice = hasDirect && hasOperation;
		locationSection.classList.toggle('hidden', !showLocationChoice);
		operationSection.classList.toggle(
			'hidden',
			getLocationKind() !== 'operation' || !hasOperation
		);
	}

	function refreshParameterUi() {
		syncLocationSection();
		updateOperations();
		updateParameters();
		renderValueTable();
	}

	function onEntitySelectionChanged() {
		updateCategories();
		refreshParameterUi();
	}

	function onEntityOrLocationChanged() {
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

	function updateDomainTabState() {
		const qCount = payload.qubitCatalog.qubits.length;
		const pCount = payload.qubitPairCatalog.pairs.length;
		for (const tab of domainTabs) {
			const target = tab.getAttribute('data-target');
			tab.classList.toggle('active', target === activeTarget);
			const count = target === 'qubit_pairs' ? pCount : qCount;
			tab.disabled = count === 0 && target !== activeTarget;
		}
	}

	function applyTargetUi() {
		if (activeTarget === 'qubit_pairs') {
			entityListLabel.textContent = 'Qubit pairs';
			if (valueColEntity) {
				valueColEntity.textContent = 'Pair';
			}
			if (valuesHintEl) {
				valuesHintEl.textContent = 'Blank new value = do not change that pair.';
			}
		} else {
			entityListLabel.textContent = 'Qubits';
			if (valueColEntity) {
				valueColEntity.textContent = 'Qubit';
			}
			if (valuesHintEl) {
				valuesHintEl.textContent = 'Blank new value = do not change that qubit.';
			}
		}
		renderEntityList();
		updateCategories();
		refreshParameterUi();
		updateDomainTabState();
	}

	function buildStatusMessage() {
		const q = payload.qubitCatalog.qubits.length;
		const p = payload.qubitPairCatalog.pairs.length;
		if (q === 0 && p === 0) {
			return 'No qubits or qubit pairs in state.json.';
		}
		return `Loaded ${q} qubit(s), ${p} pair(s).`;
	}

	function onCatalog(message) {
		payload = message.payload;
		if (stateFileEl && message.stateFilePath) {
			stateFileEl.textContent = `File: ${message.stateFilePath}`;
		}
		resetCatalogUi();

		if (
			activeTarget === 'qubits' &&
			payload.qubitCatalog.qubits.length === 0 &&
			payload.qubitPairCatalog.pairs.length > 0
		) {
			activeTarget = 'qubit_pairs';
		}

		applyTargetUi();
		setStatus(buildStatusMessage());
	}

	domainTabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			const target = tab.getAttribute('data-target');
			if (!target || tab.disabled) {
				return;
			}
			activeTarget = /** @type {EditorTarget} */ (target);
			resetCatalogUi();
			applyTargetUi();
		});
	});

	applyBtn.addEventListener('click', () => {
		const entry = getSelectedEntry();
		if (!entry) {
			return;
		}

		/** @type {Array<{ entity: string, path: string[], newValue: string, valueKind: 'number' | 'matrix' | 'array' }>} */
		const edits = [];
		const fields = valueBody.querySelectorAll('input[data-entity], textarea[data-entity]');
		for (const el of fields) {
			const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el);
			const entity = input.dataset.entity;
			const slot = slotForEntry(entry, entity);
			if (!slot || !entity) {
				continue;
			}
			edits.push({
				entity,
				path: slot.path,
				newValue: input.value,
				valueKind: isJsonBlobKind(slot.valueKind) ? slot.valueKind : 'number',
			});
		}

		vscode.postMessage({
			type: 'apply',
			target: activeTarget,
			entryKey: entry.key,
			edits,
		});
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
		el.addEventListener('change', onEntityOrLocationChanged);
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
							message.errors.map((e) => `${e.entity}: ${e.error}`).join('; ');
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
