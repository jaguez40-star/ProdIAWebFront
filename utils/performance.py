"""
Performance optimization utilities and caching system
Implements caching, query optimization, and monitoring
"""

import logging
import time
import hashlib
import pickle
import pandas as pd
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Callable
from functools import wraps
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

class CacheConfig:
    """Cache configuration settings"""
    
    # Cache settings
    CACHE_DIR = Path("data/cache")
    QUERY_CACHE_TTL_MINUTES = 30
    SCHEMA_CACHE_TTL_MINUTES = 60
    LLM_CACHE_TTL_MINUTES = 60
    
    # Memory cache settings
    MAX_MEMORY_CACHE_SIZE = 100  # Max number of cached items in memory
    MAX_CACHE_FILE_SIZE_MB = 50  # Max size of individual cache files
    
    # Performance settings
    ENABLE_QUERY_CACHE = True
    ENABLE_SCHEMA_CACHE = True
    ENABLE_LLM_CACHE = True
    ENABLE_RESULT_COMPRESSION = True

class PerformanceCache:
    """Multi-level caching system for queries, schemas, and LLM responses"""
    
    def __init__(self):
        self.config = CacheConfig()
        self.memory_cache = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'total_requests': 0
        }
        
        # Ensure cache directory exists
        self.config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    def _generate_cache_key(self, data: Any, prefix: str = "") -> str:
        """Generate cache key from data"""
        if isinstance(data, str):
            content = data
        elif isinstance(data, dict):
            content = str(sorted(data.items()))
        else:
            content = str(data)
        
        hash_obj = hashlib.sha256(content.encode())
        return f"{prefix}_{hash_obj.hexdigest()[:16]}"
    
    def _get_cache_file_path(self, cache_key: str) -> Path:
        """Get cache file path for given key"""
        return self.config.CACHE_DIR / f"{cache_key}.cache"
    
    def _is_cache_valid(self, cache_file: Path, ttl_minutes: int) -> bool:
        """Check if cache file is valid (not expired)"""
        if not cache_file.exists():
            return False
        
        file_time = datetime.fromtimestamp(cache_file.stat().st_mtime)
        expiry_time = datetime.now() - timedelta(minutes=ttl_minutes)
        
        return file_time > expiry_time
    
    def get(self, key: str, ttl_minutes: int = 30) -> Optional[Any]:
        """Get item from cache"""
        self.cache_stats['total_requests'] += 1
        
        # Try memory cache first
        if key in self.memory_cache:
            item_data, timestamp = self.memory_cache[key]
            if datetime.now() - timestamp < timedelta(minutes=ttl_minutes):
                self.cache_stats['hits'] += 1
                logger.debug(f"Memory cache hit for key: {key}")
                return item_data
            else:
                # Expired, remove from memory cache
                del self.memory_cache[key]
        
        # Try file cache
        cache_file = self._get_cache_file_path(key)
        if self._is_cache_valid(cache_file, ttl_minutes):
            try:
                with open(cache_file, 'rb') as f:
                    data = pickle.load(f)
                
                # Store in memory cache for faster future access
                self.memory_cache[key] = (data, datetime.now())
                
                self.cache_stats['hits'] += 1
                logger.debug(f"File cache hit for key: {key}")
                return data
                
            except Exception as e:
                logger.warning(f"Error reading cache file {cache_file}: {str(e)}")
                # Remove corrupted cache file
                try:
                    cache_file.unlink()
                except:
                    pass
        
        self.cache_stats['misses'] += 1
        return None
    
    def set(self, key: str, data: Any, compress: bool = False) -> bool:
        """Set item in cache"""
        try:
            # Store in memory cache
            self.memory_cache[key] = (data, datetime.now())
            
            # Limit memory cache size
            if len(self.memory_cache) > self.config.MAX_MEMORY_CACHE_SIZE:
                # Remove oldest items
                sorted_items = sorted(
                    self.memory_cache.items(),
                    key=lambda x: x[1][1]  # Sort by timestamp
                )
                
                # Keep only the most recent items
                keep_items = sorted_items[-self.config.MAX_MEMORY_CACHE_SIZE:]
                self.memory_cache = dict(keep_items)
            
            # Store in file cache
            cache_file = self._get_cache_file_path(key)
            
            with open(cache_file, 'wb') as f:
                if compress and self.config.ENABLE_RESULT_COMPRESSION:
                    # For large DataFrames, consider compression
                    import gzip
                    compressed_data = gzip.compress(pickle.dumps(data))
                    pickle.dump(compressed_data, f)
                else:
                    pickle.dump(data, f)
            
            # Check file size
            file_size_mb = cache_file.stat().st_size / (1024 * 1024)
            if file_size_mb > self.config.MAX_CACHE_FILE_SIZE_MB:
                logger.warning(f"Cache file {cache_file} is large: {file_size_mb:.2f} MB")
            
            logger.debug(f"Cached data for key: {key}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching data for key {key}: {str(e)}")
            return False
    
    def invalidate(self, key: str):
        """Invalidate cache entry"""
        # Remove from memory cache
        if key in self.memory_cache:
            del self.memory_cache[key]
        
        # Remove cache file
        cache_file = self._get_cache_file_path(key)
        if cache_file.exists():
            try:
                cache_file.unlink()
                logger.debug(f"Invalidated cache for key: {key}")
            except Exception as e:
                logger.warning(f"Error invalidating cache file {cache_file}: {str(e)}")
    
    def clear_all(self):
        """Clear all cache"""
        # Clear memory cache
        self.memory_cache.clear()
        
        # Clear file cache
        try:
            for cache_file in self.config.CACHE_DIR.glob("*.cache"):
                cache_file.unlink()
            logger.info("All cache cleared")
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        hit_rate = (self.cache_stats['hits'] / max(1, self.cache_stats['total_requests'])) * 100
        
        # Get cache directory size
        cache_size_mb = 0
        cache_file_count = 0
        
        try:
            for cache_file in self.config.CACHE_DIR.glob("*.cache"):
                cache_size_mb += cache_file.stat().st_size / (1024 * 1024)
                cache_file_count += 1
        except:
            pass
        
        return {
            'hits': self.cache_stats['hits'],
            'misses': self.cache_stats['misses'],
            'total_requests': self.cache_stats['total_requests'],
            'hit_rate_percent': round(hit_rate, 2),
            'memory_cache_size': len(self.memory_cache),
            'file_cache_size_mb': round(cache_size_mb, 2),
            'file_cache_count': cache_file_count
        }

