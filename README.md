# Velora — Car Rental Website + Local AI Chatbot

A complete car rental site written in plain HTML, CSS and JavaScript (no build step). It includes **Vee**, a customer-service chatbot that can run on a **free AI model on your own computer**.

## Run it

```bash
cd velora
python3 -m http.server 8000
```
Then open <http://localhost:8000>. Opening `index.html` directly also works, but the local AI engines are more reliable when the site is served over `http://`.

Tip: `http://localhost:8000/#chat` opens the site with the chat already open.

## Chatbot engines (settings ⚙️ inside the chat)

| Engine | Setup | Notes |
|---|---|---|
| **Auto** (default) | none | Uses Ollama if it's running, otherwise the built-in engine |
| **Ollama**: local LLM | Install from [ollama.com](https://ollama.com), then run `ollama pull llama3.2` | Free and private, and it streams its answers. Any model works: `qwen2.5`, `mistral`, `phi3`, `gemma2`, … (type the name in settings) |
| **In-browser AI** (WebLLM) | none | Downloads Llama-3.2-1B (~900 MB) into the browser once. Needs desktop Chrome or Edge with WebGPU |
| **Built-in** | none | Instant and offline. Understands rule-based intents and entities (cars, days, dates, age, group size, budget, location) |

**How the answers stay accurate:** every engine reads the same knowledge base in `js/data.js`. Before an LLM answers, the built-in analyzer works out the exact quotes and recommendations and adds them to the prompt. This keeps small local models from making up prices. Booking requests ("book the Tesla for 5 days") are handled directly: the chatbot opens the reservation form with your details filled in.

If Ollama blocks requests from your origin (CORS), start it with
`OLLAMA_ORIGINS="*" ollama serve`.

**On a public host (e.g. GitHub Pages):** Auto mode does not check for Ollama there, because doing so would make Chrome show visitors a "local network access" prompt. Visitors get the built-in assistant, or the in-browser AI if they turn it on. Ollama runs on *your* computer, so it can't answer *other people's* visitors. Serving an LLM to the public needs a hosted model behind a server endpoint.

## Files

```
index.html        page layout: hero, booking bar, fleet, how-it-works, locations, reviews, FAQ, modals, chat widget
css/styles.css    all styling (responsive, reduced-motion aware)
js/data.js        ★ business knowledge base + pricing engine (edit prices, cars, policies here)
js/app.js         fleet filters, search, live quotes, reservation flow, "Manage booking"
js/chatbot.js     Vee: UI, NLU, built-in answers, Ollama + WebLLM streaming
assets/           SVG logo and favicon, car photos (Unsplash)
```

## Customize

- **Your business:** edit `js/data.js`. The fleet cards, FAQ, price quotes and the AI's knowledge all update from that file.
- **Brand colours and fonts:** change the CSS variables at the top of `css/styles.css` (`--accent`, `--ink`, …).
- **Photos:** replace the files in `assets/img/` and keep the same names, or update the `img` paths in `data.js`.

## Demo notes

- Bookings are saved in the browser's `localStorage`. A real deployment needs a backend for payments, inventory and email.
- Car availability is simulated.
- The company name, phone numbers and addresses are fictional.
- Photos are from [Unsplash](https://unsplash.com) (free to use under the Unsplash License).
