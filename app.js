const STORAGE_KEY = "diario.entries.v1";

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  hoy: document.getElementById("view-hoy"),
  consulta: document.getElementById("view-consulta"),
};

const menuToggle = document.getElementById("menu-toggle");
const menuDropdown = document.getElementById("menu-dropdown");
const exportButton = document.getElementById("export-btn");
const importButton = document.getElementById("import-btn");
const importFileInput = document.getElementById("import-file");

const entryForm = document.getElementById("entry-form");
const entryType = document.getElementById("entry-type");
const entryText = document.getElementById("entry-text");
const formHint = document.getElementById("form-hint");
const saveBtn = document.getElementById("save-btn");
const todayLabel = document.getElementById("today");
const todayList = document.getElementById("today-list");

const filterStartDateInput = document.getElementById("filter-start-date");
const filterEndDateInput = document.getElementById("filter-end-date");
const filterHint = document.getElementById("filter-hint");
const filterTitle = document.getElementById("filter-title");
const filterList = document.getElementById("filter-list");
const daysList = document.getElementById("days-list");

const stressDialog = document.getElementById("stress-dialog");
const stressMessage = document.getElementById("stress-message");
const closeDialogButton = document.getElementById("close-dialog");

const todayKey = formatDateKey(new Date());

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatDateDisplay(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function addOneMonth(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getDate();
  date.setMonth(date.getMonth() + 1);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return formatDateKey(date);
}

function diffDaysInclusive(startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function getTodayEntries(entries) {
  return entries.filter((entry) => entry.dateKey === todayKey);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderEntry(entry, withDate = false) {
  const li = document.createElement("li");
  li.className = "item";

  const tagClass = entry.type === "gratitude" ? "gratitude" : "stress";
  const tagText = entry.type === "gratitude" ? "Agradecimiento" : "Me estresa";

  li.innerHTML = `
    <div class="item-head">
      <span class="tag ${tagClass}">${tagText}</span>
      <button class="delete-entry" type="button" data-delete-id="${entry.id}" aria-label="Borrar entrada">Borrar</button>
    </div>
    ${withDate ? `<p class="entry-date"><strong>${formatDateDisplay(entry.dateKey)}</strong></p>` : ""}
    <p>${escapeHtml(entry.text)}</p>
  `;

  return li;
}

function setEmptyState(listElement, message) {
  listElement.innerHTML = `<li class="empty">${message}</li>`;
}

function renderToday(entries) {
  const todayEntries = getTodayEntries(entries);
  todayList.innerHTML = "";

  if (todayEntries.length === 0) {
    setEmptyState(todayList, "Aún no hay entradas hoy.");
    return;
  }

  todayEntries.forEach((entry) => {
    todayList.appendChild(renderEntry(entry));
  });
}

function getRangeState() {
  const startKey = filterStartDateInput.value;
  const endKey = filterEndDateInput.value;
  const maxDays = 60;

  if (!startKey || !endKey) {
    return { valid: false, reason: "Selecciona fecha inicio y fecha fin." };
  }

  if (startKey > endKey) {
    return { valid: false, reason: "La fecha inicio no puede ser mayor que la fecha fin." };
  }

  const days = diffDaysInclusive(startKey, endKey);
  if (days > maxDays) {
    return {
      valid: false,
      reason: `El rango seleccionado (${days} días) supera el máximo de ${maxDays} días.`,
    };
  }

  return { valid: true, startKey, endKey, days };
}

function renderConsultation(entries) {
  const state = getRangeState();
  filterHint.textContent = "";
  filterTitle.textContent = "";
  filterList.innerHTML = "";
  daysList.innerHTML = "";

  if (!state.valid) {
    filterHint.textContent = state.reason;
    setEmptyState(filterList, "Ajusta el rango para ver resultados.");
    setEmptyState(daysList, "Sin fechas para mostrar.");
    return;
  }

  const inRangeEntries = entries
    .filter((entry) => entry.dateKey >= state.startKey && entry.dateKey <= state.endKey)
    .sort((a, b) => {
      if (a.dateKey === b.dateKey) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.dateKey.localeCompare(b.dateKey);
    });

  filterTitle.textContent = `Mostrando del ${formatDateDisplay(state.startKey)} al ${formatDateDisplay(state.endKey)} (${state.days} días).`;

  const uniqueDates = [...new Set(inRangeEntries.map((entry) => entry.dateKey))].sort((a, b) => b.localeCompare(a));

  if (!uniqueDates.length) {
    setEmptyState(daysList, "No hay entradas en este rango.");
  } else {
    uniqueDates.forEach((dateKey) => {
      const li = document.createElement("li");
      li.className = "item day-chip";
      li.innerHTML = `<strong>${formatDateDisplay(dateKey)}</strong>`;
      daysList.appendChild(li);
    });
  }

  if (!inRangeEntries.length) {
    setEmptyState(filterList, "No hay entradas en este rango.");
    return;
  }

  inRangeEntries.forEach((entry) => {
    filterList.appendChild(renderEntry(entry, true));
  });
}

function renderAll(entries) {
  renderToday(entries);
  renderConsultation(entries);
}

function updateFormState(entries) {
  const todayEntries = getTodayEntries(entries);
  const hasGratitude = todayEntries.some((entry) => entry.type === "gratitude");
  const hasStress = todayEntries.some((entry) => entry.type === "stress");

  const stressOption = entryType.querySelector('option[value="stress"]');
  stressOption.disabled = !hasGratitude || hasStress;

  if (todayEntries.length >= 2 || (hasGratitude && hasStress)) {
    entryType.disabled = true;
    entryText.disabled = true;
    saveBtn.disabled = true;
    formHint.textContent = "Ya completaste las dos entradas de hoy.";
    return;
  }

  entryType.disabled = false;
  entryText.disabled = false;
  saveBtn.disabled = false;

  if (!hasGratitude) {
    entryType.value = "gratitude";
    formHint.textContent = "Primero debes guardar tu entrada de Agradecimiento.";
  } else if (!hasStress) {
    if (entryType.value === "gratitude") {
      entryType.value = "stress";
    }
    formHint.textContent = "Si quieres, puedes añadir una entrada de 'Me estresa'.";
  }
}

function maybeShowStressReminder(entries) {
  const pending = entries
    .filter((entry) => entry.type === "stress" && !entry.notifiedAt)
    .filter((entry) => addOneMonth(entry.dateKey) <= todayKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  if (!pending.length) {
    return;
  }

  const item = pending[0];
  stressMessage.textContent = `Hace un mes escribiste: "${item.text}"`;
  stressDialog.showModal();

  const close = () => {
    stressDialog.close();
    const updated = getEntries().map((entry) =>
      entry.id === item.id ? { ...entry, notifiedAt: new Date().toISOString() } : entry,
    );
    saveEntries(updated);
    closeDialogButton.removeEventListener("click", close);
  };

  closeDialogButton.addEventListener("click", close);
}

function deleteEntry(entryId) {
  const entries = getEntries();
  const updated = entries.filter((entry) => entry.id !== entryId);
  saveEntries(updated);
  updateFormState(updated);
  renderAll(updated);
}

function setupDeleteHandlers() {
  [todayList, filterList].forEach((listElement) => {
    listElement.addEventListener("click", (event) => {
      const button = event.target.closest(".delete-entry");
      if (!button) {
        return;
      }

      deleteEntry(button.dataset.deleteId);
    });
  });
}

function normalizeImportedEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }

  const type = rawEntry.type === "stress" ? "stress" : rawEntry.type === "gratitude" ? "gratitude" : null;
  const text = typeof rawEntry.text === "string" ? rawEntry.text.trim() : "";
  const dateKey = typeof rawEntry.dateKey === "string" ? rawEntry.dateKey : "";

  if (!type || !text || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const createdAt = typeof rawEntry.createdAt === "string" ? rawEntry.createdAt : `${dateKey}T12:00:00.000Z`;
  const notifiedAt = typeof rawEntry.notifiedAt === "string" ? rawEntry.notifiedAt : null;
  const id = typeof rawEntry.id === "string" && rawEntry.id ? rawEntry.id : crypto.randomUUID();

  return { id, type, text, dateKey, createdAt, notifiedAt };
}

function exportEntries() {
  const entries = getEntries();
  const payload = JSON.stringify(entries, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `diario-entradas-${todayKey}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importEntriesFromFile(file) {
  const text = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    formHint.textContent = "El archivo JSON no es válido.";
    return;
  }

  if (!Array.isArray(parsed)) {
    formHint.textContent = "El JSON debe ser una lista de entradas.";
    return;
  }

  const importedEntries = parsed.map(normalizeImportedEntry).filter(Boolean);

  if (importedEntries.length === 0) {
    formHint.textContent = "No se encontraron entradas válidas para importar.";
    return;
  }

  const existing = getEntries();
  const map = new Map(existing.map((entry) => [entry.id, entry]));
  importedEntries.forEach((entry) => {
    map.set(entry.id, entry);
  });

  const merged = [...map.values()].sort((a, b) => {
    if (a.dateKey === b.dateKey) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.dateKey.localeCompare(b.dateKey);
  });

  saveEntries(merged);
  updateFormState(merged);
  renderAll(merged);
  formHint.textContent = `${importedEntries.length} entrada(s) importada(s).`;
}

function closeMenu() {
  menuDropdown.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const willOpen = !menuDropdown.classList.contains("open");
  menuDropdown.classList.toggle("open", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
}

function setupMenu() {
  closeMenu();
  menuToggle.addEventListener("click", toggleMenu);

  document.addEventListener("click", (event) => {
    if (event.target.closest(".menu-wrapper")) {
      return;
    }
    closeMenu();
  });

  exportButton.addEventListener("click", () => {
    exportEntries();
    closeMenu();
  });

  importButton.addEventListener("click", () => {
    importFileInput.click();
    closeMenu();
  });

  importFileInput.addEventListener("change", async () => {
    const [file] = importFileInput.files || [];
    if (!file) {
      return;
    }

    await importEntriesFromFile(file);
    importFileInput.value = "";
  });
}

function switchView(viewName) {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  Object.entries(views).forEach(([key, section]) => {
    section.classList.toggle("active", key === viewName);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchView(tab.dataset.view);
  });
});

[filterStartDateInput, filterEndDateInput].forEach((element) => {
  element.addEventListener("change", () => {
    renderConsultation(getEntries());
  });
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const entries = getEntries();
  const todayEntries = getTodayEntries(entries);
  const hasGratitude = todayEntries.some((entry) => entry.type === "gratitude");

  const selectedType = entryType.value;

  if (!hasGratitude && selectedType !== "gratitude") {
    formHint.textContent = "La primera entrada del día debe ser de Agradecimiento.";
    return;
  }

  if (todayEntries.length >= 2) {
    formHint.textContent = "Ya alcanzaste el máximo de dos entradas hoy.";
    return;
  }

  const text = entryText.value.trim();
  if (!text) {
    formHint.textContent = "Escribe un texto antes de guardar.";
    return;
  }

  const newEntry = {
    id: crypto.randomUUID(),
    type: selectedType,
    text,
    dateKey: todayKey,
    createdAt: new Date().toISOString(),
    notifiedAt: null,
  };

  const updated = [...entries, newEntry];
  saveEntries(updated);

  entryForm.reset();
  updateFormState(updated);
  renderAll(updated);
});

function initRangeDefaults() {
  const endDate = parseDateKey(todayKey);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 9);

  filterStartDateInput.value = formatDateKey(startDate);
  filterEndDateInput.value = todayKey;
}

function init() {
  todayLabel.textContent = formatDateDisplay(todayKey);

  initRangeDefaults();
  setupDeleteHandlers();
  setupMenu();

  const entries = getEntries();
  updateFormState(entries);
  renderAll(entries);
  maybeShowStressReminder(entries);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }
}

init();
