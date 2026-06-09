import time
import threading
from typing import Any, Optional, Dict, Callable
from functools import wraps


class TTLCache:
    """Thread-safe in-memory cache with TTL expiration and hit/miss tracking."""
    
    def __init__(self):
        self._store: Dict[str, tuple] = {}  # key -> (value, expires_at)
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired, else None."""
        with self._lock:
            if key in self._store:
                value, expires_at = self._store[key]
                if time.time() < expires_at:
                    self._hits += 1
                    return value
                # Expired — evict lazily
                del self._store[key]
            self._misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        """Set value in cache with TTL in seconds."""
        with self._lock:
            self._store[key] = (value, time.time() + ttl_seconds)
    
    def invalidate(self, key: str) -> None:
        """Remove a specific key from cache."""
        with self._lock:
            self._store.pop(key, None)

    # Keep backward-compatible alias used by existing code
    clear = invalidate
    
    def clear_all(self) -> None:
        """Clear all cache entries and reset counters."""
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            now = time.time()
            active = sum(1 for _, (_, exp) in self._store.items() if exp > now)
            total_requests = self._hits + self._misses
            return {
                "total_keys": len(self._store),
                "active_keys": active,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total_requests, 3) if total_requests > 0 else 0.0,
            }

    # Backward-compatible alias — old code calls cache.get_stats()
    def get_stats(self) -> Dict[str, Any]:
        """Alias for stats() to maintain backward compatibility."""
        base = self.stats()
        # Also include per-key TTL details for the debug endpoint
        with self._lock:
            now = time.time()
            contents = {}
            for key, (_, expiry) in self._store.items():
                remaining = max(0, expiry - now)
                contents[key] = {
                    "expires_in_seconds": round(remaining, 1),
                    "expires_at": expiry,
                }
            base["contents"] = contents
        return base


# --------------- Global singleton ---------------
cache = TTLCache()


# --------------- Decorator ---------------
def cached(ttl_seconds: int, key_prefix: str = ""):
    """Decorator to cache async function results with a TTL.
    
    Usage:
        @cached(ttl_seconds=600, key_prefix="injuries")
        async def get_injuries(team_id, season=2024):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix or func.__name__}:{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            result = await func(*args, **kwargs)
            if result is not None:
                cache.set(cache_key, result, ttl_seconds)
            return result
        return wrapper
    return decorator
