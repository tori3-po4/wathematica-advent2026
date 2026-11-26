FROM python:3.12-slim
# copy only the uv binary from the official image
COPY --from=ghcr.io/astral-sh/uv:0.13.10 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /app_root

# install dependencies first to reuse the layer cache (pyproject has package = false)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# copy application code into the image
COPY main.py github.py models.py ./

RUN useradd --create-home bot
USER bot

# --no-sync: the environment is already built above and .venv is owned by root
CMD ["uv", "run", "--no-sync", "main.py"]
