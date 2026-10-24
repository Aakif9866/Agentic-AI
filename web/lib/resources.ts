// Hand-curated per-module metadata. Every YouTube id was checked via oEmbed
// (title + channel) and every article URL returned 200 on 2026-10-24.

export type Kind = "video" | "course" | "docs" | "article" | "paper";
export type Resource = { kind: Kind; title: string; by: string; url: string };

export type TrackId = "foundations" | "langgraph" | "ship" | "multi" | "production" | "rag" | "career";

export const tracks: { id: TrackId; name: string; blurb: string; gradient: string }[] = [
  { id: "foundations", name: "Foundations", blurb: "Python, the agent mental model, and your first LangChain agents.", gradient: "from-sky-400 to-blue-600" },
  { id: "langgraph", name: "LangGraph Core", blurb: "State, nodes, edges — then memory, tools, RAG and human approval.", gradient: "from-violet-400 to-indigo-600" },
  { id: "ship", name: "Ship It", blurb: "Docker, CI/CD, FastAPI — and a full ChatGPT-style capstone.", gradient: "from-emerald-400 to-teal-600" },
  { id: "multi", name: "Multi-Agent Systems", blurb: "Supervisors, MCP servers, subgraphs and guardrails.", gradient: "from-orange-400 to-rose-500" },
  { id: "production", name: "Production Engineering", blurb: "Harnesses, evals, gateways and self-correcting apps.", gradient: "from-pink-400 to-fuchsia-600" },
  { id: "rag", name: "Advanced RAG", blurb: "Corrective, self-reflective, agentic, graph and multimodal retrieval.", gradient: "from-amber-400 to-orange-600" },
  { id: "career", name: "Career", blurb: "Forward Deployed Engineering: scope, build, measure, write it up.", gradient: "from-slate-400 to-slate-700" },
];

const yt = (id: string, title: string, by: string): Resource => ({ kind: "video", title, by, url: `https://www.youtube.com/watch?v=${id}` });
const r = (kind: Kind, title: string, by: string, url: string): Resource => ({ kind, title, by, url });

const lc = (p: string, title: string) => r("docs", title, "LangChain Docs", `https://docs.langchain.com/oss/python/${p}`);
const dlai = (slug: string, title: string) => r("course", title, "DeepLearning.AI", `https://www.deeplearning.ai/short-courses/${slug}/`);

const buildingAgents = r("article", "Building Effective Agents", "Anthropic", "https://www.anthropic.com/engineering/building-effective-agents");
const contextEng = r("article", "Effective Context Engineering for AI Agents", "Anthropic", "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents");
const langgraphCourse = yt("jGg_1h0qzaM", "LangGraph Complete Course for Beginners", "freeCodeCamp.org");
const ragFromScratch = yt("sVcwVQRHIc8", "Learn RAG From Scratch (LangChain engineer)", "freeCodeCamp.org");
const hamelEvals = r("article", "Your AI Product Needs Evals", "Hamel Husain", "https://hamel.dev/blog/posts/evals/");

export type Meta = { track: TrackId; tagline: string; status: "built" | "theory" | "spec"; resources: Resource[] };

