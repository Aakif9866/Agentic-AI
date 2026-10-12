# Topics Covered — One Module Per Section

Purpose: paste a module's section into another AI and ask it to teach you that
topic in full, with the listed prerequisites as the known baseline.

Prerequisites marked **(from NOTES.md)** are the module author's own words.
Prerequisites marked **(inferred)** have no "## Prerequisites" section in the
source file — they're derived from explicit cross-references inside that
module's own NOTES.md/README.md content, not invented from scratch.

---

## Module 0 — Python Core Basics (Recap)
Topics:
- Variables & core types: `str`, `int`, `float`, `bool`, `None`
- Operators: arithmetic, comparison, logical
- Strings: f-strings, indexing, slicing, common methods
- Collections: `list`, `tuple`, `dict`, `set` — what each is for and when to use it
- Control flow: `if`/`elif`/`else`
- Loops: `for`, `while`, `range`, `enumerate`
- Functions: `def`, default arguments, `*args`/`**kwargs`, `return`
- A minimal class: `__init__`, `self`, one method — just enough to recognise `class` syntax later
- Imports: `import`, `from x import y`, `if __name__ == "__main__"`

Prerequisites (from NOTES.md): None. This is the starting point — before Module 1.

---

## Module 1 — Agentic AI Foundations
Topics:
- Pure theory, no code — builds vocabulary for the rest of the course
- Progression: Generative AI → AI Agent → Agentic AI, and the limits of each stage
- Key terms: tool call, orchestrator, memory, guardrails, HITL, supervisor, context awareness
- The five components of an agentic system: Brain (LLM), Orchestrator, Memory, Supervisor, Tools
- Common confusions: agent vs. chatbot; "agent is a prompt" vs. the think→act→observe→think loop

Prerequisites (from NOTES.md): None. This is the start.

---

## Module 2 — Python Essentials: Async & Pydantic
Topics:
- async/await, coroutines, asyncio.gather (concurrency), asyncio.run
- Why async matters for agents (async MCP client, parallel agent calls later)
- Pydantic v2 BaseModel, Literal fields, Field(ge=, le=) as a contract for LLM structured output
- with_structured_output() tied directly to Pydantic models
- model_dump() (v2) vs. deprecated .dict() (v1)
- Common errors: RuntimeWarning (un-awaited coroutine), ValidationError

Prerequisites (from NOTES.md): Functions, dicts, classes, imports. That's it.

---

## Module 3 — Agents with LangChain (Single & Multi-Agent)
Topics:
- Two LangChain (not LangGraph) projects: single agent + tools, and a Search → Reader → Writer → Critic multi-agent pipeline
- Contrast purpose: what LangGraph later replaces — control flow scattered in Python glue vs. an explicit graph
- Structured output via Pydantic
- Streamlit UI and CLI entry points for both projects
- Most likely folder to be bit-rotten (stale Groq model names / older LangChain API)

Prerequisites (from NOTES.md):
- Module 2's Pydantic check (structured output appears here)
- A `GROQ_API_KEY` and `TAVILY_API_KEY` in each project's `.env`

---

## Module 4 — LangGraph Fundamentals
Topics:
- The three primitives: State (TypedDict), Nodes (functions returning changed-keys dict), Edges
- LLM-powered nodes (ChatGroq inside a node)
- Sequential chaining (prompt chaining)
- Parallel fan-out/fan-in with reducers (`Annotated[list, operator.add]`) to avoid InvalidUpdateError
- Conditional routing via `add_conditional_edges` + structured Literal output (never string-match raw text)
- Iterative loop (evaluator-optimizer) with a max-iteration cap + recursion_limit backstop
- Gotchas: Groq model-name deprecation, `ChatGroq` vs `init_chat_model`, returning full state vs. changed keys

Prerequisites (inferred): Module 2 (Pydantic/TypedDict-style thinking, async basics) and Module 1's vocabulary. This is the first graph module — nothing graph-specific comes before it.

---

