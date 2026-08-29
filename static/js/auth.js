/**
 * Authentication Management
 *
 * Handles logout functionality for the chat application
 */

(function() {
    'use strict';

    /**
     * Initialize logout functionality
     */
    function initLogout() {
        console.log('🔐 Initializing logout functionality...');

        const logoutBtn = document.getElementById('logout-btn');

        if (!logoutBtn) {
            console.warn('⚠️ Logout button not found. Retrying in 500ms...');
            setTimeout(initLogout, 500);
            return;
        }

        console.log('✅ Logout button found, attaching event listener');

        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();

            console.log('🚪 Logout button clicked');

            // Call logout endpoint
            fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => {
                console.log('Response status:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('Logout response:', data);

                if (data.success) {
                    console.log('✅ Logout successful, redirecting to login...');
                    // Redirect to login page
                    window.location.href = '/login';
                } else {
                    console.error('❌ Logout failed:', data.message);
                    alert('Error al cerrar sesión: ' + data.message);
                }
            })
            .catch(error => {
                console.error('❌ Error during logout:', error);
                alert('Error al cerrar sesión. Por favor, inténtalo de nuevo.');
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogout);
    } else {
        initLogout();
    }
})();
