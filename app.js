const STORAGE_KEY = "diario.entries.v1";

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  hoy: document.getElementById("view-hoy"),
  consulta: document.getElementById("view-consulta"),
};

const entryForm = document.getElementById("entry-form");
const entryType = document.getElementById("entry-type");
const entryText = document.getElementById("entry-text");
const formHint = document.getElementById("form-hint");
const saveBtn = document.getElementById("save-btn");
const todayLabel = document.getElementById("today");
const todayList = document.getElementById("today-list");

const filterDateInput = document.getElementById("filter-date");
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

function formatDateDisplay(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("es-ES", {
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
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + 1);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return formatDateKey(date);
}

function getTodayEntries(entries) {
  return entries.filter((entry) => entry.dateKey === todayKey);
}

function getEntriesByDate(entries, dateKey) {
  return entries
    .filter((entry) => entry.dateKey === dateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    <span class="tag ${tagClass}">${tagText}</span>
    ${withDate ? `<p><strong>${formatDateDisplay(entry.dateKey)}</strong></p>` : ""}
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

function renderConsultation(entries) {
  const uniqueDates = [...new Set(entries.map((entry) => entry.dateKey))].sort((a, b) => b.localeCompare(a));

  daysList.innerHTML = "";
  if (!uniqueDates.length) {
    setEmptyState(daysList, "Todavía no hay días con entradas.");
  } else {
    uniqueDates.forEach((dateKey) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `<button type="button" class="day-button" data-date="${dateKey}">${formatDateDisplay(dateKey)}</button>`;
      daysList.appendChild(li);
    });
  }

  const selectedDate = filterDateInput.value || todayKey;
  filterDateInput.value = selectedDate;
  const selectedEntries = getEntriesByDate(entries, selectedDate);

  filterTitle.textContent = `Mostrando: ${formatDateDisplay(selectedDate)}`;
  filterList.innerHTML = "";

  if (!selectedEntries.length) {
    setEmptyState(filterList, "No hay entradas en esta fecha.");
    return;
  }

  selectedEntries.forEach((entry) => {
    filterList.appendChild(renderEntry(entry));
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

daysList.addEventListener("click", (event) => {
  const button = event.target.closest(".day-button");
  if (!button) {
    return;
  }

  filterDateInput.value = button.dataset.date;
  renderConsultation(getEntries());
});

filterDateInput.addEventListener("change", () => {
  renderConsultation(getEntries());
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

function init() {
  todayLabel.textContent = formatDateDisplay(todayKey);

  const entries = getEntries();
  filterDateInput.value = todayKey;
  updateFormState(entries);
  renderAll(entries);
  maybeShowStressReminder(entries);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }
}

init();