## Module 5 — LangGraph Workflow Patterns
Topics:
- Dynamic fan-out with `Send` (runtime-determined number of parallel branches)
- `Command(update=..., goto=...)` — combined state-update + routing in one step
- Multiway routing via an explicit `{result: node}` dict with `add_conditional_edges`
- Map-reduce pipeline: `Send` fan-out + a dedicated reduce node
- Capped refinement loop: multi-criteria check + max_iteration + recursion_limit (two independent safety nets)
- Gotcha: Groq's `gpt-oss-120b` needs `method="json_mode"` for `with_structured_output`; json_mode requires the literal word "json" in the prompt plus explicit field names

Prerequisites (inferred): Module 4 — every pattern here extends the State/Node/Edge primitives and conditional routing introduced there.

---

## Module 6 — Agentic Chatbot: Memory, Streaming & Threads
Topics:
- `MessagesState` + `add_messages` reducer (baseline stateless chatbot)
- Checkpointers (`InMemorySaver`) for memory, `thread_id` for separate conversations, time travel via `get_state_history`
- Streaming modes: "messages" (tokens), "updates" (per-node), "values" (full state)
- `SqliteSaver` for memory that survives restarts; `check_same_thread=False` for web frameworks
- LangSmith tracing via env vars (zero code changes)
- Gotchas: Groq model deprecation, folder names with `:` break uv/venv, `invoke(None, cfg)` resumes from checkpoint

Prerequisites (inferred): Module 4 — needs the StateGraph basics this chatbot is built on top of.

---

## Module 7 — Observability & Tools
Topics:
- Tool-calling loop as a graph: `ToolNode` + `tools_condition` (chat ⇄ tools loop)
- Multi-tool agents: the model picks a tool based on docstring + system prompt
- Parallel tool calls in one turn (model-dependent, not graph-dependent)
- Bounding context with `trim_messages` (`strategy="last"`, `start_on="human"`, `include_system=True`)
- Tool safety: errors returned as text (never raised), whitelisted calculator regex instead of bare `eval()`

Prerequisites (inferred): Module 4 (graph basics). Module 6 is a useful but not required companion for the memory/streaming context.

---

## Module 8 — RAG & Human-in-the-Loop
Topics:
- RAG ingest pipeline: `PyPDFLoader` → whitespace cleanup → `RecursiveCharacterTextSplitter` → FAISS embeddings
- Retrieval-as-a-tool design (agent decides when to search, not a mandatory step)
- HITL basics: `interrupt()` pauses a node, `Command(resume=...)` continues; checkpointer required; side effects must sit after `interrupt()`
- Approval inside risky tools (e.g. `purchase_stock`)
- Three HITL patterns: approve/reject, edit, ask-for-input; UI polling via `get_state().tasks[].interrupts`
- Gotchas: model drafting instead of calling the tool, `langchain-huggingface` missing `sentence-transformers`, `allow_dangerous_deserialization` for FAISS

Prerequisites (inferred): Module 7 — retrieval is wired up as a tool inside the same ToolNode loop, and HITL pauses that loop.

---

## Module 9 — Deployment (Docker, CI/CD, Render)
Topics:
- Splitting graph (`backend.py`) from transport (`api.py`) — no web code in the agent file
- FastAPI streaming endpoint (`StreamingResponse` + generator) wired to `stream_mode="messages"`
- Dockerfile layer ordering (deps before code) for build-cache efficiency; `--frozen`, `--no-dev`, `$PORT`
- `.dockerignore` to keep `.env`/`.venv`/secrets out of the image
- GitHub Actions CI: build image, run it, poll `/health` with a retry loop (not a fixed sleep)
- Deploying to Render free tier; disk wiped on redeploy/sleep (swap `SqliteSaver` → `PostgresSaver`)

Prerequisites (inferred): Module 6 or 8 — you need a working graph (memory + optionally RAG/HITL) to deploy. This module's `backend.py`/`api.py` split is what Module 10 and 19 reuse.

---

