"""
Chat History Manager using SQLite
Handles persistent storage of chat conversations and messages
"""

import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import uuid

# Configure logging
logger = logging.getLogger(__name__)


class ChatHistoryManager:
    """Manages chat history using SQLite database"""
    
    def __init__(self, db_path: str = "data/chat_history.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create conversations table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        user_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status TEXT DEFAULT 'active',
                        metadata TEXT DEFAULT '{}'
                    )
                """)
                
                # Create messages table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        sql_query TEXT,
                        execution_time REAL,
                        error_message TEXT,
                        metadata TEXT DEFAULT '{}',
                        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
                    )
                """)
                
                # Create indexes for performance
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations (user_id)")
                
                conn.commit()
                logger.info("Chat history database initialized")
                
        except Exception as e:
            logger.error(f"Failed to initialize chat history database: {str(e)}")
            raise
    
    def create_conversation(self, title: str, user_id: str = "default") -> str:
        """Create a new conversation"""
        try:
            conversation_id = str(uuid.uuid4())
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO conversations (id, title, user_id)
                    VALUES (?, ?, ?)
                """, (conversation_id, title, user_id))
                conn.commit()
            
            logger.info(f"Created conversation {conversation_id}: {title}")
            return conversation_id
            
        except Exception as e:
            logger.error(f"Failed to create conversation: {str(e)}")
            raise
    
    def add_message(
        self, 
        conversation_id: str, 
        role: str, 
        content: str,
        sql_query: Optional[str] = None,
        execution_time: Optional[float] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """Add a message to a conversation"""
        try:
            message_id = str(uuid.uuid4())
            metadata_json = json.dumps(metadata or {})
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Insert message
                cursor.execute("""
                    INSERT INTO messages 
                    (id, conversation_id, role, content, sql_query, execution_time, error_message, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (message_id, conversation_id, role, content, sql_query, execution_time, error_message, metadata_json))
                
                # Update conversation timestamp
                cursor.execute("""
                    UPDATE conversations 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (conversation_id,))
                
                conn.commit()
            
            logger.debug(f"Added message to conversation {conversation_id}")
            return message_id
            
        except Exception as e:
            logger.error(f"Failed to add message: {str(e)}")
            raise
    
    def get_conversation_messages(self, conversation_id: str, limit: int = 100) -> List[Dict]:
        """Get messages from a conversation"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, role, content, timestamp, sql_query, execution_time, error_message, metadata
                    FROM messages 
                    WHERE conversation_id = ? 
                    ORDER BY timestamp ASC 
                    LIMIT ?
                """, (conversation_id, limit))
                
                messages = []
                for row in cursor.fetchall():
                    message = {
                        'id': row[0],
                        'role': row[1],
                        'content': row[2],
                        'timestamp': row[3],
                        'sql_query': row[4],
                        'execution_time': row[5],
                        'error_message': row[6],
                        'metadata': json.loads(row[7]) if row[7] else {}
                    }
                    messages.append(message)
                
                return messages
                
        except Exception as e:
            logger.error(f"Failed to get conversation messages: {str(e)}")
            return []
    
    def get_user_conversations(self, user_id: str = "default", limit: int = 50) -> List[Dict]:
        """Get conversations for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT c.id, c.title, c.created_at, c.updated_at, c.status, 
                           COUNT(m.id) as message_count
                    FROM conversations c
                    LEFT JOIN messages m ON c.id = m.conversation_id
                    WHERE c.user_id = ? AND c.status = 'active'
                    GROUP BY c.id, c.title, c.created_at, c.updated_at, c.status
                    ORDER BY c.updated_at DESC
                    LIMIT ?
                """, (user_id, limit))
                
                conversations = []
                for row in cursor.fetchall():
                    conversation = {
                        'id': row[0],
                        'title': row[1],
                        'created_at': row[2],
                        'updated_at': row[3],
                        'status': row[4],
                        'message_count': row[5]
                    }
                    conversations.append(conversation)
                
                return conversations
                
        except Exception as e:
            logger.error(f"Failed to get user conversations: {str(e)}")
            return []
    
    def update_conversation_title(self, conversation_id: str, new_title: str):
        """Update conversation title"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE conversations 
                    SET title = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (new_title, conversation_id))
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to update conversation title: {str(e)}")
    
    def delete_conversation(self, conversation_id: str):
        """Delete a conversation (soft delete)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE conversations 
                    SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (conversation_id,))
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to delete conversation: {str(e)}")
    
    def get_conversation_stats(self) -> Dict[str, Any]:
        """Get statistics about chat history"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Total conversations
                cursor.execute("SELECT COUNT(*) FROM conversations WHERE status = 'active'")
                total_conversations = cursor.fetchone()[0]
                
                # Total messages
                cursor.execute("SELECT COUNT(*) FROM messages")
                total_messages = cursor.fetchone()[0]
                
                # Messages by role
                cursor.execute("""
                    SELECT role, COUNT(*) 
                    FROM messages 
                    GROUP BY role
                """)
                messages_by_role = dict(cursor.fetchall())
                
                # Recent activity (last 7 days)
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM conversations 
                    WHERE created_at >= datetime('now', '-7 days') 
                    AND status = 'active'
                """)
                recent_conversations = cursor.fetchone()[0]
                
                return {
                    'total_conversations': total_conversations,
                    'total_messages': total_messages,
                    'messages_by_role': messages_by_role,
                    'recent_conversations': recent_conversations
                }
                
        except Exception as e:
            logger.error(f"Failed to get conversation stats: {str(e)}")
            return {}
    
    def cleanup_old_conversations(self, days: int = 30):
        """Clean up old conversations (hard delete)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Delete old conversations
                cursor.execute("""
                    DELETE FROM conversations 
                    WHERE status = 'deleted' 
                    AND updated_at < datetime('now', '-{} days')
                """.format(days))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"Cleaned up {deleted_count} old conversations")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Failed to cleanup old conversations: {str(e)}")
            return 0


# Global instance
chat_history_manager = ChatHistoryManager()

# Export main functions
__all__ = [
    'ChatHistoryManager',
    'chat_history_manager'
]