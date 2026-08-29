"""
LLM Manager for Ollama integration
"""

import logging
import os
import time
from collections import OrderedDict
from hashlib import sha256
from typing import Any, Dict, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class LLMManager:
    """Manages communication with Ollama/Gemma4 models and optional OpenAI API"""

    def __init__(self):
        # Ollama config
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "gemma4:latest")

        # OpenAI config (optional)
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.openai_timeout = float(os.getenv("OPENAI_TIMEOUT", "30"))
        self.ollama_timeout = float(os.getenv("OLLAMA_TIMEOUT", "60"))

        # Simple in-memory caches to avoid repeated calls with identical prompts
        cache_size = int(os.getenv("LLM_CACHE_SIZE", "8"))
        self._ollama_cache: "OrderedDict[Tuple[str, Tuple[Any, ...]], str]" = OrderedDict()
        self._openai_cache: "OrderedDict[Tuple[str, Tuple[Any, ...]], str]" = OrderedDict()
        self._cache_size = max(cache_size, 0)

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------
    def _make_cache_key(self, prompt: str, *params: Any) -> Tuple[str, Tuple[Any, ...]]:
        prompt_hash = sha256(prompt.encode("utf-8")).hexdigest()
        return prompt_hash, params

    def _cache_get(self, cache: "OrderedDict[Tuple[str, Tuple[Any, ...]], str]", key):
        if self._cache_size <= 0:
            return None
        value = cache.get(key)
        if value is not None:
            cache.move_to_end(key)
        return value

    def _cache_set(self, cache: "OrderedDict[Tuple[str, Tuple[Any, ...]], str]", key, value: str):
        if self._cache_size <= 0 or value is None:
            return
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > self._cache_size:
            cache.popitem(last=False)

    # ------------------------------------------------------------------
    # Ollama helpers
    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        """Check if Ollama is running"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    def generate_response(self, prompt: str, **kwargs) -> Optional[str]:
        """Generate response from Ollama"""
        if not prompt:
            return None

        cache_key = self._make_cache_key(
            prompt,
            kwargs.get("model", self.model),
            kwargs.get("temperature", 0.1),
            kwargs.get("top_p", 0.9),
            kwargs.get("max_tokens", 2000),
        )
        cached = self._cache_get(self._ollama_cache, cache_key)
        if cached is not None:
            logger.debug("Ollama cache hit for prompt hash %s", cache_key[0][:8])
            return cached

        try:
            start_time = time.time()

            payload = {
                "model": kwargs.get("model", self.model),
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": kwargs.get("temperature", 0.1),
                    "top_p": kwargs.get("top_p", 0.9),
                    "num_predict": kwargs.get("max_tokens", 2000),
                },
            }

            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=kwargs.get("timeout", self.ollama_timeout),
            )

            if response.status_code == 200:
                result = response.json()
                processing_time = time.time() - start_time
                logger.info(f"Ollama response generated in {processing_time:.2f}s")
                text = result.get("response", "").strip()
                if text:
                    self._cache_set(self._ollama_cache, cache_key, text)
                return text

            logger.error(f"Ollama request failed: {response.status_code} - {response.text}")
            return None

        except Exception as exc:
            logger.error(f"Error generating Ollama response: {exc}")
            return None

    # ------------------------------------------------------------------
    # OpenAI helpers
    # ------------------------------------------------------------------
    def is_openai_available(self) -> bool:
        """True if OpenAI credentials are configured"""
        return bool(self.openai_api_key)

    def generate_response_openai(self, prompt: str, **kwargs) -> Optional[str]:
        """Generate response from OpenAI Chat Completions API"""
        if not prompt or not self.openai_api_key:
            return None

        cache_key = self._make_cache_key(
            prompt,
            kwargs.get("model", self.openai_model),
            kwargs.get("temperature", 0.1),
            kwargs.get("max_tokens"),
        )
        cached = self._cache_get(self._openai_cache, cache_key)
        if cached is not None:
            logger.debug("OpenAI cache hit for prompt hash %s", cache_key[0][:8])
            return cached

        try:
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json",
            }
            payload: Dict[str, Any] = {
                "model": kwargs.get("model", self.openai_model),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": kwargs.get("temperature", 0.1),
            }
            max_tokens = kwargs.get("max_tokens")
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens

            response = requests.post(
                f"{self.openai_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=kwargs.get("timeout", self.openai_timeout),
            )

            if response.status_code == 200:
                data = response.json()
                choices = data.get("choices")
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    text = content.strip()
                    if text:
                        self._cache_set(self._openai_cache, cache_key, text)
                    return text
                logger.error("OpenAI response missing choices field")
                return None

            logger.error(f"OpenAI request failed: {response.status_code} - {response.text}")
            return None

        except Exception as exc:
            logger.error(f"Error generating OpenAI response: {exc}")
            return None


# Global instance
llm_manager = LLMManager()
