document.addEventListener("DOMContentLoaded", async () => {
    checkAuthentication();
    setupAppShell();

    const username = await loadUserInfo();
    const usernameField = document.getElementById("settings-username");
    if (usernameField && username) {
        usernameField.textContent = username;
    }

    document
        .getElementById("settings-logout")
        ?.addEventListener("click", logoutUser);
});
