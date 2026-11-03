
async function checkStatus() {
    try {
        const response = await fetch('/check-auth');//send a request to operate check-auth
        const data = await response.json();
        const welcomeTitle = document.getElementById('welcomeTitle');
        const loginBtn = document.getElementById('loginButton');
        const profileBtn = document.getElementById('profileBtn');

        if (data.authenticated) {
            console.log("User is authenticated!");
            welcomeTitle.innerText = `welcome ${data.user}`;
            profileName.innerText = data.user;
            profileBtn.style.display = 'flex';
            loginBtn.innerHTML='start'
            loginBtn.onclick = () => {
                window.location.href = '/generatePlaylist';
            };
        } else {
            console.log("User is NOT authenticated.");
            loginBtn.onclick = () => {
                window.location.href = '/login';
            };
        }
    } catch (error) {
        console.error("Error checking auth status:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkStatus()
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
        document.getElementById('status').innerHTML = `<p style="color: red;">connection error: ${error}.try again.</p>`;
    }
});