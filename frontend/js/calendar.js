const MONTH_NAMES = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık"
];

let calendarTasks = [];
let viewYear;
let viewMonth;
let selectedDayKey = null;

document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    setupAppShell();
    loadUserInfo();

    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    document
        .getElementById("calendar-prev")
        ?.addEventListener("click", () => shiftMonth(-1));
    document
        .getElementById("calendar-next")
        ?.addEventListener("click", () => shiftMonth(1));
    document
        .getElementById("calendar-today")
        ?.addEventListener("click", () => {
            const today = new Date();
            viewYear = today.getFullYear();
            viewMonth = today.getMonth();
            selectedDayKey = formatDayKey(today);
            loadCalendar();
        });

    loadCalendar();
});

function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) {
        viewMonth = 11;
        viewYear -= 1;
    } else if (viewMonth > 11) {
        viewMonth = 0;
        viewYear += 1;
    }
    selectedDayKey = null;
    loadCalendar();
}

function formatDayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function tasksByDueDate(tasks) {
    const map = new Map();
    tasks.forEach((task) => {
        if (!task.due_date) {
            return;
        }
        if (!map.has(task.due_date)) {
            map.set(task.due_date, []);
        }
        map.get(task.due_date).push(task);
    });
    return map;
}

async function loadCalendar() {
    renderPageStatus(
        "calendar-status",
        '<p class="page-loading-text">Takvim verileri yükleniyor…</p>',
        "loading"
    );

    const result = await fetchTasksFromApi();

    if (!result.ok) {
        if (result.response?.status === 401) {
            return;
        }

        renderPageStatus(
            "calendar-status",
            `<p>Takvim yüklenemedi. ${escapeHtml(result.error || "")}</p>
            <button type="button" class="retry-btn" id="retry-calendar">Yeniden dene</button>`,
            "error"
        );
        setupRetryButton("retry-calendar", () => loadCalendar());
        return;
    }

    calendarTasks = result.tasks;
    if (!selectedDayKey) {
        selectedDayKey = formatDayKey(new Date());
    }
    clearPageStatus("calendar-status");
    renderCalendarGrid();
    renderDayDetail();
}

function renderCalendarGrid() {
    const titleEl = document.getElementById("calendar-month-label");
    const gridEl = document.getElementById("calendar-grid");

    if (!titleEl || !gridEl) {
        return;
    }

    titleEl.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const dueMap = tasksByDueDate(calendarTasks);
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const todayKey = formatDayKey(new Date());

    gridEl.innerHTML = "";

    ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].forEach((label) => {
        const head = document.createElement("div");
        head.className = "calendar-weekday";
        head.textContent = label;
        gridEl.appendChild(head);
    });

    for (let i = 0; i < startWeekday; i += 1) {
        const empty = document.createElement("div");
        empty.className = "calendar-day calendar-day--empty";
        empty.setAttribute("aria-hidden", "true");
        gridEl.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(viewYear, viewMonth, day);
        const key = formatDayKey(date);
        const tasks = dueMap.get(key) || [];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "calendar-day";
        cell.dataset.dayKey = key;

        if (key === todayKey) {
            cell.classList.add("calendar-day--today");
        }
        if (key === selectedDayKey) {
            cell.classList.add("calendar-day--selected");
        }

        cell.innerHTML = `
            <span class="calendar-day-number">${day}</span>
            ${
                tasks.length
                    ? `<span class="calendar-day-badge">${tasks.length} görev</span>`
                    : `<span class="calendar-day-badge calendar-day-badge--muted">—</span>`
            }
        `;

        cell.addEventListener("click", () => {
            selectedDayKey = key;
            renderCalendarGrid();
            renderDayDetail();
        });

        gridEl.appendChild(cell);
    }
}

function renderDayDetail() {
    const detailEl = document.getElementById("calendar-day-detail");
    if (!detailEl) {
        return;
    }

    if (!selectedDayKey) {
        detailEl.innerHTML = `
            <h2>Gün detayı</h2>
            <p class="muted-text">Son tarihli görevleri görmek için takvimden bir gün seç.</p>
        `;
        return;
    }

    const tasks = calendarTasks.filter(
        (task) => task.due_date === selectedDayKey
    );

    if (!tasks.length) {
        detailEl.innerHTML = `
            <h2>${formatDate(selectedDayKey)}</h2>
            <p class="muted-text">Bu tarihte son tarihi olan görev yok.</p>
            <a class="text-link" href="index.html">Görev panosuna git</a>
        `;
        return;
    }

    const items = tasks
        .map((task) => {
            const overdue = isOverdue(task);
            return `<li class="calendar-task-item">
                <div>
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="calendar-task-meta">${STATUS_LABELS[task.status] || task.status} · ${PRIORITY_LABELS[task.priority] || task.priority}${overdue ? " · Gecikmiş" : ""}</span>
                </div>
                <a class="text-link" href="index.html?edit=${task.id}">Düzenle</a>
            </li>`;
        })
        .join("");

    detailEl.innerHTML = `
        <h2>${formatDate(selectedDayKey)}</h2>
        <p class="muted-text">${tasks.length} görev</p>
        <ul class="calendar-task-list">${items}</ul>
    `;
}
