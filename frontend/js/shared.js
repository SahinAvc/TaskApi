const STATUS_LABELS = {
    todo: "Yapılacak",
    doing: "Devam Ediyor",
    done: "Tamamlandı"
};

const PRIORITY_LABELS = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek"
};

function checkAuthentication() {
    if (!getToken()) {
        window.location.href = "login.html";
    }
}

function setupAppShell() {
    const page = document.body.dataset.page;
    if (page) {
        document
            .querySelectorAll(`.nav-link[data-nav="${page}"]`)
            .forEach((link) => link.classList.add("active"));
    }

    document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
    document
        .getElementById("mobile-logout-btn")
        ?.addEventListener("click", logoutUser);
}

function logoutUser(event) {
    event.preventDefault();
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

async function loadUserInfo(targetId = "welcome-message") {
    const el = document.getElementById(targetId);
    if (!el) {
        return null;
    }

    const response = await apiRequest("/api/user/");
    if (response?.status === 200 && response.data?.username) {
        el.textContent = `Hoş geldin, ${response.data.username} 👋`;
        return response.data.username;
    }

    return null;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString + "T12:00:00");
    return date.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function isOverdue(task) {
    if (!task?.due_date || task.status === "done") {
        return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date + "T12:00:00");
    return due < today;
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast--hide");
        toast.addEventListener("transitionend", () => toast.remove(), {
            once: true
        });
    }, 3200);
}

async function fetchTasksFromApi() {
    const response = await apiRequest("/api/tasks/");

    if (!response || response.status === 401) {
        return { ok: false, tasks: [], response };
    }

    if (response.status !== 200 || !Array.isArray(response.data)) {
        return {
            ok: false,
            tasks: [],
            response,
            error: formatApiErrors(response.data)
        };
    }

    return { ok: true, tasks: response.data, response };
}

function computeTaskStats(tasks) {
    const stats = {
        total: tasks.length,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0
    };

    tasks.forEach((task) => {
        if (task.status === "todo") {
            stats.todo += 1;
        } else if (task.status === "doing") {
            stats.doing += 1;
        } else if (task.status === "done") {
            stats.done += 1;
        }

        if (isOverdue(task)) {
            stats.overdue += 1;
        }
    });

    return stats;
}

function renderPageStatus(containerId, html, type = "info") {
    const el = document.getElementById(containerId);
    if (!el) {
        return;
    }
    el.className = `page-status page-status--${type}`;
    el.innerHTML = html;
}

function clearPageStatus(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
        el.className = "page-status";
        el.innerHTML = "";
    }
}

function setupRetryButton(buttonId, handler) {
    document.getElementById(buttonId)?.addEventListener("click", handler);
}
