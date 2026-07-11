# 🚀 OpenClaw Docker — 2 Minutes

```bash
cd docker/
make setup
make up
```

**Done!** → Open http://localhost:18789

---

## What you need to set

Edit `docker/.env`:

```env
MODEL_PROVIDER=mimo/mimo-pro    # or openai/gpt-4
API_KEY=your-api-key-here       # from opencode or OpenAI
```

Then:

```bash
make setup   # Generates openclaw.json from .env
make up      # Starts OpenClaw
```

---

## Common commands

```bash
make logs       # See what's happening
make restart    # After editing .env
make shell      # SSH into container
make down       # Stop (keep data)
```

---

## That's it!

For details: [docker/README.md](docker/README.md)

For OpenClaw docs: https://docs.openclaw.ai
