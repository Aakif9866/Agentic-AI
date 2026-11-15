FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

# Build faiss_db/ inside the image (.dockerignore keeps the local one out), so
# search_docs works on the server. This also downloads and keeps the ~90MB embedding
# model, so a cold container doesn't download it on the first request.
# The dummy Tavily key only satisfies tools.py's import-time client; it is not
# saved in the image and the real key comes from the host's env vars.
RUN TAVILY_API_KEY=build-placeholder uv run --no-sync python ingest.py sample_notes.pdf

# The public app is the Streamlit UI (health check path: /_stcore/health).
# To serve the JSON API instead, run: uvicorn api:app --host 0.0.0.0 --port ${PORT}
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uv run --no-sync streamlit run ui_streamlit.py --server.address 0.0.0.0 --server.port ${PORT}"]
