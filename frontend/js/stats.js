document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
    setupAppShell();
    loadUserInfo();
    loadStats();
});

async function loadStats() {
    renderPageStatus(
        "stats-status",
        '<p class="page-loading-text">İstatistikler yükleniyor…</p>',
        "loading"
    );

    const result = await fetchTasksFromApi();

    if (!result.ok) {
        if (result.response?.status === 401) {
            return;
        }

        renderPageStatus(
            "stats-status",
            `<p>İstatistikler yüklenemedi. ${escapeHtml(result.error || "")}</p>
            <button type="button" class="retry-btn" id="retry-stats">Yeniden dene</button>`,
            "error"
        );
        setupRetryButton("retry-stats", () => loadStats());
        return;
    }

    clearPageStatus("stats-status");

    const stats = computeTaskStats(result.tasks);
    renderStatCards(stats);
    renderPriorityBreakdown(result.tasks);
}

function renderStatCards(stats) {
    const grid = document.getElementById("stats-grid");
    if (!grid) {
        return;
    }

    const cards = [
        { label: "Toplam görev", value: stats.total, tone: "primary" },
        { label: "Yapılacak", value: stats.todo, tone: "todo" },
        { label: "Devam eden", value: stats.doing, tone: "doing" },
        { label: "Tamamlanan", value: stats.done, tone: "done" },
        { label: "Gecikmiş", value: stats.overdue, tone: "danger" }
    ];

    grid.innerHTML = cards
        .map(
            (card) => `<article class="stat-card stat-card--${card.tone}">
            <p class="stat-card-label">${card.label}</p>
            <p class="stat-card-value">${card.value}</p>
        </article>`
        )
        .join("");
}

function renderPriorityBreakdown(tasks) {
    const listEl = document.getElementById("stats-priority-list");
    if (!listEl) {
        return;
    }

    const counts = { low: 0, medium: 0, high: 0 };
    tasks.forEach((task) => {
        if (counts[task.priority] !== undefined) {
            counts[task.priority] += 1;
        }
    });

    const rows = ["high", "medium", "low"].map((priority) => {
        const count = counts[priority];
        const total = tasks.length || 1;
        const percent = Math.round((count / total) * 100);
        return `<li>
            <div class="stats-priority-row">
                <span>${PRIORITY_LABELS[priority]}</span>
                <span>${count} · %${tasks.length ? percent : 0}</span>
            </div>
            <div class="stats-bar"><span style="width:${tasks.length ? percent : 0}%"></span></div>
        </li>`;
    });

    listEl.innerHTML =
        tasks.length === 0
            ? `<p class="muted-text">Henüz istatistik oluşturacak görev yok.</p>`
            : `<ul class="stats-priority">${rows.join("")}</ul>`;
}
