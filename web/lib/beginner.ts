// Beginner layer shown at the top of every module page: what the module is about
// in plain English (with an everyday analogy), plus the handful of words you need.

export type Beginner = { plain: string; terms: [string, string][] };

export const beginner: Record<number, Beginner> = {
  0: {
    plain:
      "Every file in this course is Python, so this is the reading kit. You don't need to be a programmer — you need to recognise the shapes: a variable is a labelled box, a list is a row of boxes, a dict is a set of labelled drawers, and a function is a recipe you can reuse. If you can read those, you can follow every later module.",
    terms: [
      ["Variable", "A name that points at a value, like price = 10."],
      ["dict", "Key → value pairs, e.g. {\"city\": \"Paris\"}. Agent state is almost always a dict."],
      ["Function", "A named, reusable block of code that takes inputs and returns an output."],
      ["Class", "A blueprint for objects that bundle data and functions together."],
      ["import", "Pulls code from another file or library into yours."],
    ],
  },
  1: {
    plain:
      "No code here — just the words. A plain chatbot is like a very well-read friend who can only talk. An agent is that friend with a phone and a to-do list: it can look things up, use tools, and keep going until a job is done. \"Agentic AI\" is a team of those working together, with memory and someone checking their work.",
    terms: [
      ["LLM", "Large Language Model — the \"brain\" that predicts text (GPT, Llama, Claude…)."],
      ["Agent", "An LLM in a loop: think → act (use a tool) → look at the result → think again."],
      ["Tool", "A function the model is allowed to call, like web search or a calculator."],
      ["Memory", "What the agent remembers between steps or between conversations."],
      ["HITL", "Human-in-the-loop: the agent pauses and asks a person before risky actions."],
    ],
  },
  2: {
    plain:
      "Two Python skills agents lean on. async lets your program wait for many slow things at once — like a waiter taking several tables' orders instead of standing at one table until the food arrives. Pydantic is a strict form: you describe the exact shape of data you expect, and it rejects anything that doesn't fit. That is how we force an LLM to answer in a usable format.",
    terms: [
      ["async / await", "Mark code that waits (network, APIs) so other work can run meanwhile."],
      ["asyncio.gather", "Run several async tasks at the same time and collect all results."],
      ["BaseModel", "A Pydantic class describing the fields and types your data must have."],
      ["ValidationError", "What Pydantic raises when data doesn't match the model."],
      ["Structured output", "Making an LLM return data that fits a schema instead of free text."],
    ],
  },
  3: {
    plain:
      "Your first real agents, built with LangChain. One agent gets tools (like web search) and decides when to use them. Then four agents work like a newsroom: a searcher finds sources, a reader digests them, a writer drafts, and a critic reviews. Notice how the flow lives in ordinary Python — that's the mess LangGraph cleans up next.",
    terms: [
      ["LangChain", "A Python library with building blocks for LLM apps: models, tools, prompts."],
      ["create_agent", "LangChain's one-liner that wraps a model + tools into a working agent."],
      ["Tavily", "A web-search API built for agents; used as the search tool here."],
      ["Pipeline", "Several steps run in order, each feeding the next."],
      ["Streamlit", "A quick way to put a web UI on a Python script."],
    ],
  },
  4: {
    plain:
      "LangGraph turns an AI workflow into a flowchart you can run. Each box is a node (a plain Python function), the arrows are edges, and a shared notebook called state is passed from box to box. Once you see that, chaining steps, running them in parallel, choosing a branch, or looping until something is good enough are all just different arrow shapes.",
    terms: [
      ["State", "The shared dict every node reads from and writes to."],
      ["Node", "A function that takes the state and returns only the keys it changed."],
      ["Edge", "An arrow saying which node runs next."],
      ["Conditional edge", "An arrow that picks the next node based on the state."],
      ["Reducer", "A rule for merging updates, e.g. add to a list instead of overwriting it."],
    ],
  },
  5: {
    plain:
      "The power-tool patterns. Sometimes you don't know in advance how many parallel jobs you need — like splitting a stack of essays among however many graders turn up. Send handles that. Command lets a node update the state and choose where to go next in one move. And a refinement loop keeps improving an answer, with two safety caps so it can never run forever.",
    terms: [
      ["Send", "Start a dynamic number of parallel branches at run time."],
      ["Command", "Return a state update and the next node to go to, together."],
      ["Map-reduce", "Split work into pieces (map), then combine the results (reduce)."],
      ["recursion_limit", "LangGraph's hard cap on steps — a backstop against infinite loops."],
      ["json_mode", "Asking the model to reply in pure JSON so it can be parsed reliably."],
    ],
  },
  6: {
    plain:
      "A chatbot that remembers. A checkpointer is like a save-game: after every step the conversation is saved, so the bot can pick up where it left off. A thread is one save slot — different users or chats get different slots. Streaming shows the answer word by word as it's written instead of making you stare at a spinner.",
    terms: [
      ["Checkpointer", "Saves the graph's state after every step (in memory or SQLite)."],
      ["thread_id", "The ID of one conversation; same ID = same memory."],
      ["Streaming", "Sending output as it's produced (tokens, or per-node updates)."],
      ["Time travel", "Going back to an earlier saved state and replaying from there."],
      ["LangSmith", "A dashboard that records every step and call so you can debug runs."],
    ],
  },
  7: {
    plain:
      "How an agent actually uses tools. The model doesn't run anything itself — it writes a request like \"call weather with city=Paris\". The graph runs that tool, hands the result back, and the model decides what to do next. That chat ⇄ tools loop is the heart of almost every agent. You also learn to keep the conversation short enough to fit, and to make tools that fail politely.",
    terms: [
      ["Tool call", "The model's structured request to run a specific function with arguments."],
      ["ToolNode", "A ready-made LangGraph node that executes whatever tools the model asked for."],
      ["tools_condition", "Routes to the tools if the model asked for one, otherwise ends."],
      ["Docstring", "The tool's description — the model reads it to decide when to use the tool."],
      ["trim_messages", "Drops old messages so the conversation fits the model's context window."],
    ],
  },
  8: {
    plain:
      "Two big ideas. RAG is an open-book exam: instead of answering from memory, the agent first looks up the relevant pages in your documents and answers from those. Human-in-the-loop is a manager's sign-off: before something risky (like buying stock), the agent pauses, asks a person, and only continues once they approve.",
    terms: [
      ["RAG", "Retrieval-Augmented Generation — fetch relevant text first, then answer from it."],
      ["Chunk", "A small piece of a document; documents are split so search can find the right bit."],
      ["Embedding", "A list of numbers capturing a text's meaning, so similar texts sit close together."],
      ["FAISS", "A fast local index for finding the closest embeddings."],
      ["interrupt()", "Pauses the graph and waits for a human; Command(resume=…) continues it."],
    ],
  },
  9: {
    plain:
      "Getting your agent off your laptop. You wrap it in a web API (FastAPI) so anything can talk to it, pack it in a Docker container — a lunchbox holding the app and everything it needs, so it runs the same anywhere — then let GitHub Actions test it automatically on every push, and deploy it to Render so it has a real URL.",
    terms: [
      ["API", "A URL your program answers, so other apps can use your agent."],
      ["FastAPI", "A Python framework for building APIs quickly."],
      ["Docker", "Packages an app + its dependencies into an image that runs identically anywhere."],
      ["CI/CD", "Automatic test (CI) and release (CD) on every code change."],
      ["Render", "A hosting service that runs your container on the internet."],
    ],
  },
  10: {
    plain:
      "The capstone: your own mini ChatGPT. It combines everything from Modules 6–9 — memory, streaming, tools, document search and human approval — behind one API. Think of it as assembling a car from parts you've already built one by one: the graph is the engine, tools are the wheels, and the API is the dashboard.",
    terms: [
      ["Capstone", "A project that combines everything learned so far."],
      ["backend.py", "Where the graph lives — no web code."],
      ["api.py", "The web layer that exposes the graph over HTTP."],
      ["ingest.py", "A one-off script that loads your PDFs into the search index."],
      ["Approve endpoint", "The URL a person hits to approve a paused action."],
    ],
  },
  11: {
    plain:
      "Several specialist agents, one boss. Like a travel agency: one person checks the weather, another finds places to visit, another works out the budget, and a supervisor decides who goes next and stitches it into an itinerary. A key lesson: let the model choose what to do, but let plain Python do the maths.",
    terms: [
      ["Multi-agent", "Several agents, each with one job, working together."],
      ["Supervisor", "The coordinator that routes work to the right specialist."],
      ["Specialist", "An agent focused on one task (weather, places, budget)."],
      ["Graceful degradation", "If one service is missing, fall back instead of crashing."],
      ["Deterministic", "Same input, same output, every time — plain code, not an LLM."],
    ],
  },
  12: {
    plain:
      "MCP is a USB port for AI tools. Instead of wiring every tool into every app by hand, you build a tool once as an MCP server, and any MCP-aware app — your LangGraph agent, Claude Desktop, Cursor — can plug into it. You build a small notes server and a client that talks to it, and learn why keeping one connection open matters.",
    terms: [
      ["MCP", "Model Context Protocol — a standard way for AI apps to talk to tools and data."],
      ["MCP server", "A program that offers tools over MCP."],
      ["MCP client", "The app (your agent) that connects to servers and uses their tools."],
      ["FastMCP", "A Python library that turns functions into an MCP server with a decorator."],
      ["Session", "One open connection; reopening it each call loses the server's memory."],
    ],
  },
  13: {
    plain:
      "Graphs inside graphs. A subgraph is like a department inside a company: the research team has its own internal process, but to the rest of the company it's one box that takes a question and returns findings. Here a research subgraph sits inside a plan → write → edit pipeline, and an editor can send drafts back for revision.",
    terms: [
      ["Subgraph", "A complete compiled graph used as a single node in a bigger graph."],
      ["Parent graph", "The outer graph that calls the subgraph."],
      ["State mapping", "Translating between the parent's state and the subgraph's own state."],
      ["Revision loop", "Write → edit → maybe rewrite, with a cap on rounds."],
      ["stream_mode=\"updates\"", "Watch progress one node at a time."],
    ],
  },
  14: {
    plain:
      "Guardrails are the safety checks around an agent — like airport security in layers. Cheap, fast checks run first (does the message look like an attack?), then personal data gets hidden, then a human approves risky actions, and finally the answer is checked before it goes out. You also test the guards with deliberate attacks to prove they work.",
    terms: [
      ["Guardrail", "A check that blocks or fixes unsafe input or output."],
      ["Prompt injection", "Text that tries to trick the model into ignoring its instructions."],
      ["PII", "Personally identifiable info — emails, phone numbers, card numbers."],
      ["Middleware", "Code that runs before/after each model call, wrapping the agent."],
      ["Red-team test", "Attacking your own system on purpose to find holes."],
    ],
  },
  15: {
    plain:
      "Most agent failures aren't the model being dumb — they're the harness: everything around the model, like the prompt, the tools, the loop and its limits. Think of the model as a horse and the harness as the reins and saddle. Here you audit Module 10 with an 8-point checklist, find its weakest spot (no spending limit), and fix it.",
    terms: [
      ["Harness", "Everything around the model: prompts, tools, loop, limits, logging."],
      ["Loop engineering", "Deciding how and when an agent stops."],
      ["Audit", "A structured check of a system against a list, with evidence."],
      ["Budget", "A hard cap on calls, tokens or money per conversation."],
      ["Observability", "Being able to see what the agent did and why."],
    ],
  },
  16: {
    plain:
      "Evals are exams for your agent. AI answers vary every run, so you can't check for one exact string — instead you check properties: did it pick the right tool, refuse the dangerous request, answer correctly, stay fast? For fuzzy answers another LLM acts as the grader. Run the exam in CI and you'll know the moment a change makes things worse.",
    terms: [
      ["Eval", "A repeatable test that scores an AI system's behaviour."],
      ["Dataset", "The list of test cases (inputs + what a good result looks like)."],
      ["LLM-as-judge", "Using an LLM to grade answers that have no single correct string."],
      ["Trajectory", "The sequence of steps and tool calls the agent took."],
      ["Regression", "Something that used to work and now doesn't."],
    ],
  },
  17: {
    plain:
      "A gateway is a universal travel adapter for AI providers. Your code talks to one layer; behind it are several providers (Groq, DeepSeek, Gemini). If one is down or out of credit, the gateway quietly tries the next — cheapest first — and logs which one actually answered.",
    terms: [
      ["Provider", "A company serving models through an API (Groq, OpenAI, Google…)."],
      ["Gateway", "One layer in front of many providers that handles routing and failures."],
      ["Fallback", "Trying the next provider when one fails."],
      ["Transient error", "A temporary failure (rate limit, timeout) — worth retrying."],
      ["Permanent error", "A failure that won't fix itself (bad key, no credit) — move on."],
    ],
  },
  18: {
    plain:
      "RAG that checks its own homework. Corrective RAG grades the documents it found — if they're off-topic it searches again or looks elsewhere. Self-RAG grades its own answer — is every claim supported by the sources, and does it actually answer the question? If no good answer exists, it honestly says \"I don't know\" instead of guessing.",
    terms: [
      ["CRAG", "Corrective RAG — grade retrieved documents before using them."],
      ["Self-RAG", "Grade the generated answer for support and usefulness."],
      ["Grounded", "Every claim in the answer is backed by the retrieved text."],
      ["Query rewrite", "Rephrasing the question to get better search results."],
      ["Hallucination", "A confident answer that isn't supported by any source."],
    ],
  },
  19: {
    plain:
      "Two agents that improve each other's work: a writer drafts, a reviewer checks it against clear rules (length, banned buzzwords, sentence length) and sends specific feedback, and the writer tries again — up to a cap. A separate reviewer catches more than an agent reviewing itself. Then it's shipped in a container, reusing Module 9.",
    terms: [
      ["Writer / reviewer", "Two-agent loop: one produces, one critiques."],
      ["Deterministic check", "A rule checked in plain Python, not by an LLM."],
      ["Feedback", "Specific, actionable notes passed back to the writer."],
      ["hit_cap", "Flag saying the loop stopped because it reached the max rounds."],
      ["Serverless", "Hosting where you don't manage servers; usually has time limits."],
    ],
  },
  20: {
    plain:
      "Agentic RAG lets the agent decide how to find an answer. Like a good librarian: for small talk, just answer; for questions about your documents, search the knowledge base; for current events, search the web. It grades what it found and rewrites the question if the results are poor. (This module is a build spec — the plan, not finished code.)",
    terms: [
      ["Router", "The first step that decides which path a question takes."],
      ["Vector database", "A hosted store for embeddings (here Pinecone) instead of a local file."],
      ["Evidence grade", "A yes/no judgement on whether retrieved text answers the question."],
      ["Build spec", "A detailed plan for something not built yet."],
      ["Dimension", "The length of an embedding vector; must match the index (384 for MiniLM)."],
    ],
  },
  21: {
    plain:
      "Not a coding module — a career one. A Forward Deployed Engineer works directly with a customer: understands their real problem in their own words, scopes what to build (and what not to), proves it works with evals, ships it and measures the result. You write that up as a case study using the real numbers from earlier modules.",
    terms: [
      ["FDE", "Forward Deployed Engineer — an engineer embedded with customers."],
      ["Scope", "What you will build — and, just as important, what you won't."],
      ["Case study", "A write-up of problem → solution → measured result."],
      ["Acceptance criteria", "The checks that decide whether the job is done."],
      ["Before/after", "Numbers showing the improvement your work made."],
    ],
  },
  22: {
    plain:
      "Two kinds of questions normal RAG can't answer. Some need connecting facts — \"which supplier of our biggest customer is also a competitor?\" — so you store knowledge as a graph of things and relationships and walk it. Others have answers hidden in charts and images, so a vision model describes them first. (This module is a build spec — the plan, not finished code.)",
    terms: [
      ["Knowledge graph", "Facts stored as entities (nodes) and relationships (edges)."],
      ["GraphRAG", "Retrieval that follows relationships in a knowledge graph."],
      ["Multi-hop", "A question needing several connected facts to answer."],
      ["Cypher", "The query language of the Neo4j graph database."],
      ["Multimodal", "Working with more than text — images, charts, audio."],
    ],
  },
};
