document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) {
        return;
    }

    const existingToken = localStorage.getItem("token");
    if (existingToken) {
        window.location.replace("index.html");
        return;
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const errorElement = document.getElementById("login-error");
        const submitButton = loginForm.querySelector(".auth-button");

        errorElement.textContent = "";

        if (!username || !password) {
            errorElement.textContent = "Kullanıcı adı ve şifre zorunludur.";
            return;
        }

        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = "Giriş yapılıyor…";

        try {
            const response = await apiRequest("/api-token-auth/", {
                method: "POST",
                redirectOn401: false,
                body: JSON.stringify({ username, password })
            });

            if (response.status === 0) {
                errorElement.textContent = NETWORK_ERROR_MESSAGE;
                return;
            }

            if (response.ok && response.data?.token) {
                localStorage.setItem("token", response.data.token);
                window.location.href = "index.html";
                return;
            }

            if (response.status >= 500) {
                errorElement.textContent =
                    "Sunucu hatası oluştu. Lütfen daha sonra tekrar dene.";
                console.error(response.data);
                return;
            }

            errorElement.textContent =
                "Kullanıcı adı veya şifre hatalı.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    });
});
