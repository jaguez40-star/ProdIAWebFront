/**
 * Login Page JavaScript
 * Handles authentication, form validation, and access request functionality
 */

// State
let loading = false;
let accessRequestLoading = false;
let deniedUserEmail = '';

// DOM Elements
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginText = document.getElementById('login-text');
const loginSpinner = document.getElementById('login-spinner');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const messageContainer = document.getElementById('message-container');
const messageAlert = document.getElementById('message-alert');
const messageText = document.getElementById('message-text');

// Access Request Modal
const accessRequestModal = new bootstrap.Modal(document.getElementById('accessRequestModal'));
const accessRequestForm = document.getElementById('access-request-form');
const requestUsernameInput = document.getElementById('request-username');
const requestEmailInput = document.getElementById('request-email');
const requestReasonInput = document.getElementById('request-reason');
const submitAccessRequestBtn = document.getElementById('submit-access-request');
const requestText = document.getElementById('request-text');
const requestSpinner = document.getElementById('request-spinner');

/**
 * Show message to user
 */
function showMessage(text, type = 'info') {
    messageText.textContent = text;
    messageAlert.className = `alert alert-${type} alert-dismissible fade show`;
    messageContainer.classList.remove('d-none');

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageContainer.classList.add('d-none');
        }, 3000);
    }
}

/**
 * Show error message
 */
function showError(text) {
    showMessage(text, 'danger');
}

/**
 * Show success message
 */
function showSuccess(text) {
    showMessage(text, 'success');
}

/**
 * Toggle password visibility
 */
togglePasswordBtn.addEventListener('click', () => {
    const icon = togglePasswordBtn.querySelector('i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
});

/**
 * Validate form inputs
 */
function validateForm() {
    let isValid = true;

    // Validate username
    if (!usernameInput.value.trim() || usernameInput.value.trim().length < 3) {
        usernameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        usernameInput.classList.remove('is-invalid');
    }

    // Validate password
    if (!passwordInput.value.trim()) {
        passwordInput.classList.add('is-invalid');
        isValid = false;
    } else {
        passwordInput.classList.remove('is-invalid');
    }

    return isValid;
}

// ============================================================
// SSO por token del launcher
// Si la URL trae ?token=..., intentar login automático contra
// /auth/token-login. Si falla, dejar visible el formulario LDAP.
// ============================================================
(async function trySsoLogin() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return;

  const hideOverlay = () => {
    const ov = document.getElementById('sso-loading-overlay');
    if (ov) ov.style.display = 'none';
  };

  // Limpiar la URL para que un F5 no reintente con el mismo token
  // (el token es de un solo uso desde el punto de vista de la UX).
  try {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (e) { /* noop */ }

  try {
    const response = await fetch('/auth/token-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success) {
      // Login OK → MainChat. Antes iba a '/', que sigue existiendo pero es el
      // layout viejo de dos paneles; MainChat abre Chat + Insights por defecto.
      window.location.href = '/mainchat';
      return;
    }
    console.warn('SSO token-login falló:', response.status, result);
    hideOverlay();
  } catch (e) {
    console.warn('SSO token-login error de red:', e);
    hideOverlay();
  }
})();

/**
 * Handle login form submission
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
        showError('Por favor complete todos los campos requeridos');
        return;
    }

    try {
        loading = true;
        loginBtn.disabled = true;
        loginText.textContent = 'Iniciando sesión...';
        loginSpinner.classList.remove('d-none');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password,
            }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.user_info) {
            showSuccess(data.message || 'Autenticación exitosa');

            // [2026-08-30] Si login-transition.js está cargado, él gobierna la
            // navegación: la anima y redirige al terminar (~1250 ms). Si no lo
            // está, se conserva el comportamiento de siempre.
            // Ver Planes/plan_LOGIN-TRANSICION-SALIDA_20260830.md §1 H-6.
            if (typeof window.__ltRedirigir !== 'function') {
                // Redirect a MainChat (antes '/', el layout viejo de dos paneles)
                setTimeout(() => {
                    window.location.href = '/mainchat';
                }, 500);
            }
        } else {
            // Check if access was denied due to whitelist
            if (data.access_denied || data.message === 'ACCESS_DENIED') {
                deniedUserEmail = data.user_email || username;
                if (!deniedUserEmail.includes('@')) {
                    deniedUserEmail = deniedUserEmail + '@ecopetrol.com.co';
                }
                showAccessRequestModal();
            } else {
                showError(data.message || 'Error de autenticación');
            }
        }
    } catch (error) {
        console.error('Error during login:', error);
        showError('Error de conexión con el servidor. Intente de nuevo más tarde.');
    } finally {
        loading = false;
        loginBtn.disabled = false;
        loginText.textContent = 'ACCESO';
        loginSpinner.classList.add('d-none');
    }
});

/**
 * Show access request modal
 */
function showAccessRequestModal() {
    // Pre-fill email
    requestEmailInput.value = deniedUserEmail;
    accessRequestModal.show();
}

/**
 * Close access request modal
 */
function closeAccessRequestModal() {
    requestUsernameInput.value = '';
    requestReasonInput.value = '';
    deniedUserEmail = '';
    accessRequestModal.hide();
}

/**
 * Handle access request submission
 */
submitAccessRequestBtn.addEventListener('click', async () => {
    if (!requestUsernameInput.value.trim() || !requestReasonInput.value.trim()) {
        showError('Por favor complete todos los campos requeridos');
        return;
    }

    try {
        accessRequestLoading = true;
        submitAccessRequestBtn.disabled = true;
        requestText.textContent = 'Enviando...';
        requestSpinner.classList.remove('d-none');

        const response = await fetch('/auth/request-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: requestUsernameInput.value.trim(),
                user_email: deniedUserEmail,
                reason: requestReasonInput.value.trim(),
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showSuccess(data.message || 'Solicitud enviada exitosamente');
            closeAccessRequestModal();
        } else {
            showError(data.message || 'Error enviando la solicitud');
        }
    } catch (error) {
        console.error('Error during access request:', error);
        showError('Error enviando la solicitud. Intente nuevamente.');
    } finally {
        accessRequestLoading = false;
        submitAccessRequestBtn.disabled = false;
        requestText.textContent = 'Enviar solicitud';
        requestSpinner.classList.add('d-none');
    }
});

/**
 * Reset form validation on input
 */
usernameInput.addEventListener('input', () => {
    usernameInput.classList.remove('is-invalid');
});

passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('is-invalid');
});

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', () => {
    // Disable scrolling on the entire page
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.documentElement.style.height = '100vh';

    // Focus on username input
    usernameInput.focus();
});

/**
 * Clean up when leaving page
 */
window.addEventListener('beforeunload', () => {
    // Re-enable scrolling
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.height = '';
    document.documentElement.style.height = '';
});
