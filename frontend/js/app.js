const LIST_IDS = ["todo-list", "doing-list", "done-list"];

const STATUS_TO_LIST = {
    todo: "todo-list",
    doing: "doing-list",
    done: "done-list"
};

let cachedTasks = [];
let deletingTaskIds = new Set();
let statusChangingIds = new Set();
let lastFocusedBeforeModal = null;

document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    setupAppShell();
    loadUserInfo();
    setupNewTaskButton();
    setupDragAndDrop();
    loadTasks();

    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
        openTaskById(Number(editId));
    }
});

async function openTaskById(taskId) {
    if (!taskId) {
        return;
    }

    let task = cachedTasks.find((item) => item.id === taskId);

    if (!task) {
        const response = await apiRequest(`/api/tasks/${taskId}/`);
        if (response?.ok) {
            task = response.data;
        }
    }

    if (task) {
        openEditTaskModal(task);
        window.history.replaceState({}, "", "index.html");
    }
}

function getTaskFormFieldMap() {
    return {
        title: {
            input: document.getElementById("task-title"),
            errorEl: document.getElementById("task-title-error")
        },
        description: {
            input: document.getElementById("task-description"),
            errorEl: document.getElementById("task-description-error")
        },
        status: {
            input: document.getElementById("task-status"),
            errorEl: document.getElementById("task-status-error")
        },
        priority: {
            input: document.getElementById("task-priority"),
            errorEl: document.getElementById("task-priority-error")
        },
        due_date: {
            input: document.getElementById("task-due-date"),
            errorEl: document.getElementById("task-due-date-error")
        },
        non_field_errors: {
            input: null,
            errorEl: document.getElementById("task-form-error")
        }
    };
}

function clearTaskFormErrors() {
    applyFormFieldErrors({}, getTaskFormFieldMap());
    document.getElementById("task-form-error").textContent = "";
}

function showBoardMessage(html, type = "info") {
    renderPageStatus("board-status", html, type);
}

function clearBoardMessage() {
    clearPageStatus("board-status");
}

function setBoardLoading(isLoading) {
    document.getElementById("task-board")?.classList.toggle("board--loading", isLoading);
}

function renderColumnEmptyStates() {
    LIST_IDS.forEach((listId) => {
        const list = document.getElementById(listId);
        if (!list) {
            return;
        }

        const existing = list.querySelector(".column-empty");
        const hasCards = list.querySelector(".task-card");

        if (hasCards) {
            existing?.remove();
            return;
        }

        if (!existing) {
            const empty = document.createElement("p");
            empty.className = "column-empty";
            empty.textContent =
                list.dataset.emptyLabel || "Bu sütunda görev yok.";
            list.appendChild(empty);
        }
    });
}

async function loadTasks() {
    showBoardMessage('<p class="page-loading-text">Görevler yükleniyor…</p>', "loading");
    setBoardLoading(true);

    LIST_IDS.forEach((id) => {
        const list = document.getElementById(id);
        if (list) {
            list.innerHTML = "";
        }
    });

    const result = await fetchTasksFromApi();
    setBoardLoading(false);

    if (!result.ok) {
        if (result.response?.status === 401) {
            return;
        }

        showBoardMessage(
            `<p>Görevler yüklenemedi. ${escapeHtml(result.error || "Bilinmeyen hata")}</p>
            <button type="button" class="retry-btn" id="retry-load-tasks">Yeniden dene</button>`,
            "error"
        );
        setupRetryButton("retry-load-tasks", () => loadTasks());
        updateTaskCounts();
        return;
    }

    cachedTasks = result.tasks;

    cachedTasks.forEach((task) => {
        const targetId = STATUS_TO_LIST[task.status];
        if (targetId) {
            document.getElementById(targetId)?.appendChild(createTaskCard(task));
        }
    });

    clearBoardMessage();
    renderColumnEmptyStates();
    updateTaskCounts();
}

function buildStatusActions(task) {
    const actions = [];

    if (task.status !== "todo") {
        actions.push({
            status: "todo",
            label: "Yapılacak",
            className: "status-btn--todo"
        });
    }
    if (task.status !== "doing") {
        actions.push({
            status: "doing",
            label: "Devam",
            className: "status-btn--doing"
        });
    }
    if (task.status !== "done") {
        actions.push({
            status: "done",
            label: "Tamamla",
            className: "status-btn--done"
        });
    }

    return actions
        .map(
            (action) => `<button
                type="button"
                class="status-btn ${action.className}"
                data-task-id="${task.id}"
                data-new-status="${action.status}"
                onclick="changeTaskStatus(${task.id}, '${action.status}', this)"
            >${action.label}</button>`
        )
        .join("");
}

