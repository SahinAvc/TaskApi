document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("register-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document
            .getElementById("register-username")
            .value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;
        const errorElement = document.getElementById("register-error");
        const submitButton = form.querySelector(".auth-button");

        errorElement.textContent = "";

        if (!username || !email || !password) {
            errorElement.textContent = "Tüm alanları doldurmalısın.";
            return;
        }

        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = "Kaydediliyor…";

        try {
            const response = await apiRequest("/api/register/", {
                method: "POST",
                redirectOn401: false,
                body: JSON.stringify({ username, email, password })
            });

            if (response.status === 0) {
                errorElement.textContent = NETWORK_ERROR_MESSAGE;
                return;
            }

            if (response.ok) {
                window.location.replace("login.html");
                return;
            }

            errorElement.textContent = formatApiErrors(response.data);
            console.error(response.data);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    });
});