class QueryOptimizer:
    """Optimizes SQL queries for better performance"""
    
    @staticmethod
    def optimize_query(query: str, table_stats: Optional[Dict] = None) -> Tuple[str, List[str]]:
        """
        Optimize SQL query for better performance
        
        Args:
            query: Original SQL query
            table_stats: Optional table statistics for optimization hints
            
        Returns:
            Tuple of (optimized_query, optimization_notes)
        """
        optimizations = []
        optimized_query = query.strip()
        
        # Add TOP clause if missing
        if not re.search(r'\bTOP\s+\d+|\bLIMIT\s+\d+', optimized_query, re.IGNORECASE):
            if optimized_query.upper().startswith('SELECT'):
                select_pos = optimized_query.upper().find('SELECT')
                select_end = select_pos + 6
                
                optimized_query = (
                    optimized_query[:select_end] + 
                    f" TOP {CacheConfig.MAX_CACHE_FILE_SIZE_MB * 200}" +  # Reasonable default
                    optimized_query[select_end:]
                )
                optimizations.append("Added TOP clause for performance")
        
        # Suggest indexes based on WHERE clauses
        where_columns = QueryOptimizer._extract_where_columns(optimized_query)
        if where_columns:
            optimizations.append(f"Consider indexes on columns: {', '.join(where_columns)}")
        
        # Check for SELECT *
        if 'SELECT *' in optimized_query.upper():
            optimizations.append("Consider selecting specific columns instead of SELECT *")
        
        # Check for missing WHERE clause
        if not re.search(r'\bWHERE\b', optimized_query, re.IGNORECASE):
            if not re.search(r'\bJOIN\b', optimized_query, re.IGNORECASE):
                optimizations.append("Consider adding WHERE clause to filter results")
        
        return optimized_query, optimizations
    
    @staticmethod
    def _extract_where_columns(query: str) -> List[str]:
        """Extract column names from WHERE clauses"""
        import re
        
        # Simple regex to find columns in WHERE clauses
        where_pattern = r'\bWHERE\s+.*?(?=\bGROUP\s+BY|\bORDER\s+BY|\bHAVING|\s*$)'
        where_match = re.search(where_pattern, query, re.IGNORECASE | re.DOTALL)
        
        if not where_match:
            return []
        
        where_clause = where_match.group(0)
        
        # Extract potential column names (simplified)
        column_pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[=<>!]'
        columns = re.findall(column_pattern, where_clause)
        
        # Filter out common SQL keywords
        keywords = {'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL'}
        columns = [col for col in columns if col.upper() not in keywords]
        
        return list(set(columns))  # Remove duplicates

