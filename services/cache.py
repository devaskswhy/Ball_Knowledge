import time
from typing import Any, Optional, Dict

class SimpleCache:
    """Simple in-memory TTL cache with hit/miss tracking"""
    
    def __init__(self):
        self._cache: Dict[str, tuple] = {}  # key -> (value, expiry_timestamp)
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired, else None"""
        if key not in self._cache:
            self._misses += 1
            return None
        
        value, expiry = self._cache[key]
        if time.time() > expiry:
            # Expired
            del self._cache[key]
            self._misses += 1
            return None
        
        self._hits += 1
        return value
    
    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        """Set value in cache with TTL in seconds"""
        expiry = time.time() + ttl_seconds
        self._cache[key] = (value, expiry)
    
    def clear(self, key: str) -> None:
        """Remove a specific key from cache"""
        if key in self._cache:
            del self._cache[key]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics and current contents"""
        current_time = time.time()
        contents = {}
        
        for key, (value, expiry) in self._cache.items():
            remaining_seconds = max(0, expiry - current_time)
            contents[key] = {
                "expires_in_seconds": remaining_seconds,
                "expires_at": expiry
            }
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / (self._hits + self._misses) if (self._hits + self._misses) > 0 else 0.0,
            "total_keys": len(self._cache),
            "contents": contents
        }
    
    def clear_all(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()

# Global cache instance
cache = SimpleCache()
