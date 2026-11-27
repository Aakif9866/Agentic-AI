from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import AIMessageChunk
from langgraph.types import Command

from auth import check_login, make_token, verify_token
from backend import agent, checkpointer, pending_approval, run_config

app = FastAPI(title="ChatGPT-style Agent (Modules 6-9 combined)")


def require_token(authorization: str = Header(default="")) -> None:
    """Every route except /login and /health needs `Authorization: Bearer <token>`."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not verify_token(token):
        raise HTTPException(401, "missing, invalid or expired token")


class LoginIn(BaseModel):
    username: str
    password: str


class ChatIn(BaseModel):
    thread_id: str
    message: str


class ApproveIn(BaseModel):
    thread_id: str
    approved: bool
    edited_body: str | None = None


@app.post("/login")
def login(body: LoginIn):
    if not check_login(body.username, body.password):
        raise HTTPException(401, "wrong username or password")
    return {"token": make_token()}


@app.post("/chat", dependencies=[Depends(require_token)])
def chat(body: ChatIn):
    # recursion_limit was missing entirely before Module 15's audit — a runaway
    # chat->tools->chat loop had no app-level ceiling.
    cfg = run_config(body.thread_id)

    def token_stream():
        for chunk, _meta in agent.stream(
            {"messages": [("user", body.message)]}, cfg, stream_mode="messages"
        ):
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                yield chunk.content

    return StreamingResponse(token_stream(), media_type="text/plain")


@app.get("/pending/{thread_id}", dependencies=[Depends(require_token)])
def pending(thread_id: str):
    """Poll this to find out whether the agent is waiting on a human."""
    return {"pending": pending_approval(thread_id)}


@app.post("/approve", dependencies=[Depends(require_token)])
def approve(body: ApproveIn):
    """Resume a paused thread. edited_body lets the human change the draft first."""
    cfg = run_config(body.thread_id, "approval")
    resume_value: dict = {"approved": body.approved}
    if body.edited_body:
        resume_value["edited_body"] = body.edited_body
    result = agent.invoke(Command(resume=resume_value), cfg)
    return {"final_message": result["messages"][-1].content}


@app.delete("/threads/{thread_id}", dependencies=[Depends(require_token)])
def delete_thread(thread_id: str):
    """Delete a conversation and all its checkpoints."""
    checkpointer.delete_thread(thread_id)
    return {"deleted": thread_id}


@app.get("/health")
def health():
    return {"ok": True}