class PerformanceMonitor:
    """Monitors and tracks performance metrics"""
    
    def __init__(self):
        self.query_times = []
        self.llm_times = []
        self.total_queries = 0
        self.error_count = 0
    
    def record_query_time(self, execution_time: float, rows_returned: int):
        """Record query execution time"""
        self.query_times.append({
            'execution_time': execution_time,
            'rows_returned': rows_returned,
            'timestamp': datetime.now()
        })
        self.total_queries += 1
        
        # Keep only recent entries (last 100)
        if len(self.query_times) > 100:
            self.query_times = self.query_times[-100:]
    
    def record_llm_time(self, processing_time: float, tokens_used: Optional[int] = None):
        """Record LLM processing time"""
        self.llm_times.append({
            'processing_time': processing_time,
            'tokens_used': tokens_used,
            'timestamp': datetime.now()
        })
        
        # Keep only recent entries
        if len(self.llm_times) > 100:
            self.llm_times = self.llm_times[-100:]
    
    def record_error(self):
        """Record an error occurrence"""
        self.error_count += 1
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        stats = {
            'total_queries': self.total_queries,
            'error_count': self.error_count,
            'error_rate_percent': (self.error_count / max(1, self.total_queries)) * 100
        }
        
        # Query statistics
        if self.query_times:
            query_times = [q['execution_time'] for q in self.query_times]
            stats.update({
                'avg_query_time': sum(query_times) / len(query_times),
                'max_query_time': max(query_times),
                'min_query_time': min(query_times),
                'total_rows_returned': sum(q['rows_returned'] for q in self.query_times)
            })
        
        # LLM statistics
        if self.llm_times:
            llm_times = [l['processing_time'] for l in self.llm_times]
            stats.update({
                'avg_llm_time': sum(llm_times) / len(llm_times),
                'max_llm_time': max(llm_times),
                'min_llm_time': min(llm_times),
                'llm_requests': len(self.llm_times)
            })
        
        return stats

# Decorators for caching and performance monitoring
def cache_result(cache_key_func: Optional[Callable] = None, ttl_minutes: int = 30):
    """Decorator to cache function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if cache_key_func:
                cache_key = cache_key_func(*args, **kwargs)
            else:
                cache_key = performance_cache._generate_cache_key(
                    f"{func.__name__}_{args}_{kwargs}",
                    prefix=func.__name__
                )
            
            # Try to get from cache
            cached_result = performance_cache.get(cache_key, ttl_minutes)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            performance_cache.set(cache_key, result)
            
            return result
        
        return wrapper
    return decorator

def monitor_performance(func):
    """Decorator to monitor function performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            
            # Record successful execution
            execution_time = time.time() - start_time
            
            # Try to extract rows returned if it's a database query
            if isinstance(result, dict) and 'rows_affected' in result:
                performance_monitor.record_query_time(execution_time, result['rows_affected'])
            
            return result
            
        except Exception as e:
            performance_monitor.record_error()
            raise
    
    return wrapper

# Global instances
performance_cache = PerformanceCache()
query_optimizer = QueryOptimizer()
performance_monitor = PerformanceMonitor()

def render_performance_dashboard():
    """Render performance dashboard - Flask version placeholder"""
    # This function was designed for Streamlit, needs Flask implementation
    return {"message": "Performance dashboard not available in Flask version yet"}
    
    # Cache statistics
    cache_stats = performance_cache.get_stats()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Cache Hit Rate", f"{cache_stats['hit_rate_percent']}%")
    
    with col2:
        st.metric("Cache Hits", cache_stats['hits'])
    
    with col3:
        st.metric("Memory Cache", cache_stats['memory_cache_size'])
    
    with col4:
        st.metric("File Cache (MB)", cache_stats['file_cache_size_mb'])
    
    # Performance statistics
    perf_stats = performance_monitor.get_performance_stats()
    
    st.markdown("#### 📊 Estadísticas de Rendimiento")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Consultas", perf_stats.get('total_queries', 0))
        if 'avg_query_time' in perf_stats:
            st.metric("Tiempo Promedio (s)", f"{perf_stats['avg_query_time']:.2f}")
    
    with col2:
        st.metric("Errores", perf_stats.get('error_count', 0))
        st.metric("Tasa de Error (%)", f"{perf_stats.get('error_rate_percent', 0):.1f}")
    
    with col3:
        if 'total_rows_returned' in perf_stats:
            st.metric("Filas Totales", f"{perf_stats['total_rows_returned']:,}")
        if 'llm_requests' in perf_stats:
            st.metric("Solicitudes LLM", perf_stats['llm_requests'])
    
    # Cache management
    st.markdown("#### 🗂️ Gestión de Cache")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("🧹 Limpiar Cache", type="secondary"):
            performance_cache.clear_all()
            st.success("Cache limpiado")
            st.rerun()
    
    with col2:
        if st.button("📈 Actualizar Estadísticas", type="secondary"):
            st.rerun()
    
    with col3:
        st.download_button(
            label="📥 Exportar Estadísticas",
            data=str(perf_stats),
            file_name=f"performance_stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            mime="text/plain"
        )

def cached_query_execution(query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
    """Cached wrapper for query execution"""
    from utils.database import execute_sql_query
    return execute_sql_query(query, params)

def cached_schema_info() -> Dict[str, Any]:
    """Cached wrapper for schema information"""
    from utils.database import get_database_info
    return get_database_info()

# Export main functions
__all__ = [
    'CacheConfig',
    'PerformanceCache',
    'QueryOptimizer',
    'PerformanceMonitor',
    'performance_cache',
    'query_optimizer',
    'performance_monitor',
    'cache_result',
    'monitor_performance',
    'render_performance_dashboard',
    'cached_query_execution',
    'cached_schema_info'
]