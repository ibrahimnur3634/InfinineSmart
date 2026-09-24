const ADMIN_USERNAME = 'infininekenya';
        const ADMIN_PASSWORD = 'infininesmart';
        const WHATSAPP_NUMBER = '254759240255';
        const SESSION_KEY = 'infinineAdminSession';
        const RECOVERY_KEY = 'infinineAdminRecovery';
        const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000;
        const TTL_MS = 10 * 60 * 1000;

        function isAdminLoggedIn() {
            const session = localStorage.getItem(SESSION_KEY);
            if (!session) return false;
            try {
                const parsed = JSON.parse(session);
                if (!parsed || parsed.username !== ADMIN_USERNAME || parsed.expiresAt <= Date.now()) {
                    localStorage.removeItem(SESSION_KEY);
                    return false;
                }
                return true;
            } catch (error) {
                localStorage.removeItem(SESSION_KEY);
                return false;
            }
        }

        function setSession() {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                username: ADMIN_USERNAME,
                expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
            }));
        }

        function showMessage(text, type) {
            const box = document.getElementById('messageBox');
            box.textContent = text;
            box.className = 'message ' + type;
        }

        function renderDashboardIfLoggedIn() {
            if (isAdminLoggedIn()) {
                window.location.href = './admin-dashboard.html';
                return;
            }
        }

        function requestReset() {
            const data = {
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                validUntil: Date.now() + TTL_MS,
                contactNumber: WHATSAPP_NUMBER,
                requestedAt: Date.now()
            };

            localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));

            const message = encodeURIComponent(
                'Hello, I forgot my admin password and need the login details. Please assist me with the current username and password. ' +
                'This request is valid for 10 minutes.'
            );

            const whatsappLink = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + message;
            window.open(whatsappLink, '_blank');
            showMessage('Please contact the admin on WhatsApp at 0759240255 to request the login details.', 'success');
        }

        function validateRecoveryWindow() {
            const saved = localStorage.getItem(RECOVERY_KEY);
            if (!saved) return false;
            try {
                const parsed = JSON.parse(saved);
                return parsed && parsed.validUntil > Date.now();
            } catch (error) {
                return false;
            }
        }

        document.getElementById('adminLoginForm').addEventListener('submit', function (event) {
            event.preventDefault();
            const username = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value.trim();

            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                setSession();
                window.location.href = './admin-dashboard.html';
                return;
            }

            showMessage('Invalid username or password. Use the admin credentials only.', 'error');
        });

        renderDashboardIfLoggedIn();