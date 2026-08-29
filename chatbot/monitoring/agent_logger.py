"""
Agent Logger - Comprehensive logging for agent routing and query execution
"""

import logging
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import threading
from dataclasses import dataclass, asdict

# Configure logging directory
LOG_DIR = Path("data/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)

@dataclass
class QueryLogEntry:
    """Single query log entry"""
    timestamp: str
    session_id: str
    user_query: str
    question_type: str
    routed_agent: str
    routing_confidence: float
    routing_method: str
    sql_generated: Optional[str]
    execution_success: bool
    execution_time_ms: float
    result_count: int
    error_message: Optional[str]
    context_info: Dict[str, Any]
    
    @classmethod
    def create(cls, **kwargs):
        """Create log entry with current timestamp"""
        kwargs.setdefault('timestamp', datetime.now().isoformat())
        return cls(**kwargs)

@dataclass 
class RoutingLogEntry:
    """Routing decision log entry"""
    timestamp: str
    session_id: str
    user_query: str
    keyword_agent: str
    keyword_confidence: float
    context_boost: float
    llm_agent: Optional[str]
    llm_confidence: float
    final_agent: str
    final_confidence: float
    routing_time_ms: float
    keywords_matched: List[str]
    context_provided: bool
    
    @classmethod
    def create(cls, **kwargs):
        """Create routing log entry with current timestamp"""
        kwargs.setdefault('timestamp', datetime.now().isoformat())
        return cls(**kwargs)

class AgentLogger:
    """Centralized logger for agent routing and query execution"""
    
    def __init__(self, log_level: str = "INFO"):
        """Initialize agent logger"""
        self.log_level = getattr(logging, log_level.upper())
        self._setup_loggers()
        self._session_cache = {}
        self._lock = threading.Lock()
        
        # Performance metrics
        self._routing_stats = {
            'total_queries': 0,
            'successful_routings': 0,
            'failed_routings': 0,
            'avg_routing_time': 0.0,
            'agent_usage': {}
        }
        
    def _setup_loggers(self):
        """Setup specialized loggers for different aspects"""
        
        # Main agent activity logger
        self.agent_logger = logging.getLogger('ecp.agents')
        self.agent_logger.setLevel(self.log_level)
        
        # Routing specific logger
        self.routing_logger = logging.getLogger('ecp.routing')
        self.routing_logger.setLevel(self.log_level)
        
        # Query execution logger
        self.query_logger = logging.getLogger('ecp.queries')
        self.query_logger.setLevel(self.log_level)
        
        # Error logger
        self.error_logger = logging.getLogger('ecp.errors')
        self.error_logger.setLevel(logging.ERROR)
        
        # Setup file handlers if not already configured
        if not self.agent_logger.handlers:
            self._setup_file_handlers()
            
    def _setup_file_handlers(self):
        """Setup file handlers for different log types"""
        
        # Daily rotating file handler for general agent logs
        agent_handler = logging.FileHandler(
            LOG_DIR / f"agent_activity_{datetime.now().strftime('%Y%m%d')}.log"
        )
        agent_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        self.agent_logger.addHandler(agent_handler)
        
        # Routing decisions log
        routing_handler = logging.FileHandler(
            LOG_DIR / f"routing_decisions_{datetime.now().strftime('%Y%m%d')}.log"
        )
        routing_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        ))
        self.routing_logger.addHandler(routing_handler)
        
        # Query execution log
        query_handler = logging.FileHandler(
            LOG_DIR / f"query_execution_{datetime.now().strftime('%Y%m%d')}.log"
        )
        query_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        ))
        self.query_logger.addHandler(query_handler)
        
        # Error log
        error_handler = logging.FileHandler(
            LOG_DIR / f"errors_{datetime.now().strftime('%Y%m%d')}.log"
        )
        error_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(exc_info)s'
        ))
        self.error_logger.addHandler(error_handler)
        
    def log_routing_decision(self, 
                           session_id: str,
                           user_query: str, 
                           routing_data: Dict[str, Any],
                           routing_time_ms: float):
        """Log routing decision with detailed information"""
        
        try:
            with self._lock:
                # Create routing log entry
                entry = RoutingLogEntry.create(
                    session_id=session_id,
                    user_query=user_query[:200],  # Truncate long queries
                    keyword_agent=routing_data.get('keyword_agent', 'unknown'),
                    keyword_confidence=routing_data.get('keyword_confidence', 0.0),
                    context_boost=routing_data.get('context_boost', 0.0),
                    llm_agent=routing_data.get('llm_agent'),
                    llm_confidence=routing_data.get('llm_confidence', 0.0),
                    final_agent=routing_data.get('final_agent', 'unknown'),
                    final_confidence=routing_data.get('final_confidence', 0.0),
                    routing_time_ms=routing_time_ms,
                    keywords_matched=routing_data.get('keywords_matched', []),
                    context_provided=routing_data.get('context_provided', False)
                )
                
                # Log to file
                self.routing_logger.info(f"ROUTING_DECISION: {json.dumps(asdict(entry))}")
                
                # Update stats
                self._update_routing_stats(entry)
                
                # Console log for important routing decisions
                if entry.final_confidence < 0.5:
                    self.agent_logger.warning(
                        f"Low confidence routing: '{user_query[:50]}...' -> {entry.final_agent} "
                        f"(confidence: {entry.final_confidence:.2f})"
                    )
                else:
                    self.agent_logger.info(
                        f"Query routed: '{user_query[:50]}...' -> {entry.final_agent} "
                        f"(confidence: {entry.final_confidence:.2f}, time: {routing_time_ms:.1f}ms)"
                    )
                    
        except Exception as e:
            self.error_logger.error(f"Error logging routing decision: {str(e)}", exc_info=True)
    
    def log_query_execution(self,
                          session_id: str,
                          user_query: str,
                          agent_name: str,
                          sql_query: Optional[str],
                          execution_result: Dict[str, Any],
                          execution_time_ms: float,
                          context: Optional[Dict] = None):
        """Log query execution details"""
        
        try:
            with self._lock:
                # Create query log entry
                entry = QueryLogEntry.create(
                    session_id=session_id,
                    user_query=user_query[:200],  # Truncate long queries
                    question_type=context.get('question_type', 'unknown') if context else 'unknown',
                    routed_agent=agent_name,
                    routing_confidence=context.get('routing_confidence', 0.0) if context else 0.0,
                    routing_method=context.get('routing_method', 'unknown') if context else 'unknown',
                    sql_generated=sql_query[:500] if sql_query else None,  # Truncate long SQL
                    execution_success=execution_result.get('success', False),
                    execution_time_ms=execution_time_ms,
                    result_count=self._safe_get_data_count(execution_result.get('data')),
                    error_message=execution_result.get('error'),
                    context_info=context or {}
                )
                
                # Log to file
                self.query_logger.info(f"QUERY_EXECUTION: {json.dumps(asdict(entry))}")
                
                # Console log based on success/failure
                if entry.execution_success:
                    self.agent_logger.info(
                        f"Query executed successfully: {entry.result_count} rows, "
                        f"{execution_time_ms:.1f}ms ({agent_name})"
                    )
                else:
                    self.agent_logger.error(
                        f"Query execution failed: {entry.error_message} ({agent_name})"
                    )
                    # Also log to error log
                    self.error_logger.error(
                        f"Query execution error in {agent_name}: {entry.error_message}\n"
                        f"Query: {user_query[:100]}...\n"
                        f"SQL: {sql_query[:200] if sql_query else 'None'}..."
                    )
                    
        except Exception as e:
            self.error_logger.error(f"Error logging query execution: {str(e)}", exc_info=True)
    
    def log_agent_error(self, agent_name: str, error_type: str, error_message: str, 
                       context: Optional[Dict] = None):
        """Log agent-specific errors"""
        
        try:
            error_data = {
                'timestamp': datetime.now().isoformat(),
                'agent': agent_name,
                'error_type': error_type,
                'error_message': error_message,
                'context': context or {}
            }
            
            self.error_logger.error(f"AGENT_ERROR: {json.dumps(error_data)}")
            self.agent_logger.error(f"Agent {agent_name} error ({error_type}): {error_message}")
            
        except Exception as e:
            # Fallback logging
            logging.error(f"Critical logging error: {str(e)}")
    
    def log_performance_metric(self, metric_name: str, value: float, 
                             agent_name: Optional[str] = None, 
                             context: Optional[Dict] = None):
        """Log performance metrics"""
        
        try:
            metric_data = {
                'timestamp': datetime.now().isoformat(),
                'metric_name': metric_name,
                'value': value,
                'agent': agent_name,
                'context': context or {}
            }
            
            self.agent_logger.info(f"PERFORMANCE_METRIC: {json.dumps(metric_data)}")
            
        except Exception as e:
            self.error_logger.error(f"Error logging performance metric: {str(e)}", exc_info=True)
    
    def _update_routing_stats(self, entry: RoutingLogEntry):
        """Update routing statistics"""
        
        self._routing_stats['total_queries'] += 1
        
        if entry.final_confidence > 0.5:
            self._routing_stats['successful_routings'] += 1
        else:
            self._routing_stats['failed_routings'] += 1
            
        # Update average routing time
        current_avg = self._routing_stats['avg_routing_time']
        total_queries = self._routing_stats['total_queries']
        self._routing_stats['avg_routing_time'] = (
            (current_avg * (total_queries - 1) + entry.routing_time_ms) / total_queries
        )
        
        # Update agent usage
        agent = entry.final_agent
        if agent not in self._routing_stats['agent_usage']:
            self._routing_stats['agent_usage'][agent] = 0
        self._routing_stats['agent_usage'][agent] += 1
    
    def get_routing_stats(self) -> Dict[str, Any]:
        """Get current routing statistics"""
        with self._lock:
            return self._routing_stats.copy()
    
    def get_recent_logs(self, log_type: str = 'routing', limit: int = 100) -> List[Dict]:
        """Get recent log entries"""
        
        try:
            log_file_map = {
                'routing': LOG_DIR / f"routing_decisions_{datetime.now().strftime('%Y%m%d')}.log",
                'queries': LOG_DIR / f"query_execution_{datetime.now().strftime('%Y%m%d')}.log",
                'errors': LOG_DIR / f"errors_{datetime.now().strftime('%Y%m%d')}.log"
            }
            
            log_file = log_file_map.get(log_type)
            if not log_file or not log_file.exists():
                return []
                
            entries = []
            with open(log_file, 'r') as f:
                lines = f.readlines()
                for line in lines[-limit:]:
                    try:
                        # Extract JSON part from log line
                        json_start = line.find('{')
                        if json_start > 0:
                            json_part = line[json_start:].strip()
                            entry = json.loads(json_part)
                            entries.append(entry)
                    except json.JSONDecodeError:
                        continue
                        
            return entries
            
        except Exception as e:
            self.error_logger.error(f"Error retrieving recent logs: {str(e)}", exc_info=True)
            return []
    
    def _safe_get_data_count(self, data) -> int:
        """Safely get count of data, handling DataFrames and lists"""
        try:
            if data is None:
                return 0
            # Handle pandas DataFrame
            if hasattr(data, 'empty'):
                return 0 if data.empty else len(data)
            # Handle lists and other sequences
            if hasattr(data, '__len__'):
                return len(data)
            return 0
        except Exception:
            return 0

    def export_logs(self, start_date: str, end_date: str, log_types: List[str] = None) -> Dict[str, str]:
        """Export logs for a date range"""
        
        # TODO: Implement log export functionality
        # This would be useful for analysis and debugging
        pass

# Global logger instance
agent_logger = AgentLogger()

__all__ = ['AgentLogger', 'QueryLogEntry', 'RoutingLogEntry', 'agent_logger']