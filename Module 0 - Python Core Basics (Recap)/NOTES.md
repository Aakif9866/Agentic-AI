# Module 0 — Python Core Basics (Recap)

One notebook: the core syntax every later module assumes you already read comfortably — variables, control flow, collections, functions, a minimal class, imports. Not a full Python course. If every cell in [`python_basics.ipynb`](./python_basics.ipynb) is already obvious, skip straight to Module 1.

## Why this module exists

Module 2's own prerequisite line says: *"Functions, dicts, classes, imports. That's it."* This module is that baseline, spelled out, for anyone starting from zero before Module 1.

## Prerequisites

None. This is the starting point — before Module 1.

## Setup and run

```bash
uv init --no-readme --name module0-python --python 3.12
uv add ipykernel
uv run jupyter lab      # or open the .ipynb in VS Code
```

No API key needed — pure Python, nothing external.

## What's covered

In order, in `python_basics.ipynb`:

variables & types → operators → strings → `list`/`tuple`/`dict`/`set` → `if`/`elif`/`else` → `for`/`while` loops → functions (defaults, `*args`/`**kwargs`) → a minimal class (`__init__`, `self`, one method) → imports.

## Next

Module 1 for the course's vocabulary, then Module 2 for async + Pydantic.
