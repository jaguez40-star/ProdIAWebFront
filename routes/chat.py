"""
Chat routes - Chat specific functionality
"""

from flask import Blueprint, render_template, session, request, jsonify
from utils.chat_history import chat_history_manager

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/messages/<conversation_id>')
def get_messages(conversation_id):
    """Get messages for a specific conversation"""
    try:
        messages = chat_history_manager.get_conversation_messages(conversation_id)
        return jsonify({
            'success': True,
            'messages': messages
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chat_bp.route('/conversations')
def get_conversations():
    """Get all user conversations"""
    try:
        conversations = chat_history_manager.get_user_conversations(
            session.get('user_id', 'default'), 
            limit=20
        )
        return jsonify({
            'success': True,
            'conversations': conversations
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chat_bp.route('/stats')
def get_chat_stats():
    """Get chat statistics"""
    try:
        stats = chat_history_manager.get_conversation_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chat_bp.route('/update_title/<conversation_id>', methods=['POST'])
def update_conversation_title(conversation_id):
    """Update conversation title"""
    try:
        data = request.get_json()
        new_title = data.get('title', '').strip()
        
        if not new_title:
            return jsonify({'success': False, 'error': 'Title is required'}), 400
            
        chat_history_manager.update_conversation_title(conversation_id, new_title)
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500