## Module 10 — Project: Build Your Own ChatGPT Agent
Topics:
- Capstone combining Modules 6-9: memory, streaming, threads, tools, RAG, HITL behind FastAPI
- Four-file shape: `tools.py` (capabilities), `backend.py` (graph), `api.py` (transport), `ingest.py` (one-off PDF load)
- Import-time env loading pattern (`load_dotenv()` inside `tools.py`) for modules with import-time API clients
- HITL over HTTP: `/chat` returns an empty stream when paused, `/pending/{id}` + `/approve` (`Command(resume=...)`) to continue
- Streamlit UI talking directly to the graph object (not via HTTP) for simplicity
- Known limitations: SQLite non-persistence on free hosts, no thread deletion, embedding-model cold-start download

Prerequisites (from NOTES.md content): Modules 6-9 — explicitly a capstone of memory/streaming/threads (6), tools (7), RAG/HITL (8), and the deploy shape (9).

---

## Module 11 — TripMate AI (Multi-Agent Travel Planner)
Topics:
- Supervisor-and-specialists multi-agent pattern: `parse_request → supervisor ⇄ {weather, places, budget} → assemble`
- Deterministic (non-LLM) supervisor routing via `Command(goto=...)` + a visited-list reducer to guarantee no infinite loop
- Graceful degradation (weather API key optional, falls back to Tavily search)
- "Let the model decide what, let code compute how much" — Python sums budget totals, not the LLM; capped retry with specific overage feedback
- Nested structured output (`Itinerary` containing a list of `DayPlan`) via json_mode with explicit shape + count
- Gotchas: json_mode everywhere, aligned-list schema fragility, forgetting to update "visited"

Prerequisites (inferred): Module 5 (Command-based routing, capped loops) and Module 2 (Pydantic / json_mode structured output).

---

## Module 12 — MCP (Model Context Protocol)
Topics:
- MCP as a standard shape for tools usable by any MCP-aware client (LangGraph agent, Claude Desktop, Cursor)
- FastMCP server with `@mcp.tool()`; stdout is reserved for the protocol (log to stderr only)
- Async client (`load_mcp_tools`, `agent.ainvoke`)
- Critical bug/lesson: `get_tools()` opens a new stdio session (= new subprocess) per call, losing in-memory state; fix is holding one `client.session(...)` open for the whole conversation
- `create_agent(model, tools, system_prompt=...)` 1.x signature (verified via `inspect.signature()`, not guessed)
- Stateful vs. stateless MCP servers and session-lifetime implications

Prerequisites (inferred): Module 2 (async — explicitly ties back to it) and Module 7 (tool-calling concepts, now server-provided instead of in-process).

---

## Module 13 — LangGraph Subgraphs + AgentWriter AI
Topics:
- Subgraphs: a compiled graph invoked as a step inside a parent graph's node, with its own narrow schema
- Explicit dict mapping between parent and subgraph state (preferred over shared-key auto-merge) for reusability/debuggability
- Pipeline: `plan → research (subgraph) → write → edit`, with a capped revision loop (Literal verdict + feedback)
- Counter placement matters: iteration increments in `write`, not `edit`, to avoid infinite-loop risk
- `stream_mode="updates"` to observe per-stage progress; avoiding double-billing (stream AND invoke the same input)
- Lesson: a critic that "approves on first pass" is a false positive — always prove the critic can reject

Prerequisites (inferred): Module 4 (graphs) and Module 5 (capped loops, routing) — a subgraph is a graph nested inside the same patterns.

---

