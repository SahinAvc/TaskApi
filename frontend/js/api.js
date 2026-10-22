const API_BASE_URL = "http://127.0.0.1:8000";

const NETWORK_ERROR_MESSAGE =
    "Sunucuya ulaşılamadı. Django sunucusunun çalıştığını kontrol et.";

function getToken() {
    return localStorage.getItem("token");
}

/** Django REST Framework alan hatalarını tek satırlık Türkçe mesaja çevirir. */
function formatApiErrors(data) {
    if (!data || typeof data !== "object") {
        return "Beklenmeyen bir hata oluştu.";
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    const fieldLabels = {
        title: "Başlık",
        description: "Açıklama",
        status: "Durum",
        priority: "Öncelik",
        due_date: "Son tarih",
        username: "Kullanıcı adı",
        email: "E-posta",
        password: "Şifre",
        non_field_errors: "Hata"
    };

    const messages = [];

    for (const [field, value] of Object.entries(data)) {
        const label = fieldLabels[field] || field;
        const text = Array.isArray(value) ? value[0] : String(value);
        messages.push(field === "non_field_errors" ? text : `${label}: ${text}`);
    }

    return messages[0] || "İşlem tamamlanamadı.";
}

/** Form alanlarına API doğrulama hatalarını yazar; özet mesaj döner. */
function applyFormFieldErrors(data, fieldMap) {
    Object.values(fieldMap).forEach(({ input, errorEl }) => {
        if (input) {
            input.removeAttribute("aria-invalid");
            input.classList.remove("input-invalid");
        }
        if (errorEl) {
            errorEl.textContent = "";
        }
    });

    if (!data || typeof data !== "object") {
        return formatApiErrors(data);
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    const summaries = [];

    for (const [field, value] of Object.entries(data)) {
        const mapping = fieldMap[field];
        const message = Array.isArray(value) ? value[0] : String(value);

        if (mapping?.errorEl) {
            mapping.errorEl.textContent = message;
        }
        if (mapping?.input) {
            mapping.input.setAttribute("aria-invalid", "true");
            mapping.input.classList.add("input-invalid");
        }

        summaries.push(
            field === "non_field_errors"
                ? message
                : `${field}: ${message}`
        );
    }

    return summaries[0] || formatApiErrors(data);
}

async function apiRequest(endpoint, options = {}) {
    const { redirectOn401 = true, ...fetchOptions } = options;
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...fetchOptions.headers
    };

    if (token) {
        headers.Authorization = `Token ${token}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...fetchOptions,
            headers
        });
    } catch (error) {
        console.error("API bağlantı hatası:", error);

        return {
            status: 0,
            ok: false,
            data: { detail: NETWORK_ERROR_MESSAGE }
        };
    }

    if (response.status === 401 && redirectOn401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";

        return {
            status: 401,
            ok: false,
            data: null
        };
    }

    if (response.status === 204) {
        return {
            status: 204,
            ok: true,
            data: null
        };
    }

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            data = { detail: "Sunucudan geçersiz bir yanıt alındı." };
        }
    } else {
        const text = await response.text();
        data = {
            detail: text || "Sunucudan beklenmeyen bir yanıt alındı."
        };
    }

    return {
        status: response.status,
        ok: response.ok,
        data
    };
}