export const meta: Record<number, Meta> = {
  0: { track: "foundations", status: "built", tagline: "Just enough Python to read every file in this course.", resources: [
    yt("rfscVS0vtbw", "Learn Python – Full Course for Beginners", "freeCodeCamp.org"),
    yt("kqtD5dpn9C8", "Python for Beginners in 1 Hour", "Programming with Mosh"),
    dlai("ai-python-for-beginners", "AI Python for Beginners"),
    r("docs", "The Official Python Tutorial", "python.org", "https://docs.python.org/3/tutorial/"),
    r("docs", "uv — Python package & project manager", "Astral", "https://docs.astral.sh/uv/"),
  ]},
  1: { track: "foundations", status: "theory", tagline: "From generative AI to agentic AI — the vocabulary for everything after.", resources: [
    yt("zjkBMFhNj_g", "Intro to Large Language Models", "Andrej Karpathy"),
    yt("LPZh9BOjkQs", "Large Language Models Explained Briefly", "3Blue1Brown"),
    yt("F8NKVhkZZWI", "What are AI Agents?", "IBM Technology"),
    yt("sal78ACtGTc", "What’s Next for AI Agentic Workflows", "Andrew Ng · Sequoia"),
    buildingAgents,
    r("article", "LLM Powered Autonomous Agents", "Lilian Weng", "https://lilianweng.github.io/posts/2023-06-23-agent/"),
    r("course", "Hugging Face AI Agents Course", "Hugging Face", "https://huggingface.co/learn/agents-course/unit0/introduction"),
    r("paper", "ReAct: Synergizing Reasoning and Acting in LLMs", "Yao et al.", "https://arxiv.org/abs/2210.03629"),
  ]},
  2: { track: "foundations", status: "built", tagline: "async/await for concurrency, Pydantic as the contract for LLM output.", resources: [
    yt("Qb9s3UiMSTA", "Asyncio in Python – Full Tutorial", "Tech With Tim"),
    yt("Vj-iU-8_xLs", "Pydantic Tutorial", "ArjanCodes"),
    r("docs", "asyncio — Asynchronous I/O", "python.org", "https://docs.python.org/3/library/asyncio.html"),
    r("docs", "Pydantic Documentation", "Pydantic", "https://docs.pydantic.dev/latest/"),
    lc("langchain/structured-output", "Structured Output"),
  ]},
  3: { track: "foundations", status: "built", tagline: "A single tool-using agent, then a Search → Reader → Writer → Critic pipeline.", resources: [
    yt("1bUy-1hGZpI", "What is LangChain?", "IBM Technology"),
    dlai("functions-tools-agents-langchain", "Functions, Tools and Agents with LangChain"),
    lc("langchain/agents", "Agents"),
    lc("langchain/tools", "Tools"),
    r("docs", "Streamlit Documentation", "Streamlit", "https://docs.streamlit.io/"),
  ]},
  4: { track: "langgraph", status: "built", tagline: "State, nodes, edges — chaining, parallel fan-out, routing and loops.", resources: [
    langgraphCourse,
    dlai("ai-agents-in-langgraph", "AI Agents in LangGraph"),
    lc("langgraph/overview", "LangGraph Overview"),
    lc("langgraph/graph-api", "Graph API: State, Nodes & Edges"),
  ]},
  5: { track: "langgraph", status: "built", tagline: "Send, Command, multiway routing, map-reduce and capped refinement.", resources: [
    langgraphCourse,
    yt("JQznvlSatPQ", "LangGraph: Controllability with Map-Reduce", "LangChain"),
    yt("5iYV0q6eKbM", "Map-Reduce with the Send() API", "A.I Engineering BootCamp"),
    lc("langgraph/workflows-agents", "Workflows and Agents"),
    buildingAgents,
  ]},
  6: { track: "langgraph", status: "built", tagline: "Checkpointers, threads, time travel and three streaming modes.", resources: [
    yt("YE6A5d8kNp4", "LangGraph: Persistence", "LangChain"),
    yt("crS0PNjElWo", "Conversation State with Checkpoints & Memory", "Mohamed Naji Aboo"),
    dlai("long-term-agentic-memory-with-langgraph", "Long-Term Agentic Memory with LangGraph"),
    lc("langgraph/persistence", "Persistence & Checkpointers"),
    lc("langgraph/streaming", "Streaming"),
    lc("langchain/short-term-memory", "Short-Term Memory"),
    r("docs", "LangSmith", "LangChain Docs", "https://docs.langchain.com/langsmith/home"),
  ]},
  7: { track: "langgraph", status: "built", tagline: "The chat ⇄ tools loop, parallel calls, trimming context and safe tools.", resources: [
    yt("MoHtLAhoMp4", "Introduction to Tool Use with LangGraph’s ToolNode", "Mohamed Naji Aboo"),
    lc("langchain/tools", "Tools"),
    r("article", "Writing Effective Tools for Agents", "Anthropic", "https://www.anthropic.com/engineering/writing-tools-for-agents"),
    contextEng,
  ]},
  8: { track: "langgraph", status: "built", tagline: "PDF → chunks → FAISS as a tool, plus interrupt() for human approval.", resources: [
    ragFromScratch,
    yt("T-D1OfcDW1M", "What is Retrieval-Augmented Generation (RAG)?", "IBM Technology"),
    dlai("langchain-chat-with-your-data", "LangChain: Chat with Your Data"),
    lc("langchain/rag", "Build a RAG Agent"),
    lc("langgraph/interrupts", "Interrupts (Human-in-the-Loop)"),
    r("article", "Retrieval-Augmented Generation Explained", "Pinecone", "https://www.pinecone.io/learn/retrieval-augmented-generation/"),
    r("paper", "Retrieval-Augmented Generation for Knowledge-Intensive NLP", "Lewis et al.", "https://arxiv.org/abs/2005.11401"),
  ]},
  9: { track: "ship", status: "built", tagline: "Graph vs transport split, FastAPI streaming, Docker, CI and Render.", resources: [
    yt("Gjnup-PuquQ", "Docker in 100 Seconds", "Fireship"),
    yt("fqMOX6JJhGo", "Docker Tutorial for Beginners – Full Course", "freeCodeCamp.org"),
    yt("R8_veQiYBjI", "GitHub Actions Tutorial – CI/CD with Docker", "TechWorld with Nana"),
    yt("0sOvCWFmrtA", "Python API Development (FastAPI) – Full Course", "freeCodeCamp.org"),
    r("docs", "FastAPI Tutorial", "FastAPI", "https://fastapi.tiangolo.com/tutorial/"),
    r("docs", "Docker: Get Started", "Docker", "https://docs.docker.com/get-started/"),
    r("docs", "GitHub Actions", "GitHub Docs", "https://docs.github.com/en/actions"),
    r("docs", "Deploy a FastAPI App", "Render", "https://render.com/docs/deploy-fastapi"),
    r("article", "The Twelve-Factor App", "12factor.net", "https://12factor.net/"),
  ]},
  10: { track: "ship", status: "built", tagline: "Capstone: memory, streaming, tools, RAG and HITL behind one API.", resources: [
    yt("N31YhAPHWA0", "Full-Stack App with LangGraph & Human-in-the-Loop", "Coding Crash Courses"),
    yt("SvAuh1fuw0M", "Streaming Responses in an Agentic Chatbot", "DSwithBappy"),
    lc("langgraph/persistence", "Persistence & Checkpointers"),
    lc("langchain/human-in-the-loop", "Human-in-the-Loop"),
    r("docs", "FastAPI Tutorial", "FastAPI", "https://fastapi.tiangolo.com/tutorial/"),
    buildingAgents,
  ]},
  11: { track: "multi", status: "built", tagline: "A deterministic supervisor routing weather, places and budget specialists.", resources: [
    yt("KAwiykWkQ5Q", "Build a Supervisor Multi-Agent Architecture", "DATA JARVIS"),
    yt("WWcDnUCT52Q", "LangGraph Multi-Agent Supervisor", "Coding Crash Courses"),
    dlai("multi-ai-agent-systems-with-crewai", "Multi AI Agent Systems"),
    lc("langchain/multi-agent", "Multi-Agent Systems"),
    r("article", "How We Built Our Multi-Agent Research System", "Anthropic", "https://www.anthropic.com/engineering/multi-agent-research-system"),
  ]},
  12: { track: "multi", status: "built", tagline: "Tools as a protocol: a FastMCP server and a session-holding client.", resources: [
    yt("7j_NE6Pjv-E", "Model Context Protocol (MCP), Clearly Explained", "Greg Isenberg"),
    dlai("mcp-build-rich-context-ai-apps-with-anthropic", "MCP: Build Rich-Context AI Apps"),
    r("docs", "Introduction to MCP", "modelcontextprotocol.io", "https://modelcontextprotocol.io/docs/getting-started/intro"),
    r("docs", "FastMCP", "gofastmcp.com", "https://gofastmcp.com/getting-started/welcome"),
    lc("langchain/mcp", "MCP in LangChain"),
  ]},
  13: { track: "multi", status: "built", tagline: "A research subgraph nested in a plan → write → edit pipeline.", resources: [
    yt("Z8l7C031xkM", "LangGraph Agents: Controllability with Sub-graphs", "LangChain"),
    yt("4hdYKjQffxM", "Subgraphs: Modular, Reusable Nested Graphs", "Yash Jain"),
    lc("langgraph/use-subgraphs", "Use Subgraphs"),
    lc("langgraph/streaming", "Streaming"),
  ]},
  14: { track: "multi", status: "built", tagline: "Four guardrail layers, cheap → expensive, around a supervisor of tools.", resources: [
    yt("3DfV6URqrZA", "NeMo Guardrails: Tame Your LLM", "Coding Crash Courses"),
    dlai("safe-and-reliable-ai-via-guardrails", "Safe and Reliable AI via Guardrails"),
    lc("langchain/guardrails", "Guardrails"),
    lc("langchain/human-in-the-loop", "Human-in-the-Loop Middleware"),
    r("article", "OWASP Top 10 for LLM Applications", "OWASP", "https://genai.owasp.org/llm-top-10/"),
  ]},
  15: { track: "production", status: "built", tagline: "Most agent failures are harness failures — audit one with evidence.", resources: [
    yt("Jp9_hpys75I", "Building Effective Agents (narrated walkthrough)", "Audio Learn"),
    contextEng,
    buildingAgents,
    r("article", "Writing Effective Tools for Agents", "Anthropic", "https://www.anthropic.com/engineering/writing-tools-for-agents"),
  ]},
  16: { track: "production", status: "built", tagline: "31 cases, LLM-as-judge and five dimensions that gate CI.", resources: [
    yt("_9Rvb46Pbmg", "Evaluating AI Agents: Code, LLMs & Human Feedback", "Data Science Dojo"),
    yt("DBUK_0ZSCD8", "From BLEU to G-Eval: LLM-as-a-Judge Techniques & Limits", "deepsense"),
    dlai("evaluating-ai-agents", "Evaluating AI Agents"),
    hamelEvals,
    r("docs", "LangSmith Evaluation", "LangChain Docs", "https://docs.langchain.com/langsmith/evaluation"),
    r("article", "Patterns for Building LLM-based Systems", "Eugene Yan", "https://eugeneyan.com/writing/llm-patterns/"),
  ]},
  17: { track: "production", status: "built", tagline: "One layer over Groq, DeepSeek and Gemini with measured fallback.", resources: [
    yt("r_ek2Ze99f8", "LLM Gateways Explained (LiteLLM)", "Nidhi Chouhan"),
    r("docs", "LiteLLM (reference gateway)", "LiteLLM", "https://docs.litellm.ai/docs/"),
    r("article", "Patterns of Distributed Systems", "Martin Fowler", "https://martinfowler.com/articles/patterns-of-distributed-systems/"),
  ]},
  18: { track: "rag", status: "built", tagline: "Grade the documents (CRAG), then grade your own answer (Self-RAG).", resources: [
    yt("pbAd8O1Lvm4", "Self-Reflective RAG with LangGraph: Self-RAG and CRAG", "LangChain"),
    yt("E2shqsYwxck", "Building Corrective RAG from Scratch", "LangChain"),
    r("paper", "Self-RAG: Learning to Retrieve, Generate, and Critique", "Asai et al.", "https://arxiv.org/abs/2310.11511"),
    r("paper", "Corrective Retrieval Augmented Generation", "Yan et al.", "https://arxiv.org/abs/2401.15884"),
  ]},
  19: { track: "production", status: "built", tagline: "Writer + reviewer loop with deterministic checks, shipped in a container.", resources: [
    yt("v5ymBTXNqtk", "Reflection Agents", "LangChain"),
    buildingAgents,
    r("docs", "Docker: Get Started", "Docker", "https://docs.docker.com/get-started/"),
    r("docs", "Deploy a FastAPI App", "Render", "https://render.com/docs/deploy-fastapi"),
  ]},
  20: { track: "rag", status: "spec", tagline: "Route first, retrieve from a hosted vector DB, grade, rewrite.", resources: [
    ragFromScratch,
    dlai("building-agentic-rag-with-llamaindex", "Building Agentic RAG"),
    lc("langchain/rag", "Build a RAG Agent"),
    r("docs", "Pinecone Quickstart", "Pinecone", "https://docs.pinecone.io/guides/get-started/quickstart"),
  ]},
  21: { track: "career", status: "theory", tagline: "Scope a customer problem, prove it with evals, write the case study.", resources: [
    yt("Ck-LeYlAVbY", "What is a Forward Deployed Engineer? (with Rippling’s founding FDE)", "Aced (Exponent)"),
    yt("YbeJxi0Ju1A", "What is a Forward Deployed Engineer?", "Caleb Curry"),
    hamelEvals,
    buildingAgents,
  ]},
  22: { track: "rag", status: "spec", tagline: "Multi-hop questions via a knowledge graph; answers hidden in charts.", resources: [
    yt("2o0Q85JUZNk", "Graph RAG Simply Explained", "codebasics"),
    dlai("knowledge-graphs-rag", "Knowledge Graphs for RAG"),
    r("paper", "From Local to Global: A GraphRAG Approach", "Microsoft Research", "https://arxiv.org/abs/2404.16130"),
    r("docs", "GraphRAG", "Microsoft", "https://microsoft.github.io/graphrag/"),
    r("docs", "Neo4j: Getting Started", "Neo4j", "https://neo4j.com/docs/getting-started/"),
    r("docs", "PyMuPDF", "PyMuPDF", "https://pymupdf.readthedocs.io/en/latest/"),
  ]},
};