function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.taskId = String(task.id);
    card.dataset.status = task.status;
    card.setAttribute("aria-grabbed", "false");

    card.addEventListener("click", (event) => {
        if (event.target.closest("button")) {
            return;
        }
        openEditTaskModal(task);
    });

    card.addEventListener("dragstart", onCardDragStart);
    card.addEventListener("dragend", onCardDragEnd);

    card.innerHTML = `
        <div class="task-card-top">
            <span class="priority ${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
            <div class="task-card-actions-top">
                <button type="button" class="task-edit-btn" aria-label="Görevi düzenle" onclick="openEditTaskModalById(${task.id})">Düzenle</button>
                <button type="button" class="task-menu" aria-label="Görevi sil" onclick="deleteTask(${task.id})">×</button>
            </div>
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
        <div class="task-card-bottom">
            <span class="task-date ${isOverdue(task) ? "task-date--overdue" : ""}">
                ${
                    task.due_date
                        ? formatDate(task.due_date) +
                          (isOverdue(task) ? " · Gecikmiş" : "")
                        : "Son tarih yok"
                }
            </span>
        </div>
        <div class="status-move" role="group" aria-label="Durumu değiştir">
            ${buildStatusActions(task)}
        </div>
        <p class="task-card-hint">
            Bilgisayarda sürükle veya aşağıdaki butonlarla durumu değiştir.
        </p>
    `;

    return card;
}

function openEditTaskModalById(taskId) {
    const task = cachedTasks.find((item) => item.id === taskId);
    if (task) {
        openEditTaskModal(task);
    }
}

async function deleteTask(taskId) {
    if (deletingTaskIds.has(taskId)) {
        return;
    }

    if (!confirm("Bu görevi silmek istediğine emin misin?")) {
        return;
    }

    deletingTaskIds.add(taskId);
    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    card?.classList.add("task-card--busy");

    const response = await apiRequest(`/api/tasks/${taskId}/`, {
        method: "DELETE"
    });

    deletingTaskIds.delete(taskId);
    card?.classList.remove("task-card--busy");

    if (response?.status === 204) {
        showToast("Görev silindi.");
        await loadTasks();
    } else if (response) {
        showToast(formatApiErrors(response.data), "error");
        console.error(response.data);
    }
}

