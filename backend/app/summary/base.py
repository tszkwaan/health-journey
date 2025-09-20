from typing import Any, Dict, List
import os


class SummaryAdapter:
    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        raise NotImplementedError


def get_summary_adapter() -> SummaryAdapter:
    provider = os.getenv("LLM_PROVIDER", "rag")
    if provider == "ollama":
        from .ollama_adapter import OllamaSummaryAdapter
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3.2")
        return OllamaSummaryAdapter(base_url=base_url, model=model)
    elif provider == "rag":
        from .rag_adapter import RAGSummaryAdapter
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3.2")
        return RAGSummaryAdapter(base_url=base_url, model=model)
    else:
        from .rule_based import RuleBasedSummaryAdapter
        return RuleBasedSummaryAdapter()