## Module 14 — Guardrails + Multi-Agent Supervisor System
Topics:
- Specialists wrapped as tools of a supervisor (vs. Module 11's node-based routing) — two valid multi-agent shapes compared
- Four-layer guardrail middleware stack, cheap→expensive: InputGuard (regex) → PIIMiddleware (redact) → HumanInTheLoopMiddleware (interrupt) → OutputSafety (LLM judge)
- `hook_config(can_jump_to=["end"])` / `jump_to` for short-circuiting middleware
- `HumanInTheLoopMiddleware(interrupt_on=...)` — declarative HITL vs. Module 8's hand-rolled `interrupt()`
- Adversarial eval harness (`test_guards.py`): 5 cases incl. a mandatory "must get through" control case
- Gotchas: import-order env-loading bug (recurring pattern), verifying middleware APIs via `inspect.signature()`, over-eager allowlist false positives

Prerequisites (inferred): Module 11 (multi-agent supervisor pattern, directly compared against) and Module 8 (HITL, now reimplemented declaratively).

---

## Module 15 — Harness & Loop Engineering
Topics:
- "Harness" = everything around the model (prompt, tools, loop, limits, logging) — most agent failures are harness failures
- "Loop engineering" = deciding how/when an agent stops
- The 8-row harness audit framework: Context, Tools, Control flow, Verification, Permissions, State/memory, Budgets, Observability
- Auditing Module 10 for weaknesses with real file:line evidence; Budgets identified as the weakest row (unbounded liability)
- Real fix: `MAX_LLM_CALLS_PER_THREAD` counter added to state, checked before `llm.invoke` so refusals cost nothing
- Before/after demonstration with a reproducible env-var-driven cap

Prerequisites (from NOTES.md):
- Module 10 built (it's the thing being audited)
- Having run Modules 4-10, so you recognise what the code does
- No new packages; nothing to install

---

## Module 16 — AI Agent Evaluation
Topics:
- Eval concept for non-deterministic systems: asserting properties, not exact output equality
- LLM-as-judge for grading answers that have no single correct string
- Five eval dimensions: final answer, tool selection, trajectory, latency, safety
- 31-case JSONL dataset across tool_use/correctness/safety/latency categories; cross-module import of Module 14's agent as the target
- Prompt-leak canary (forbidden system-prompt fragments) and PII-redaction checks
- Real debugging story: first run scored 88.6%, found a genuine injection-regex bug plus false-positive allowlist bugs vs. bugs in the eval dataset itself
- Regression-proving experiment: vaguing a tool's docstring/name causes measurable, CI-gatable score drops

Prerequisites (from NOTES.md):
- Module 14 built — it's the agent being evaluated; Module 16 imports it from the sibling folder
- Modules 7 (tools) and 14 (guardrails) understood, because the dimensions measure exactly those behaviours
- New package: `pandas`. Nothing else

---

## Module 17 — Multi-Provider LLM Gateway
Topics:
- Gateway pattern: one layer that knows provider configuration, capabilities, and failure handling (Groq + DeepSeek + Gemini)
- Measured (not assumed) capability matrix per provider: chat/tools/native-structured-output/json_mode
- Fallback logic classifying errors as Permanent (402/401/404 — move on now) vs. Transient (429/timeout/5xx — may recover)
- Provider ordering strategy tied to cost (free → cheap → strongest) for budget management
- Observability per call (provider used, fell_back, attempts log); bounded by timeout + per-process spend guard
- Four real bugs found: Gemini model-availability trap, `GEMINI_API_KEY` vs `GOOGLE_API_KEY` env mismatch, spend-guard swallowed by its own `except`, `order=[]` vs `None` falsy bug
- `json_mode` hint auto-derives types/enums from a Pydantic schema (generalizes Module 5's manual workaround)

Prerequisites (from NOTES.md):
- Modules 4-7 (you should recognise `init_chat_model`, tools, structured output)
- The `json_mode` workaround from `AGENT_RULES.md` #2 — this module automates it

---

## Module 18 — Advanced RAG I: Corrective RAG & Self-RAG
Topics:
- CRAG: grade retrieved documents with a threshold-based CORRECT/AMBIGUOUS/INCORRECT decision, each routing to a different retrieval/generation path (incl. web fallback)
- Self-RAG: grade the agent's own answer (IsSUP grounding check, IsUSE usefulness check) with independent retry/rewrite caps
- Sentence-level "refine" step to strip irrelevant text from noisy chunks before generation
- `no_answer` node as a first-class "I don't know" path reachable from three failure points
- Major bug story: an overly cautious `decide_retrieval` gate silently skipped retrieval entirely, causing confidently wrong answers with zero errors
- Deterministic test (`test_caps.py`) proving loop caps without spending API calls

Prerequisites (from NOTES.md):
- Module 8 — retrieval, chunking, FAISS. `kb.py` is Module 8's `rag_shared.py` plus one `retrieve()` helper
- Module 5 — conditional routing and capped loops; both graphs here are those two patterns applied to retrieval
- Pydantic `Literal` fields (Module 2)

---

## Module 19 — Project: Self-Correcting Multi-Agent App (Serverless)
Topics:
- Writer + reviewer two-agent capped loop (a separate agent catches more than self-critique)
- Deterministic review criteria checked in Python (word count, banned buzzwords, sentence length) vs. one genuinely LLM-judged criterion
- Specific, actionable feedback injected back into the writer's prompt on retry
- Real engineering story: tuning criteria difficulty across 3 attempts until the loop actually exercised correction
- FastAPI + Docker deployment reused from Module 9; `hit_cap` reported honestly to API callers
- Serverless/timeout considerations: container deploy vs. function timeout limits, cold starts

Prerequisites (from NOTES.md):
- Module 5 / 13 — capped loops; this is that pattern with two different agents instead of one revising itself
- Module 9 — `api.py` and `Dockerfile` reuse its shape almost unchanged
- Module 15 — its lesson ("deterministic beats judgement") directly shaped the reviewer

---

## Module 20 — Advanced RAG II: Agentic RAG *(spec only, not yet built)*
Topics:
- Agent-driven routing before retrieval (direct answer vs. knowledge base vs. web search)
- Migrating from local FAISS to a hosted vector DB (Pinecone free tier)
- Explicit graph: `route(kb|direct) → retrieve_kb → grade_kb → generate / search_web → grade_web → generate / rewrite_query loop`
- `RouteDecision` and `EvidenceGrade` as Pydantic Literal schemas (no string matching)
- Planned pitfalls: embedding-dimension mismatch (384 for MiniLM), async index creation/eventual consistency, chitchat must NOT hit the KB

Prerequisites (inferred): Module 8 — the plan explicitly copies its `.env`/sample PDF and extends its RAG setup to a hosted vector DB.

---

## Module 21 — Forward Deployed Engineering: Roadmap + 2 Projects
Topics:
- FDE skill: scoping a customer problem and writing a case study, not new LangGraph code
- Six-section case study format: customer problem, scoped spec, eval set, build, deploy, measure
- Writing the problem statement in the customer's own words (not as a solution)
- Deliberate scope exclusions ("won't build" list) as the real skill demonstration
- Using Module 16's real before/after eval numbers (88.6% → 99.1%) as the "measure" section's evidence
- Honesty principle: stating an unmet acceptance criterion (no deployed URL) rather than faking one

Prerequisites (from NOTES.md, as a table):
| Needed | Why | Status |
|---|---|---|
| Module 16 (evals) | §6 demands real before/after numbers; without an eval set you'd have to invent them | built |
| Module 14 (the subject) | you need something real to write about | built |
| Module 9 or 19 (deploy) | §5 wants a live URL | container verified, nothing hosted |

Do not attempt this module before Module 16 — §6 is unwriteable without it.

---

## Module 22 — Advanced RAG III: GraphRAG & Multimodal RAG *(spec only, not yet built)*
Topics:
- GraphRAG for multi-hop relationship questions vector search cannot answer (Neo4j Aura + `LLMGraphTransformer` + `GraphCypherQAChain`)
- Multimodal RAG for answers that live only in charts/images (PyMuPDF/fitz extraction + vision-model summaries)
- Mandatory baseline comparison: show plain vector RAG failing/doing worse on the same question for both techniques
- `allowed_nodes`/`allowed_relationships` constraints required for usable graph extraction (unconstrained = garbage graph)
- `verbose=True` on `GraphCypherQAChain` to inspect generated Cypher (never suppress it)
- Planned pitfalls: Groq may lack a vision model (may need Gemini/OpenAI), Neo4j Aura free-tier sleep/TLS scheme (`neo4j+s://`), vector-graphic charts not extracting as images

Prerequisites (inferred): Module 8 (RAG setup — the plan copies its `.env`) and Module 18 (the "plain vector RAG" baseline this module must beat is Module 18's approach).
