from typing import List, Dict, Any
import os


LOCAL_RERANKER_ENABLED = os.getenv("ENABLE_LOCAL_RERANKER", "").lower() == "true"


class Reranker:
    """Re-rank retrieved documents for better relevance."""
    
    def __init__(self):
        self.model = None
        if not LOCAL_RERANKER_ENABLED:
            return

        try:
            from sentence_transformers import CrossEncoder
            self.model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        except Exception as e:
            print(f"Failed to load reranker model: {e}")
    
    async def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Re-rank documents by relevance to query."""
        
        if not documents:
            return []
        
        if not self.model:
            # Fallback: return original order
            return documents[:top_k]
        
        try:
            # Prepare pairs for scoring
            pairs = [
                [query, doc.get("content", "")]
                for doc in documents
            ]
            
            # Score pairs
            scores = self.model.predict(pairs)
            
            # Sort by score
            scored_docs = list(zip(documents, scores))
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            
            # Return top_k
            return [doc for doc, score in scored_docs[:top_k]]
        except Exception as e:
            print(f"Reranking error: {e}")
            return documents[:top_k]
