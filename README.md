# Balulu

Balulu is a student focus-coach prototype for spotting time leaks, protecting study blocks, and deciding what to work on next with Balu.

## Run it

Install [Ollama](https://ollama.com), then download the model once:

```powershell
ollama pull llama3.2
```

Start Ollama so its local API is available at `http://localhost:11434`, then open `index.html` in a modern browser. The chat connects directly to Ollama from the page; no app server, API key, build step, or package installation is needed. If the chat cannot connect, make sure Ollama is running.

## Prototype features

- Today dashboard with sample focus totals, weekly rhythm, and a sample distraction breakdown.
- Focus room with a 25-minute timer, pause/reset controls, and a gentle in-app check-in after 18 seconds for demo purposes.
- Balu chat powered by the local `llama3.2:latest` Ollama model, with recent conversation context and current task status.
- Responsive navigation, task completion controls, and a manual distraction check-in.

## Important boundaries

Balulu does not monitor apps, browser activity, or device usage. The distraction metrics are sample data, and check-ins appear only inside the open page. It does not send push notifications or provide medical or academic guarantees.

Chat messages are sent to the Ollama service running on your own computer; this prototype does not send them to a hosted AI provider.