async function changeTaskStatus(taskId, newStatus, buttonEl) {
    if (statusChangingIds.has(taskId)) {
        return;
    }

    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    const fromStatus = card?.dataset.status;

    if (!fromStatus || fromStatus === newStatus) {
        return;
    }

    statusChangingIds.add(taskId);
    buttonEl?.classList.add("status-btn--loading");
    card?.classList.add("task-card--busy");

    const moved = moveCardDom(taskId, fromStatus, newStatus);

    const response = await apiRequest(`/api/tasks/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
    });

    statusChangingIds.delete(taskId);
    buttonEl?.classList.remove("status-btn--loading");
    card?.classList.remove("task-card--busy");

    if (response?.ok) {
        cachedTasks = cachedTasks.map((task) =>
            task.id === taskId ? { ...task, status: newStatus } : task
        );
        const updatedCard = document.querySelector(
            `.task-card[data-task-id="${taskId}"]`
        );
        if (updatedCard) {
            updatedCard.dataset.status = newStatus;
            const task = cachedTasks.find((item) => item.id === taskId);
            if (task) {
                const group = updatedCard.querySelector(".status-move");
                if (group) {
                    group.innerHTML = buildStatusActions(task);
                }
            }
        }
        renderColumnEmptyStates();
        updateTaskCounts();
        showToast(`Görev "${STATUS_LABELS[newStatus]}" sütununa taşındı.`);
        return;
    }

    if (moved) {
        moveCardDom(taskId, newStatus, fromStatus);
    }

    showToast(formatApiErrors(response?.data), "error");
    console.error(response?.data);
}

function moveCardDom(taskId, fromStatus, toStatus) {
    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    const toListId = STATUS_TO_LIST[toStatus];
    const toList = document.getElementById(toListId);

    if (!card || !toList) {
        return false;
    }

    toList.querySelector(".column-empty")?.remove();
    toList.appendChild(card);
    card.dataset.status = toStatus;
    return true;
}

function setupDragAndDrop() {
    document.querySelectorAll(".task-list").forEach((list) => {
        list.addEventListener("dragover", (event) => {
            event.preventDefault();
            list.classList.add("task-list--drop-target");
        });

        list.addEventListener("dragleave", () => {
            list.classList.remove("task-list--drop-target");
        });

        list.addEventListener("drop", async (event) => {
            event.preventDefault();
            list.classList.remove("task-list--drop-target");

            const taskId = Number(event.dataTransfer.getData("text/task-id"));
            const fromStatus = event.dataTransfer.getData("text/from-status");
            const toStatus = list.dataset.status;

            if (!taskId || !toStatus || fromStatus === toStatus) {
                return;
            }

            const card = document.querySelector(
                `.task-card[data-task-id="${taskId}"]`
            );
            await changeTaskStatus(taskId, toStatus, null);
        });
    });
}

function onCardDragStart(event) {
    const card = event.currentTarget;
    card.classList.add("task-card--dragging");
    card.setAttribute("aria-grabbed", "true");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", card.dataset.taskId);
    event.dataTransfer.setData("text/from-status", card.dataset.status);
}

function onCardDragEnd(event) {
    const card = event.currentTarget;
    card.classList.remove("task-card--dragging");
    card.setAttribute("aria-grabbed", "false");
    document
        .querySelectorAll(".task-list--drop-target")
        .forEach((list) => list.classList.remove("task-list--drop-target"));
}

function updateTaskCounts() {
    document.getElementById("todo-count").textContent =
        document.querySelectorAll("#todo-list .task-card").length;
    document.getElementById("doing-count").textContent =
        document.querySelectorAll("#doing-list .task-card").length;
    document.getElementById("done-count").textContent =
        document.querySelectorAll("#done-list .task-card").length;
}

function setupNewTaskButton() {
    const button = document.getElementById("new-task-btn");
    const modal = document.getElementById("task-modal");
    const closeButton = document.getElementById("close-modal");
    const cancelButton = document.getElementById("cancel-task");
    const form = document.getElementById("task-form");

    if (!button || !modal || !form) {
        return;
    }

    button.addEventListener("click", () => openTaskModal());
    closeButton?.addEventListener("click", () => closeTaskModal());
    cancelButton?.addEventListener("click", () => closeTaskModal());

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeTaskModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("active")) {
            closeTaskModal();
        }
    });

    form.addEventListener("submit", createTask);
}

function openTaskModal() {
    const modal = document.getElementById("task-modal");
    const form = document.getElementById("task-form");

    delete form.dataset.editingId;
    form.reset();
    clearTaskFormErrors();

    document.getElementById("modal-title").textContent = "Yeni Görev";
    document.getElementById("task-status").value = "todo";
    document.getElementById("task-priority").value = "medium";

    lastFocusedBeforeModal = document.activeElement;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("task-title")?.focus();
}

function closeTaskModal() {
    const modal = document.getElementById("task-modal");
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    lastFocusedBeforeModal?.focus?.();
}

function openEditTaskModal(task) {
    const modal = document.getElementById("task-modal");
    const form = document.getElementById("task-form");

    document.getElementById("modal-title").textContent = "Görevi Düzenle";
    document.getElementById("task-title").value = task.title;
    document.getElementById("task-description").value = task.description || "";
    document.getElementById("task-status").value = task.status;
    document.getElementById("task-priority").value = task.priority;
    document.getElementById("task-due-date").value = task.due_date || "";
    clearTaskFormErrors();

    form.dataset.editingId = String(task.id);

    lastFocusedBeforeModal = document.activeElement;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("task-title")?.focus();
}

async function createTask(event) {
    event.preventDefault();

    const saveButton = document.querySelector(".save-task-btn");
    const form = document.getElementById("task-form");
    const errorElement = document.getElementById("task-form-error");
    const fieldMap = getTaskFormFieldMap();

    if (saveButton?.disabled) {
        return;
    }

    const title = document.getElementById("task-title").value.trim();
    const description = document
        .getElementById("task-description")
        .value.trim();
    const status = document.getElementById("task-status").value;
    const priority = document.getElementById("task-priority").value;
    const dueDate = document.getElementById("task-due-date").value;
    const editingId = form.dataset.editingId;

    clearTaskFormErrors();
    errorElement.textContent = "";

    if (!title) {
        fieldMap.title.errorEl.textContent = "Görev başlığı zorunludur.";
        fieldMap.title.input.setAttribute("aria-invalid", "true");
        fieldMap.title.input.classList.add("input-invalid");
        fieldMap.title.input.focus();
        return;
    }

    if (title.length > 200) {
        fieldMap.title.errorEl.textContent =
            "Başlık en fazla 200 karakter olabilir.";
        fieldMap.title.input.setAttribute("aria-invalid", "true");
        fieldMap.title.input.classList.add("input-invalid");
        fieldMap.title.input.focus();
        return;
    }

    const taskData = {
        title,
        description,
        status,
        priority,
        due_date: dueDate || null
    };

    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Kaydediliyor…";

    try {
        const response = editingId
            ? await apiRequest(`/api/tasks/${editingId}/`, {
                  method: "PATCH",
                  body: JSON.stringify(taskData)
              })
            : await apiRequest("/api/tasks/", {
                  method: "POST",
                  body: JSON.stringify(taskData)
              });

        if (!response || response.status === 401) {
            return;
        }

        if (response.ok) {
            delete form.dataset.editingId;
            closeTaskModal();
            await loadTasks();
            showToast(editingId ? "Görev güncellendi." : "Görev oluşturuldu.");
            return;
        }

        const summary = applyFormFieldErrors(response.data, fieldMap);
        if (!Object.keys(response.data || {}).some((key) => fieldMap[key])) {
            errorElement.textContent = summary;
        }
        console.error(response.data);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalLabel;
    }
}
