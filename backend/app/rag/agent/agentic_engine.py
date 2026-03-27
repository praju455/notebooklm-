from typing import Optional, List, Dict, Any, AsyncIterator
from collections import defaultdict
import time
import uuid
import re

from app.rag.vectorstore import VectorStore
from app.rag.providers.factory import ProviderFactory
from app.rag.providers.base import LLMProvider, LLMMessage
from app.rag.router.model_router import ModelRouter
from app.rag.agent.planner import QueryPlanner
from app.rag.agent.tool_executor import ToolExecutor
from app.rag.agent.function_calling import FunctionCallingHandler
from app.rag.agent.verifier import AnswerVerifier
from app.rag.agent.reflection import SelfReflection
from app.rag.retrieval.multi_hop import MultiHopRetrieval
from app.rag.tools.registry import tool_registry
from app.analytics.metrics import metrics_collector, QueryMetrics


class AgenticRAGEngine:
    """Agentic RAG Engine with multi-model support, tools, and verification."""
    
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.conversations: dict[str, list] = defaultdict(list)
        self.provider_factory = ProviderFactory()
        self.model_router = ModelRouter()
        self.query_planner = QueryPlanner()
        self.tool_executor = ToolExecutor()
        self.multi_hop_retrieval = MultiHopRetrieval(vector_store)
        
        # Initialize tools
        self._initialize_tools()
        
        # Current provider - initialize with first available provider
        default_provider = self.provider_factory.get_default_provider()
        if default_provider:
            self.current_provider = default_provider
            self.current_provider_name = default_provider.provider_name
            self.current_model = default_provider.model
        else:
            self.current_provider = None
            self.current_provider_name = "none"
            self.current_model = "none"
            print("Warning: No LLM providers available. Please set at least one API key.")
    
    def _initialize_tools(self):
        """Register all available tools."""
        from app.rag.tools.web_search_tavily import WebSearchTavilyTool
        from app.rag.tools.web_search_google import WebSearchGoogleTool
        from app.rag.tools.calculator import CalculatorTool
        from app.rag.tools.code_executor import CodeExecutorTool
        
        # Register web search tools (optional - only if API keys provided)
        try:
            tavily_tool = WebSearchTavilyTool()
            if tavily_tool.api_key and tavily_tool.client:
                tool_registry.register(tavily_tool)
                print(f"✓ Registered Tavily web search tool")
            else:
                print("⚠ Tavily web search not available (missing TAVILY_API_KEY)")
        except Exception as e:
            print(f"⚠ Failed to initialize Tavily tool: {e}")
        
        try:
            google_tool = WebSearchGoogleTool()
            if google_tool.service:
                tool_registry.register(google_tool)
                print(f"✓ Registered Google web search tool")
            else:
                print("⚠ Google web search not available (missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID)")
        except Exception as e:
            print(f"⚠ Failed to initialize Google Search tool: {e}")
        
        # Register other tools (always available)
        try:
            tool_registry.register(CalculatorTool())
            print("✓ Registered calculator tool")
        except Exception as e:
            print(f"⚠ Failed to register calculator: {e}")
        
        try:
            tool_registry.register(CodeExecutorTool())
            print("✓ Registered code executor tool")
        except Exception as e:
            print(f"⚠ Failed to register code executor: {e}")
        
        print(f"Total tools registered: {len(tool_registry.get_all())}")
    
    def set_provider(self, provider_name: str, model: Optional[str] = None):
        """Switch LLM provider."""
        provider = self.provider_factory.create_provider(provider_name, model)
        if provider:
            self.current_provider = provider
            self.current_provider_name = provider_name
            self.current_model = provider.model
            print(f"Switched to provider: {provider_name}, model: {provider.model}")
        else:
            raise ValueError(f"Provider '{provider_name}' not available or invalid model")
    
    def get_current_config(self) -> Dict[str, Any]:
        """Get current provider configuration."""
        if self.current_provider:
            return {
                "provider": self.current_provider_name,
                "model": self.current_model,
                "available_providers": self.provider_factory.get_available_providers()
            }
        return {
            "provider": "none",
            "model": "none",
            "available_providers": []
        }
    
    def clear_conversation(self, session_id: str):
        """Clear conversation history for a session."""
        if session_id in self.conversations:
            del self.conversations[session_id]
    
    def _trim_conversation_history(self, session_id: str, max_messages: int = 30):
        """Trim conversation history to prevent token overflow."""
        if session_id in self.conversations:
            messages = self.conversations[session_id]
            if len(messages) > max_messages:
                # Keep system message if exists, then last N messages
                system_msgs = [m for m in messages if m.get("role") == "system"]
                other_messages = [m for m in messages if m.get("role") != "system"]
                keep_messages = other_messages[-max_messages:]
                self.conversations[session_id] = system_msgs + keep_messages

    def _normalize_for_intent_detection(self, question: str) -> str:
        """Normalize text for lightweight intent classification."""
        return re.sub(r"[^a-z0-9\s']", "", question.lower()).strip()

    def _is_casual_query(self, question: str) -> bool:
        """Detect greetings and chatty prompts so we can avoid lecture mode."""
        normalized = self._normalize_for_intent_detection(question)
        if not normalized:
            return False

        casual_exact = {
            "hi", "hii", "hiii", "hello", "hello there", "hey", "hey there", "heyy", "heyyy", "yo", "sup",
            "whats up", "how are you", "thanks", "thank you", "ok", "okay",
            "cool", "nice", "alright", "good morning", "good night", "good evening",
            "gm", "gn", "wyd"
        }
        chatty_exact = {
            "who are you", "what are you", "whats your name", "what is your name",
            "what can you do", "tell me a joke", "joke", "roast me",
            "are you there", "can we chat", "lets chat", "talk to me",
            "how are you doing", "hows it going", "how is it going"
        }
        if normalized in casual_exact or normalized in chatty_exact:
            return True

        condensed = normalized.replace(" ", "")
        if len(normalized.split()) <= 4:
            return bool(re.match(r"^(h+i+|h+e+y+|hello+|yo+|sup+|thanks+|thankyou+)$", condensed))

        chatty_markers = [
            "your name", "tell me a joke", "roast me", "lets chat",
            "talk to me", "are you there", "what can you do"
        ]
        if len(normalized.split()) <= 7 and any(marker in normalized for marker in chatty_markers):
            return True

        return False

    def _is_memory_query(self, question: str) -> bool:
        """Detect questions that refer back to earlier turns in the same chat."""
        normalized = self._normalize_for_intent_detection(question)
        memory_markers = [
            "remember", "what did i", "what was my", "what did we", "earlier",
            "before", "previous", "last question", "last time", "you said",
            "i said", "we talked", "in this chat", "from above"
        ]
        return any(marker in normalized for marker in memory_markers)

    def _get_history_window_size(self, is_casual: bool = False, is_memory_query: bool = False) -> int:
        """Use shorter history for small talk and a longer window for recall questions."""
        if is_memory_query:
            return 18
        if is_casual:
            return 6
        return 12

    def _build_history_messages(
        self,
        session_id: str,
        is_casual: bool = False,
        is_memory_query: bool = False
    ) -> List[LLMMessage]:
        """Build a focused conversation window so old lecture replies do not dominate casual turns."""
        history = self.conversations.get(session_id, [])[:-1]
        history_window = self._get_history_window_size(
            is_casual=is_casual,
            is_memory_query=is_memory_query
        )
        recent_history = history[-history_window:]
        return [LLMMessage(role=msg["role"], content=msg["content"]) for msg in recent_history]

    def _build_system_prompt(self, is_casual: bool = False, is_memory_query: bool = False) -> str:
        """Build an intent-aware system prompt instead of forcing lecture mode every time."""
        prompt = """You are Neuron, a helpful AI assistant for both study help and normal conversation.

Core behavior:
- Match the user's intent, tone, and depth.
- Use the recent conversation history to maintain continuity and remember details mentioned in this session.
- For greetings, acknowledgements, and casual chat, reply naturally and briefly.
- For non-study, personal, or playful prompts, stay conversational instead of reframing them like a lesson.
- For simple direct questions, answer directly without turning them into a long lesson.
- Only switch into detailed teaching mode when the user clearly asks to learn, explain, compare, solve, or go deeper.
- Only use tables when they genuinely help the answer.
- Only add practice questions when the user clearly wants study mode or a deep explanation.
- If reference material is relevant, use it naturally.
- If reference material is unrelated, ignore it completely.
- Never mention internal retrieval, source numbering, filenames, or context mismatch.
- Never invent exact recent facts, live scores, or uncertain statistics. If unsure, say so clearly.

Formatting:
- Keep short answers in plain natural prose.
- Use markdown structure only when it genuinely improves clarity.
- Avoid padding, repetition, and lecture-style answers unless asked."""

        if is_casual:
            prompt += "\n\nThis specific user message is casual small talk. Reply in 1 short sentence or 2 short lines maximum. Do not analyze hidden meanings unless the user explicitly asks you to interpret the phrase."

        if is_memory_query:
            prompt += "\n\nThis specific user message is about prior conversation context. Base your answer on the session history first, and clearly say if the requested detail is not present."

        return prompt

    def _build_user_content(
        self,
        question: str,
        context: str,
        is_casual: bool = False,
        is_memory_query: bool = False
    ) -> str:
        """Build the user message sent to the model while preserving the user's real intent."""
        instructions = ["Answer the user's actual intent directly."]

        if is_casual:
            instructions.append("This is casual small talk, so keep the reply brief and natural.")
        elif is_memory_query:
            instructions.append("This question refers to the current chat history, so answer from prior messages in this session when possible.")
        else:
            instructions.append("Be concise by default, and only go deep if the question calls for it.")

        if context:
            return f"""Relevant reference material (use only if it truly helps answer the user):
{context}

User message: {question}

{' '.join(instructions)}"""

        return f"""User message: {question}

{' '.join(instructions)}"""
    
    async def query(
        self,
        question: str,
        session_id: str,
        top_k: int = 10,
        source_filter: Optional[str] = None,
        user_id: str = "default",
        use_agentic: bool = True,
        use_web_search: bool = False
    ) -> tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
        """Process a query with agentic capabilities."""
        
        start_time = time.time()
        query_id = str(uuid.uuid4())
        
        try:
            # Add user message to conversation history
            self.conversations[session_id].append({"role": "user", "content": question})
            is_casual = self._is_casual_query(question)
            is_memory_query = self._is_memory_query(question)
            skip_retrieval = is_casual or is_memory_query
            
            # Route to appropriate provider
            if not self.current_provider:
                self.current_provider = self.model_router.route_query(question)
            
            if not self.current_provider:
                raise Exception("No LLM provider available")
            
            # Create function calling handler
            function_handler = FunctionCallingHandler(self.current_provider)
            
            # Plan query if agentic mode
            plan = None
            if use_agentic and not skip_retrieval:
                plan = await self.query_planner.plan_query(question)
            
            # Check if web search is needed
            web_search_results = []
            if use_web_search and not is_casual:
                # Check for web search tool
                web_search_tool = tool_registry.get("web_search")
                if not web_search_tool:
                    web_search_tool = tool_registry.get("web_search_google")
                
                if web_search_tool:
                    # Perform web search when explicitly requested
                    search_result = await web_search_tool.execute(query=question, max_results=5)
                    if search_result.success:
                        web_search_results = search_result.data
                else:
                    print("Warning: Web search requested but no web search tool available (missing API keys)")
            elif plan and plan.get("requires_tools"):
                # Auto-detect if web search might be helpful
                query_lower = question.lower()
                needs_search = any(kw in query_lower for kw in ["current", "recent", "latest", "today", "now", "2024", "2025"])
                
                if needs_search:
                    web_search_tool = tool_registry.get("web_search")
                    if not web_search_tool:
                        web_search_tool = tool_registry.get("web_search_google")
                    
                    if web_search_tool:
                        search_result = await web_search_tool.execute(query=question, max_results=5)
                        if search_result.success:
                            web_search_results = search_result.data
            
            # Retrieve relevant chunks
            if skip_retrieval:
                results = []
            elif use_agentic:
                results = await self.multi_hop_retrieval.retrieve(
                    query=question,
                    top_k=top_k,
                    source_filter=source_filter,
                    user_id=user_id
                )
            else:
                results = await self.vector_store.search(
                    query=question,
                    top_k=top_k,
                    source_filter=source_filter,
                    user_id=user_id
                )
            
            # Auto web search fallback: if no docs found and web search wasn't already done
            if not results and not use_web_search and not skip_retrieval:
                web_search_tool = tool_registry.get("web_search")
                if not web_search_tool:
                    web_search_tool = tool_registry.get("web_search_google")
                if web_search_tool:
                    search_result = await web_search_tool.execute(query=question, max_results=5)
                    if search_result.success:
                        web_search_results = search_result.data
            
            # Build context
            context_parts = []
            citations = []
            
            if results:
                for i, result in enumerate(results):
                    metadata = result.get("metadata", {})
                    source_info = self._format_source_info(metadata)
                    context_parts.append(result.get('content', ''))
                    
                    citation = {
                        "source": str(metadata.get("file_path") or metadata.get("source_name") or "Unknown"),
                        "content": str(result.get("content", ""))[:200],
                    }
                    if metadata.get("line_start"):
                        try:
                            citation["line"] = int(metadata.get("line_start"))
                        except:
                            pass
                    if metadata.get("page"):
                        try:
                            citation["page"] = int(metadata.get("page"))
                        except:
                            pass
                    citations.append(citation)
            
            # Add web search results to context
            if web_search_results:
                for i, result in enumerate(web_search_results):
                    context_parts.append(f"{result.get('title', '')}\n{result.get('snippet', '')}")
                    citations.append({
                        "source": result.get("url", ""),
                        "content": result.get("snippet", "")[:200],
                        "type": "web"
                    })
            
            context = "\n\n---\n\n".join(context_parts)
            
            # Build system prompt
            system_prompt = """You are Neuron, an expert study tutor. Your ONLY job is to TEACH and EXPLAIN concepts clearly.

CRITICAL RULES (NEVER BREAK THESE):
- NEVER write [Source N], [Source 1], [Source 2] etc. — you have NO sources to cite
- NEVER create tables listing sources, page numbers, or source metadata
- NEVER organize your answer around sources or references
- NEVER say "the sources don't seem related", "the context doesn't cover this", or "there might be a mix-up"
- NEVER mention filenames like "Module-3.pdf" or any document name in your answer
- NEVER comment on whether the provided reference material is relevant or not
- If the reference material is about a DIFFERENT topic than the question, COMPLETELY IGNORE IT and answer purely from your own knowledge
- If the reference material IS relevant, use it naturally without citing source numbers
- Answer the student's ACTUAL question directly — don't get distracted by unrelated reference material
-Never give a practice qs if the
Your teaching style:
- Explain concepts like a great professor — clear, structured, engaging
- Start with a brief overview, then go deep
- Use **real-world examples** and **everyday analogies**
- Use **bold key terms**, bullet points, and numbered lists
- When comparing concepts, use a comparison table (of concepts, NOT sources)
- For technical/code topics, include working code examples with comments
- End longer answers with 2-3 **Practice Questions** (without hints unless asked)
- Use mnemonics or memory tricks when helpful
- Keep responses focused and avoid unnecessary padding or repetition
- Do NOT show "Web Search Results" — the UI handles sources separately
- Format responses in clean, readable markdown

Special knowledge areas:
- Expert in cricket — players, records, stats, ICC rankings, IPL, World Cups, all formats
- Expert in academics — math, science, engineering, computer science, and all school/college subjects
- For stats/records questions, prioritize accuracy and use web search data when available"""
            
            # Build messages with focused conversation history
            messages = self._build_history_messages(
                session_id=session_id,
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )
            
            # Add current question with context
            system_prompt = self._build_system_prompt(
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )

            user_content = self._build_user_content(
                question=question,
                context=context,
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )

            messages.append(LLMMessage(role="user", content=user_content))
            
            # Generate response
            response = await self.current_provider.generate(
                messages=messages,
                system_prompt=system_prompt,
                temperature=0.7
            )
            
            # Ensure answer is a string
            answer = response.content
            if not isinstance(answer, str):
                if isinstance(answer, tuple):
                    answer = str(answer[0]) if len(answer) > 0 else ""
                else:
                    answer = str(answer)
            
            # Verify answer if agentic mode
            verification = None
            if use_agentic and results:
                verifier = AnswerVerifier(self.current_provider)
                verification = await verifier.verify(answer, results, question)
            
            # Add assistant response to history
            self.conversations[session_id].append({"role": "assistant", "content": answer})
            self._trim_conversation_history(session_id)
            
            # Record metrics
            duration_ms = (time.time() - start_time) * 1000
            metrics = QueryMetrics(
                query_id=query_id,
                provider=self.current_provider_name,
                model=self.current_model,
                tokens_used=response.tokens_used or 0,
                cost=response.cost or 0.0,
                duration_ms=duration_ms,
                success=True
            )
            metrics_collector.record_query(metrics)
            
            # Build metadata
            metadata = {
                "plan": plan,
                "verification": verification,
                "web_search_used": len(web_search_results) > 0,
                "tools_used": self.tool_executor.get_execution_history()
            }
            
            return answer, citations, metadata
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            metrics = QueryMetrics(
                query_id=query_id,
                provider=self.current_provider_name,
                model=self.current_model,
                tokens_used=0,
                cost=0.0,
                duration_ms=duration_ms,
                success=False,
                error=str(e)
            )
            metrics_collector.record_query(metrics)
            raise
    
    async def query_stream(
        self,
        question: str,
        session_id: str,
        top_k: int = 10,
        source_filter: Optional[str] = None,
        user_id: str = "default",
        use_agentic: bool = True,
        use_web_search: bool = False
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream query responses."""
        
        try:
            # Add user message
            self.conversations[session_id].append({"role": "user", "content": question})
            is_casual = self._is_casual_query(question)
            is_memory_query = self._is_memory_query(question)
            skip_retrieval = is_casual or is_memory_query
            
            # Route provider
            if not self.current_provider:
                self.current_provider = self.model_router.route_query(question)
            
            if not self.current_provider:
                yield {"type": "error", "error": "No LLM provider available"}
                return
            
            # Web search if needed
            web_search_results = []
            if use_web_search and not is_casual:
                web_search_tool = tool_registry.get("web_search") or tool_registry.get("web_search_google")
                if web_search_tool:
                    # Perform web search when explicitly requested
                    search_result = await web_search_tool.execute(query=question, max_results=5)
                    if search_result.success:
                        web_search_results = search_result.data
                        yield {"type": "web_search", "results": web_search_results, "session_id": session_id}
                else:
                    yield {"type": "error", "error": "Web search requested but no web search tool available (missing API keys)"}
            
            # Retrieve chunks
            if skip_retrieval:
                results = []
            elif use_agentic:
                results = await self.multi_hop_retrieval.retrieve(
                    query=question,
                    top_k=top_k,
                    source_filter=source_filter,
                    user_id=user_id
                )
            else:
                results = await self.vector_store.search(
                    query=question,
                    top_k=top_k,
                    source_filter=source_filter,
                    user_id=user_id
                )
            
            # Auto web search fallback: if no docs found and web search wasn't already done
            if not results and not use_web_search and not skip_retrieval:
                web_search_tool = tool_registry.get("web_search") or tool_registry.get("web_search_google")
                if web_search_tool:
                    search_result = await web_search_tool.execute(query=question, max_results=5)
                    if search_result.success:
                        web_search_results = search_result.data
                        yield {"type": "web_search", "results": web_search_results, "session_id": session_id}
            
            # Build context
            context_parts = []
            citations = []
            
            if results:
                for i, result in enumerate(results):
                    metadata = result.get("metadata", {})
                    source_info = self._format_source_info(metadata)
                    context_parts.append(result.get('content', ''))
                    
                    citation = {
                        "source": str(metadata.get("file_path") or metadata.get("source_name") or "Unknown"),
                        "content": str(result.get("content", ""))[:200],
                    }
                    if metadata.get("line_start"):
                        try:
                            citation["line"] = int(metadata.get("line_start"))
                        except:
                            pass
                    citations.append(citation)
            
            if web_search_results:
                for i, result in enumerate(web_search_results):
                    context_parts.append(f"{result.get('title', '')}\n{result.get('snippet', '')}")
                    citations.append({
                        "source": result.get("url", ""),
                        "content": result.get("snippet", "")[:200],
                        "type": "web"
                    })
            
            context = "\n\n---\n\n".join(context_parts)
            
            system_prompt = self._build_system_prompt(
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )

            # Build messages with focused conversation history
            messages = self._build_history_messages(
                session_id=session_id,
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )
            
            system_prompt = """You are Neuron, an expert study tutor. Your ONLY job is to TEACH and EXPLAIN concepts clearly.

CRITICAL RULES (NEVER BREAK THESE):
- NEVER write [Source N], [Source 1], [Source 2] etc. — you have NO sources to cite
- NEVER create tables listing sources, page numbers, or source metadata
- NEVER organize your answer around sources or references
- NEVER say "the sources don't seem related", "the context doesn't cover this", or "there might be a mix-up"
- NEVER mention filenames like "Module-3.pdf" or any document name in your answer
- NEVER comment on whether the provided reference material is relevant or not
- If the reference material is about a DIFFERENT topic than the question, COMPLETELY IGNORE IT and answer purely from your own knowledge
- If the reference material IS relevant, use it naturally without citing source numbers
- Answer the student's ACTUAL question directly — don't get distracted by unrelated reference material
-Never give a practice qs

ANTI-HALLUCINATION RULES (CRITICAL FOR SPORTS/STATS):
- NEVER invent, fabricate, or guess specific scores, match results, dates, or statistics
- NEVER make up player scores like "He scored 52 off 28 balls vs. X" unless you are 100% certain it is real
- If you do NOT have verified data for a specific stat or score, clearly say: "I don't have exact data for this — please check ESPNcricinfo or Cricbuzz for the latest scores"
- Only use statistics that you know with high confidence from your training data or from the provided web search results
- It is BETTER to admit uncertainty than to make up numbers

Your teaching style:
- Explain concepts like a great professor — clear, structured, engaging
- Start with a brief overview, then go deep
- Use **real-world examples** and **everyday analogies**
- Use **bold key terms**, bullet points, and numbered lists
- When comparing concepts, use a comparison table (of concepts, NOT sources)
- For technical/code topics, include working code examples with comments
- End longer answers with 2-3 **Practice Questions** (without hints unless asked)
- Use mnemonics or memory tricks when helpful
- Keep responses focused and avoid unnecessary padding or repetition
- Do NOT show "Web Search Results" — the UI handles sources separately
- Format responses in clean, readable markdown

Special knowledge areas:
- Expert in cricket — players, records, stats, ICC rankings, IPL, World Cups, all formats (Test/ODI/T20)
- Expert in academics — math, science, engineering, computer science, all school/college subjects
- For live scores or very recent match results, always recommend ESPNcricinfo or Cricbuzz
- Calcu;ate the  stas if its not explecitly given to u by the web search
- Only state stats you are genuinely certain about from training data or verified web search results"""
            
            if context:
                user_content = f"""Here is reference material from the student's uploaded documents:
{context}

The student asks: {question}

Teach this topic thoroughly. Synthesize the reference material into a clear, professor-quality explanation. Do NOT list sources or create source tables."""
            else:
                user_content = f"The student asks: {question}\n\nTeach this topic thoroughly."
            
            system_prompt = self._build_system_prompt(
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )

            user_content = self._build_user_content(
                question=question,
                context=context,
                is_casual=is_casual,
                is_memory_query=is_memory_query
            )

            messages.append(LLMMessage(role="user", content=user_content))
            
            # Stream response
            full_answer = ""
            async for chunk in self.current_provider.generate_stream(
                messages=messages,
                system_prompt=system_prompt,
                temperature=0.7
            ):
                full_answer += chunk
                yield {"type": "chunk", "content": chunk, "session_id": session_id}
            
            # Add to history
            self.conversations[session_id].append({"role": "assistant", "content": full_answer})
            self._trim_conversation_history(session_id)
            
            # Send citations
            yield {"type": "done", "citations": citations, "session_id": session_id}
            
        except Exception as e:
            yield {"type": "error", "error": str(e)}
    
    def _format_source_info(self, metadata: Dict[str, Any]) -> str:
        """Format source information for display."""
        parts = []
        if metadata.get("source_name"):
            parts.append(metadata["source_name"])
        if metadata.get("file_path"):
            parts.append(metadata["file_path"])
        if metadata.get("page"):
            parts.append(f"page {metadata['page']}")
        if metadata.get("line_start"):
            parts.append(f"line {metadata['line_start']}")
        return " | ".join(parts) if parts else "Unknown"
