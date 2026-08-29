// ECP Insights - Main JavaScript
// Handles app initialization and common utilities

class AppManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeToasts();
        this.setupMobileMenu();
        this.initializeSidebarState();
        console.log('ECP Insights Flask App Initialized');
    }

    initializeSidebarState() {
        // Panel "Historial" cerrado por DEFAULT al cargar (el usuario lo abre con el toggle).
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
        }
    }

    setupMobileMenu() {
        // Desktop sidebar toggle
        const desktopToggle = document.getElementById('sidebar-toggle');
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        // Desktop sidebar toggle
        if (desktopToggle && sidebar) {
            desktopToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                // Toggle class on body to affect main-content
                document.body.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));
            });
        }
        
        // Mobile sidebar toggle
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                
                // Update button icon
                const icon = mobileToggle.querySelector('i');
                if (sidebar.classList.contains('open')) {
                    icon.className = 'fas fa-times';
                } else {
                    icon.className = 'fas fa-bars';
                }
            });
            
            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && 
                    !sidebar.contains(e.target) && 
                    !mobileToggle.contains(e.target) && 
                    sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    const icon = mobileToggle.querySelector('i');
                    icon.className = 'fas fa-bars';
                }
            });
        }
    }

    setupEventListeners() {
        // New conversation button
        document.getElementById('new-conversation-btn')?.addEventListener('click', () => {
            this.createNewConversation();
        });

        // Delete conversation buttons
        document.querySelectorAll('.delete-conv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const convId = btn.dataset.id;
                const convTitle = btn.dataset.title;
                this.showDeleteConfirmation(convId, convTitle);
            });
        });

        // Conversation selection buttons
        document.querySelectorAll('.conversation-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const convId = btn.dataset.id;
                this.selectConversation(convId);
            });
        });
    }

    async createNewConversation() {
        try {
            const response = await fetch('/new_conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (data.success) {
                // Create new conversation without page reload
                this.selectConversation(data.conversation_id);

                // Add to sidebar if ChatManager is available
                if (window.ChatManager) {
                    window.ChatManager.addConversationToSidebar(data.conversation_id, data.title);
                }

                // Clear analytics panel when creating new conversation
                if (window.AnalyticsManager) {
                    window.AnalyticsManager.hideAnalytics();
                }

                this.showToast('Nueva conversación creada', 'success');
            } else {
                this.showToast('Error al crear conversación', 'error');
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
            this.showToast('Error de conexión', 'error');
        }
    }

    async selectConversation(conversationId) {
        try {
            console.log('Selecting conversation:', conversationId);
            
            // Update session on server
            const response = await fetch(`/select_conversation/${conversationId}`);
            const data = await response.json();
            
            if (data.success) {
                // Load conversation messages without page reload
                await this.loadConversationMessages(conversationId);
                
                // Update UI to show selected conversation
                this.updateConversationUI(conversationId);
                
                // Set current conversation in ChatManager
                if (window.ChatManager) {
                    window.ChatManager.setCurrentConversation(conversationId);
                }
                
                this.showToast('Conversación cargada', 'success');
            }
        } catch (error) {
            console.error('Error selecting conversation:', error);
            this.showToast('Error al seleccionar conversación', 'error');
        }
    }

    async loadConversationMessages(conversationId) {
        try {
            const response = await fetch(`/api/conversation/${conversationId}/messages`);
            const data = await response.json();
            
            if (data.success) {
                this.displayMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    displayMessages(messages) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Clear current messages
        chatMessages.innerHTML = '';

        if (messages.length === 0) {
            // Show chat banner again for new conversation
            const chatBanner = document.querySelector('.chat-banner');
            if (chatBanner) {
                chatBanner.style.display = 'block';
            }

            // Show welcome section again
            const welcomeSection = document.querySelector('.chat-welcome-section');
            if (welcomeSection) {
                welcomeSection.style.display = 'block';
            }

            // Hide chat input on main page
            const chatInputHide = document.querySelector('.chat-input-container');
            if (chatInputHide) chatInputHide.style.display = 'none';

            // Hide chat messages area for empty conversation
            chatMessages.style.display = 'none';
            chatMessages.classList.add('empty-chat');
            chatMessages.classList.remove('has-content');

            // Clear analytics panel for empty conversation
            if (window.AnalyticsManager) {
                window.AnalyticsManager.hideAnalytics();
            }
        } else {
            // Show chat input when loading a conversation with messages
            const chatInputShow = document.querySelector('.chat-input-container');
            if (chatInputShow) chatInputShow.style.display = '';

            // Add messages with full metadata for HTML persistence
            messages.forEach(message => {
                if (window.ChatManager) {
                    // Parse metadata if it exists (stored as JSON string in SQLite)
                    let messageData = {
                        role: message.role,
                        content: message.content,
                        timestamp: message.timestamp
                    };

                    // Add metadata if available (includes html_components, panel_data, etc.)
                    if (message.metadata) {
                        try {
                            const metadata = typeof message.metadata === 'string'
                                ? JSON.parse(message.metadata)
                                : message.metadata;

                            // Include panel_data for HTML rendering
                            if (metadata.panel_data) {
                                messageData.panel_data = metadata.panel_data;
                            }

                            // Include other metadata for context
                            messageData.metadata = metadata;

                            console.log('📦 Loaded message with metadata:', {
                                role: message.role,
                                has_panel_data: !!metadata.panel_data,
                                has_html_components: !!(metadata.panel_data?.panel_1?.html_components),
                                components_count: metadata.panel_data?.panel_1?.html_components?.length || 0
                            });
                        } catch (e) {
                            console.error('Error parsing message metadata:', e);
                        }
                    }

                    window.ChatManager.addMessageToChat(messageData);
                }
            });
        }
    }

    updateConversationUI(conversationId) {
        // Update conversation buttons
        document.querySelectorAll('.conversation-btn').forEach(btn => {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        });
        
        // Highlight selected conversation
        const selectedBtn = document.querySelector(`.conversation-btn[data-id="${conversationId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.remove('btn-outline-secondary');
            selectedBtn.classList.add('btn-secondary');
        }
        
        // Enable chat input if it was disabled
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = 'Escribe tu mensaje...';
        }
        
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('btn-secondary');
            sendBtn.classList.add('btn-primary');
        }
    }

    showDeleteConfirmation(conversationId, title) {
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        
        // Set conversation title in modal
        document.getElementById('conversation-title-to-delete').textContent = title;
        
        // Set up confirmation button
        const confirmBtn = document.getElementById('confirm-delete-btn');
        confirmBtn.onclick = () => {
            this.deleteConversation(conversationId);
            modal.hide();
        };
        
        modal.show();
    }

    async deleteConversation(conversationId) {
        try {
            const response = await fetch(`/delete_conversation/${conversationId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (data.success) {
                this.showToast('Conversación eliminada', 'success');
                // Reload page to update conversation list
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showToast('Error al eliminar conversación', 'error');
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            this.showToast('Error de conexión', 'error');
        }
    }

    initializeToasts() {
        this.toastContainer = document.querySelector('.toast-container');
        this.toast = document.getElementById('notification-toast');
        this.toastMessage = document.getElementById('toast-message');
    }

    showToast(message, type = 'info') {
        if (!this.toast) return;

        // Update message
        this.toastMessage.textContent = message;
        
        // Update icon based on type
        const header = this.toast.querySelector('.toast-header i');
        header.className = `fas me-2 ${this.getToastIcon(type)}`;
        
        // Show toast
        const toast = new bootstrap.Toast(this.toast);
        //toast.show();
    }

    getToastIcon(type) {
        const icons = {
            'success': 'fa-check-circle text-success',
            'error': 'fa-exclamation-circle text-danger',
            'warning': 'fa-exclamation-triangle text-warning',
            'info': 'fa-info-circle text-primary'
        };
        return icons[type] || icons.info;
    }

    // Utility method to format numbers
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    // Utility method to format timestamps
    static formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Plotly loader helper (used by report renderers)
window.ensurePlotlyLoaded = function ensurePlotlyLoaded() {
    if (typeof Plotly !== "undefined") {
        return Promise.resolve(true);
    }

    if (window.__plotlyLoadPromise) {
        return window.__plotlyLoadPromise;
    }

    window.__plotlyLoadPromise = new Promise((resolve) => {
        const tryLoad = (src, onDone) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => onDone(true);
            script.onerror = () => onDone(false);
            document.head.appendChild(script);
        };

        tryLoad("/static/js/vendor/plotly-2.26.0.min.js", (ok) => {
            if (ok) {
                resolve(true);
                return;
            }
            tryLoad("https://cdn.plot.ly/plotly-2.26.0.min.js", (ok2) => {
                resolve(ok2);
            });
        });
    });

    return window.__plotlyLoadPromise;
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppManager();
});
