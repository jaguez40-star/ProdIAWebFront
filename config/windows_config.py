"""
Windows-specific configuration for ECP Insights
"""

import os
import platform


def is_windows():
    """Check if running on Windows"""
    return platform.system().lower() == "windows"


def get_windows_socketio_config():
    """Get Windows-optimized SocketIO configuration"""
    import os

    # Check if running in production
    is_production = os.environ.get('FLASK_ENV') == 'production'

    base_config = {
        "cors_allowed_origins": "*",
        "async_mode": "threading",  # Better for Windows
        "ping_timeout": 120 if is_production else 60,
        "ping_interval": 60 if is_production else 25,
        "logger": not is_production,  # Disable logging in production
        "engineio_logger": not is_production,  # Enable in dev for handshake diagnostics
        "transports": ["polling", "websocket"],  # Polling first for production
        "allow_upgrades": True,
    }

    # Production-specific settings
    if is_production:
        base_config.update({
            "max_http_buffer_size": 1000000,  # 1MB buffer
            "compression": True,
            "cors_credentials": False,
        })

    return base_config


def get_windows_flask_config():
    """Get Windows-optimized Flask configuration"""
    return {
        "threaded": True,
        "use_reloader": False,  # Prevent issues with file watching on Windows
        "host": "127.0.0.1",  # Use localhost instead of 0.0.0.0 for Windows
        "port": 5029,
        "debug": os.environ.get("FLASK_DEBUG", "True").lower() == "true",
    }


def get_windows_static_config():
    """Get Windows-optimized static file configuration"""
    return {
        "send_file_max_age_default": 0,  # Disable caching during development
        "static_folder": "static",
        "static_url_path": "/static",
    }


# Windows-specific font stack
WINDOWS_FONT_STACK = ["Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"]

# Windows-specific CSS media queries
WINDOWS_CSS_FIXES = """
/* Windows-specific CSS fixes */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
    .chat-messages {
        scrollbar-face-color: #d4d4d4;
        scrollbar-shadow-color: #808080;
        scrollbar-highlight-color: #ffffff;
        scrollbar-3dlight-color: #d4d4d4;
        scrollbar-darkshadow-color: #808080;
        scrollbar-track-color: #f0f0f0;
        scrollbar-arrow-color: #000000;
    }
}

/* Fix for Windows Chrome/Edge rendering issues */
.message-content {
    will-change: transform;
    backface-visibility: hidden;
}

/* Windows-specific scrollbar styling */
::-webkit-scrollbar {
    width: 12px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 6px;
}

::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 6px;
    border: 2px solid #f1f1f1;
}

::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}
"""
