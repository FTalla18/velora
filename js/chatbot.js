/* =========================================================
   Vee — Velora's AI concierge
   ---------------------------------------------------------
   Three interchangeable engines, all free and local:
     1. Ollama   – a model running on this computer (http://localhost:11434)
     2. WebLLM   – an open model downloaded into the browser (WebGPU)
     3. Built-in – an offline, rule-based assistant (always available)
   "Auto" uses Ollama when it's running and falls back to Built-in.

   Every engine is grounded in js/data.js. Before an LLM answers,
   the built-in analyzer pre-computes exact quotes/recommendations
   and passes them to the model so small models don't invent prices.
   ========================================================= */
(function () {
  const V = window.VELORA;
  const P = V.policies;
  const money = V.money;
  const $ = (s) => document.querySelector(s);

  const CONFIG = {
    ollamaUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    webllmModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    webllmCdn: "https://esm.run/@mlc-ai/web-llm",
    maxHistory: 12, // messages sent to the LLM
  };
  // Only auto-probe localhost when the site itself runs locally. On a public host
  // (e.g. GitHub Pages) probing would trigger Chrome's "local network access" prompt.
  const IS_LOCAL_SITE = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
  const STORE = { chat: "velora.chat.v1", settings: "velora.chat.settings" };

  /* =======================================================
     Utilities
     ======================================================= */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  /** Tiny, safe markdown: **bold**, *italic*, `code`, [links](url), lists, paragraphs. */
  function md(src) {
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[\w-]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const out = [];
    let list = null;
    for (const raw of src.split("\n")) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      if (ul || ol) {
        const tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { if (list) out.push(`</${list.tag}>`); list = { tag }; out.push(`<${tag}>`); }
        out.push(`<li>${inline((ul || ol)[1])}</li>`);
        continue;
      }
      if (list) { out.push(`</${list.tag}>`); list = null; }
      const h = line.match(/^#{1,6}\s+(.*)/);
      if (h) out.push(`<p><strong>${inline(h[1])}</strong></p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list.tag}>`);
    return out.join("");
  }

  /* =======================================================
     Knowledge → system prompt (for LLM engines)
     ======================================================= */
  function buildSystemPrompt() {
    const fleet = V.fleet.map((c) => `- ${c.name} (${c.category}): $${c.price}/day, ${c.seats} seats, ${c.bags} bags, ${c.fuel}, ${c.mpg}, minimum driver age ${c.minAge}. ${c.blurb}`).join("\n");
    const locs = V.locations.map((l) => `- ${l.name} — ${l.address}. Hours: ${l.hours}.`).join("\n");
    const prot = V.protection.map((p) => `- ${p.name}: ${p.price ? "$" + p.price + "/day" : "included"} — ${p.desc}`).join("\n");
    const extras = V.extras.map((e) => `- ${e.name}: $${e.price}${e.unit === "day" ? "/day" : " per rental"}${e.cap ? ` (max $${e.cap})` : ""}${e.note ? ". " + e.note : ""}`).join("\n");
    const pol = Object.entries(P).map(([k, v]) => `- ${k}: ${v}`).join("\n");
    const pr = V.pricing;
    return `You are Vee, the friendly AI concierge for ${V.company.name}, a car rental company in Florida (Tampa, Orlando, Miami).
Your job: help prospective customers choose a car and answer questions about prices and policies.

RULES
- Use ONLY the facts below. Never invent cars, prices, fees, locations or policies.
- If something isn't covered, say you're not sure and offer ${V.company.phone} or ${V.company.email}.
- If a message contains "[Velora system data]", treat those numbers as exact and use them.
- Be warm, upbeat and concise: 2–5 sentences or a short bullet list. Use **bold** for car names and prices.
- When it fits, encourage booking: "tap Reserve on the car card" or "use the Book now form".
- Today's date is ${new Date().toDateString()}.

FLEET
${fleet}

PRICING
- Weekly (7+ days) discount ${pr.weeklyDiscount * 100}%, monthly (28+ days) ${pr.monthlyDiscount * 100}%.
- Young driver fee (ages 21–24): $${pr.youngDriverFeePerDay}/day. Under 21 cannot rent.
- One-way fee between locations: $${pr.oneWayFee}. Delivery: $${pr.deliveryFee} each way.
- Airport pickups add a 10% concession fee; FL surcharge $${pr.surchargePerDay}/day; sales tax ${pr.taxRate * 100}%.
- Promo codes: ${V.promos.map((p) => `${p.code} (${p.desc})`).join("; ")}.

PROTECTION
${prot}

EXTRAS
${extras}

POLICIES
${pol}

LOCATIONS
${locs}

CONTACT
Phone ${V.company.phone}, WhatsApp ${V.company.whatsapp}, email ${V.company.email}. ${V.company.supportHours}`;
  }

  /* =======================================================
     Built-in analyzer (NLU) — entities + intents
     ======================================================= */
  const CAR_ALIASES = {
    "fiat-500": [/\bfiat\b/, /\b500\b(?!\s*(mi|mile))/],
    "vw-polo": [/\bpolo\b/, /\bvw\b/, /volkswagen/],
    "toyota-camry": [/camry/, /toyota/],
    "tesla-model-3": [/tesla/, /model\s*3/],
    "honda-crv": [/cr-?v\b/, /\bhonda\b/],
    "ford-expedition": [/expedition/],
    "bmw-m5": [/\bbmw\b/, /\bm5\b/],
    "ford-mustang": [/mustang/],
    "porsche-panamera": [/porsche/, /panamera/],
  };
  const CATEGORY_ALIASES = [
    ["Economy", /\beconomy\b|\bsmall(est)? car\b/],
    ["Compact", /\bcompact\b/],
    ["Midsize Sedan", /\bsedan|midsize|mid-size\b/],
    ["Electric", /\belectric\b|\bev\b|\bevs\b|plug-?in|tesla/],
    ["SUV", /\bsuvs?\b|crossover/],
    ["Full-size SUV", /full-?size|7[ -]seat|8[ -]seat|seven seat|eight seat|minivan|\bvan\b|third row|3rd row/],
    ["Luxury", /\bluxury|premium|executive|fancy|upscale\b/],
    ["Sports", /\bsports?( car)?\b|muscle|convertible|fast car/],
    ["Exotic", /\bexotic|supercar|wedding|prom\b/],
  ];
  const LOCATION_ALIASES = [
    ["dtt", /downtown/],
    ["tpa", /\btpa\b|\btampa\b/],
    ["mco", /\bmco\b|orlando|disney|universal/],
    ["mia", /\bmia\b|miami|south beach/],
  ];
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  function parseDates(t) {
    const now = new Date(); now.setHours(12, 0, 0, 0);
    const found = [];
    const mk = (m, d) => {
      const dt = new Date(now.getFullYear(), m, d, 12);
      if (dt < addDays(now, -1)) dt.setFullYear(dt.getFullYear() + 1);
      return dt;
    };
    let m;
    const reMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/g;
    while ((m = reMonth.exec(t))) found.push({ i: m.index, d: mk(MONTHS.indexOf(m[1].slice(0, 3)), +m[2]) });
    const reDayMonth = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g;
    while ((m = reDayMonth.exec(t))) found.push({ i: m.index, d: mk(MONTHS.indexOf(m[2]), +m[1]) });
    const reSlash = /\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g;
    while ((m = reSlash.exec(t))) if (+m[1] <= 12) found.push({ i: m.index, d: mk(+m[1] - 1, +m[2]) });
    if (/\btoday\b/.test(t)) found.push({ i: t.indexOf("today"), d: now });
    if (/\btomorrow\b/.test(t)) found.push({ i: t.indexOf("tomorrow"), d: addDays(now, 1) });
    found.sort((a, b) => a.i - b.i);
    return found.map((f) => f.d);
  }

  function analyze(text, ctx) {
    const t = " " + text.toLowerCase().replace(/[’']/g, "'") + " ";
    const e = {};

    e.cars = Object.entries(CAR_ALIASES).filter(([, res]) => res.some((r) => r.test(t))).map(([id]) => id);
    e.category = (CATEGORY_ALIASES.find(([, r]) => r.test(t)) || [])[0];
    e.location = (LOCATION_ALIASES.find(([, r]) => r.test(t)) || [])[0];

    let m;
    if ((m = t.match(/(\d+)\s*(?:days?|nights?)\b/))) e.days = +m[1];
    else if ((m = t.match(/(\d+)\s*weeks?\b/))) e.days = +m[1] * 7;
    else if ((m = t.match(/(\d+)\s*months?\b/))) e.days = +m[1] * 30;
    else if (/\b(a|one|1) week|\bweekly\b|\bweek\b/.test(t)) e.days = 7;
    else if (/\b(a|one) month|\bmonthly\b/.test(t)) e.days = 30;
    else if (/\bweekend\b/.test(t)) e.days = 3;
    else if (/\b(a|one) day\b|\bdaily\b/.test(t)) e.days = 1;

    const dates = parseDates(t);
    if (dates.length) {
      e.start = isoDate(dates[0]);
      if (dates[1] && dates[1] > dates[0]) e.days = Math.round((dates[1] - dates[0]) / 86400000);
      if (e.days) e.end = isoDate(addDays(dates[0], e.days));
    }

    if ((m = t.match(/(?:i'?m|i am|age(?:d)?|aged)\s*(\d{2})\b/)) || (m = t.match(/\b(\d{2})\s*(?:years?|yrs?)\s*old\b|\b(\d{2})\s*yo\b/))) e.age = +(m[1] || m[2]);
    else if (/under\s*25|younger than 25/.test(t)) e.age = 23;
    else if (/under\s*21|younger than 21|teen/.test(t)) e.age = 19;

    if ((m = t.match(/(\d+)\s*(?:people|persons?|passengers?|adults|of us|travell?ers|guests|pax|seats?)/)) || (m = t.match(/family of\s*(\d+)/)) || (m = t.match(/group of\s*(\d+)/))) e.people = +m[1];
    if ((m = t.match(/(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|up to)\s*\$?\s*(\d{2,3})/)) || (m = t.match(/\$\s*(\d{2,3})\s*(?:\/|a|per)\s*day/))) e.budget = +m[1];
    e.cheap = /cheap|cheapest|budget|afford|lowest|inexpensive|least expensive|save money|economical/.test(t);

    // intents: score = number of matching patterns
    const scored = INTENTS.map((it) => ({ it, score: it.kw.reduce((s, r) => s + (r.test(t) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.it.priority || 9) - (b.it.priority || 9));

    // remember context
    if (e.cars.length) ctx.car = e.cars[0];
    ["days", "age", "location", "start"].forEach((k) => { if (e[k] != null) ctx[k] = e[k]; });
    if (e.end) ctx.end = e.end;

    return { t, e, intents: scored.map((x) => x.it.id), scored };
  }

  /* =======================================================
     Built-in responses
     ======================================================= */
  const carById = (id) => V.fleet.find((c) => c.id === id);
  const carLine = (c) => `**${c.name}** (${c.category}) — **$${c.price}/day**, ${c.seats} seats, ${c.bags} bag${c.bags > 1 ? "s" : ""}, ${c.mpg}`;

  function recommend(e, ctx) {
    let list = V.fleet.slice();
    const age = e.age ?? ctx.age;
    if (e.people) list = list.filter((c) => c.seats >= e.people);
    if (age) list = list.filter((c) => c.minAge <= age);
    if (e.budget) list = list.filter((c) => c.price <= e.budget);
    if (/cheaper|less expensive/.test(e.raw) && ctx.car) list = list.filter((c) => c.price < carById(ctx.car).price);
    if (e.category) {
      const inCat = list.filter((c) => c.category === e.category || (e.category === "SUV" && /SUV/.test(c.category)));
      if (inCat.length) list = inCat;
    }
    const score = (c) => c.tags.reduce((s, tag) => s + (e.raw.includes(tag) ? 2 : 0), 0);
    list.sort((a, b) => (e.cheap ? a.price - b.price : score(b) - score(a) || a.price - b.price));
    return list.slice(0, 3);
  }

  function quoteText(carId, ctx) {
    const days = ctx.days || 3;
    const search = window.VeloraApp ? window.VeloraApp.getSearch() : { pickup: "tpa" };
    const q = V.quote({ carId, days, pickupId: ctx.location || search.pickup, dropoffId: ctx.location || search.pickup, age: ctx.age || 30 });
    const L = V.locations.find((l) => l.id === (ctx.location || search.pickup));
    const discount = q.lines.find((l) => /discount/i.test(l.label));
    let s = `**${q.car.name}** for **${days} day${days > 1 ? "s" : ""}** from ${L.short}: **${money(q.total)}** all-in (≈ ${money(q.perDay)}/day).`;
    s += `\n- Base: $${q.car.price}/day × ${days}`;
    if (discount) s += `\n- ${discount.label}: −${money(-discount.amount)}`;
    if (ctx.age && ctx.age < 25) s += `\n- Young driver fee: $${V.pricing.youngDriverFeePerDay}/day`;
    s += `\n- Taxes & fees included${L.airport ? " (incl. 10% airport fee — Downtown Tampa skips it)" : ""}`;
    if (!q.eligible) s += `\n\n⚠️ This car requires drivers aged **${q.car.minAge}+**.`;
    return { text: s, q };
  }

  const INTENTS = [
    { id: "greet", priority: 20, kw: [/\b(hi|hello|hey|yo|hiya|howdy|hola|good (morning|afternoon|evening))\b/] },
    { id: "thanks", priority: 20, kw: [/\b(thanks|thank you|thx|ty|appreciate|awesome|perfect|great)\b/] },
    { id: "bye", priority: 20, kw: [/\b(bye|goodbye|see ya|see you|that'?s all|later)\b/] },
    { id: "book", priority: 1, kw: [/\b(book|reserve)\b/, /\b(i'?ll take|let'?s do|go with)\b.*\b(it|this|that|the|one)\b/, /\bi want (the|that|this|it)\b/] },
    { id: "manage", priority: 2, kw: [/my (booking|reservation)s?/, /\b(manage|modify|change|update)\b.*\b(booking|reservation|dates?)\b/, /confirmation (code|number)/] },
    { id: "quote", priority: 3, kw: [/how much|price|cost|quote|rate|total|estimate|\$|pay for|fees?\b/] },
    { id: "recommend", priority: 4, kw: [/recommend|suggest|best (car|option|for)|which car\b|what car\b|need a car|looking for|should i (get|rent)|options|good for|family|kids|group|road ?trip|beach|cheap|cheapest|budget|afford/] },
    { id: "fleet", priority: 5, kw: [/what (cars|vehicles)|which (cars|vehicles)|your (fleet|cars|vehicles)|list .*cars|available cars|show me .*cars/, /(cars|vehicles) do you (have|offer)|full (list|fleet)|whole fleet/] },
    { id: "available", priority: 4, kw: [/availab|in stock|sold out|have any/] },
    { id: "age", priority: 2, kw: [/i'?m \d{2}\b|i am \d{2}\b/, /\bage\b|how old|years? old|under 2[15]|young driver|minimum age|teen/] },
    { id: "license", priority: 3, kw: [/licen[cs]e|documents?|what (do i|should i) (need|bring)|passport|\bidp\b|international driv|foreign|tourist|visitor|requirements?/] },
    { id: "payment", priority: 3, kw: [/payment|pay (with|by)|credit card|debit|cash|apple pay|google pay|visa|amex|mastercard|deposit|hold\b|security/] },
    { id: "cancel", priority: 2, kw: [/cancel|refund|no[- ]show|money back/] },
    { id: "mileage", priority: 3, kw: [/mileage|miles|unlimited|out of state|other states?|georgia|alabama|carolina|road ?trip.*(state|limit)/] },
    { id: "fuel", priority: 3, kw: [/fuel|gas\b|gasoline|tank|refuel|charg(e|ing)|supercharg|battery|range/] },
    { id: "insurance", priority: 2, kw: [/insurance|coverage|cover\b|protection|cdw|ldw|damage|deductible|waiver|accident|scratch|dent/] },
    { id: "pets", priority: 2, kw: [/\bpets?\b|\bdogs?\b|\bcats?\b|puppy|animal/] },
    { id: "smoking", priority: 2, kw: [/smok|vap(e|ing)|cigar|weed/] },
    { id: "late", priority: 2, kw: [/late|grace period|extend|extra (hour|day)|return (later|early)|early return/] },
    { id: "roadside", priority: 2, kw: [/roadside|break ?down|broke down|flat tire|jump ?start|lock(ed)? out|\btow(ing)?\b|emergency|stranded/] },
    { id: "locations", priority: 3, kw: [/where (are you|is|are)|locations?|address|branch|office|hours|open|close|directions/] },
    { id: "pickup", priority: 3, kw: [/pick ?up|check[- ]?in|counter|shuttle|key|how does .* work|collect/] },
    { id: "delivery", priority: 2, kw: [/deliver|drop (it )?off at|bring the car|hotel|cruise|port|home delivery/] },
    { id: "oneway", priority: 2, kw: [/one[- ]way|different location|drop (it )?off (in|at) (a )?different|return (it )?(in|to) (miami|orlando|tampa)/] },
    { id: "childseat", priority: 2, kw: [/child seat|car seat|booster|baby|infant|toddler/] },
    { id: "driver", priority: 2, kw: [/additional driver|second driver|another driver|extra driver|spouse|wife|husband|partner (drive|driving)|someone else drive/] },
    { id: "tolls", priority: 2, kw: [/toll|sunpass|e-?pass/] },
    { id: "longterm", priority: 3, kw: [/long[- ]term|monthly|month|weekly|discount|deal|offer|promo|coupon|code\b|save/] },
    { id: "crossborder", priority: 2, kw: [/mexico|canada|bahamas|cross[- ]border|another country|ferry/] },
    { id: "cleaning", priority: 3, kw: [/clean|sanitiz|sand|dirty|wash/] },
    { id: "extras", priority: 4, kw: [/extras?|add[- ]ons?|wifi|wi-fi|hotspot|gps|navigation|beach kit|umbrella|cooler/] },
    { id: "contact", priority: 3, kw: [/human|agent|real person|representative|speak to|talk to|call you|phone|contact|email|whatsapp|support/] },
    { id: "transmission", priority: 3, kw: [/manual|stick ?shift|automatic|transmission/] },
  ];

  const R = {
    greet: () => pick(["Hey there! 👋 I'm **Vee**, Velora's concierge.", "Hi! 👋 Vee here — ready to find your perfect ride."]) + " I can recommend a car, give you an exact price, or explain any policy. Where are you headed?",
    thanks: () => pick(["Anytime! 🙌 Anything else I can help with?", "You got it! Want me to open the booking form?", "Happy to help — enjoy the drive! 🚗"]),
    bye: () => "Safe travels! 🌴 I'm here 24/7 if anything comes up.",
    age: (e) => {
      const a = e.age;
      let s = P.age;
      if (a && a < 21) s = `Sorry — at **${a}** you're not quite old enough yet. Our minimum age is **21** for every car. 🙏`;
      else if (a && a < 25) s = `Good news — at **${a}** you can rent anything from Economy to Full-size SUV. A **$${V.pricing.youngDriverFeePerDay}/day young-driver fee** applies until 25, and Luxury/Sports need 25+.`;
      else if (a && a < 30) s = `At **${a}** you can rent everything except the Exotic class (30+). No young-driver fee! 🎉`;
      else if (a) s = `At **${a}** the whole fleet is yours — including the Porsche. 😎`;
      return s;
    },
    license: () => `**What to bring:**\n- ${P.license}\n- A credit card (or debit card + return itinerary) in the driver's name.`,
    payment: () => `${P.payment}\n\n**Deposit:** ${P.deposit}`,
    cancel: () => `${P.cancellation}\n\n${P.modification}`,
    mileage: () => P.mileage,
    fuel: (e) => (/charg|tesla|\bevs?\b|electric|battery|range/.test(e.raw) ? `The **Tesla Model 3** has **272 mi range** and free Supercharging during your rental. ⚡ Return it with 20%+ charge or a $35 recharge fee applies.` : P.fuel),
    insurance: () => `${P.insurance}\n${V.protection.map((p) => `- **${p.name}** — ${p.price ? "$" + p.price + "/day" : "included"}: ${p.desc}`).join("\n")}`,
    pets: () => `Yes, pets are welcome! 🐶 ${P.pets}`,
    smoking: () => P.smoking,
    late: () => `${P.lateReturn} Need more time? Extend in "Manage booking" or just message me — same daily rate.`,
    roadside: () => `🚨 Call **${V.company.phone}** any time (24/7). ${P.roadside}`,
    locations: () => `We're at 4 spots:\n${V.locations.map((l) => `- **${l.name}** — ${l.address} (${l.hours})`).join("\n")}\n\n${V.company.supportHours}`,
    pickup: () => P.pickup,
    delivery: () => `Yes! We deliver to hotels, homes and cruise ports in Tampa, Orlando and Miami for **$${V.pricing.deliveryFee} each way**. Add a note when you reserve.`,
    oneway: () => `One-way trips between any Velora locations are a flat **$${V.pricing.oneWayFee}**. Just choose a different drop-off in the booking form.`,
    childseat: () => { const x = V.extras.find((x) => x.id === "child-seat"); return `Child & booster seats are **$${x.price}/day**, capped at **$${x.cap}** per rental. Florida requires them for kids under 6. 👶`; },
    driver: () => { const x = V.extras.find((x) => x.id === "extra-driver"); return `Additional drivers are **$${x.price}/day**. ${x.note} They must meet the same age and license rules.`; },
    tolls: () => { const x = V.extras.find((x) => x.id === "sunpass"); return `Florida has lots of cashless tolls. Add a **SunPass** for **$${x.price}/day** (max $${x.cap}/rental). ${x.note}`; },
    longterm: () => `💸 Ways to save:\n- ${P.longTerm}\n${V.promos.map((p) => `- Code **${p.code}** — ${p.desc}`).join("\n")}\n- Pick up Downtown Tampa to skip the 10% airport fee.`,
    crossborder: () => P.crossBorder,
    cleaning: () => P.cleaning,
    extras: () => `Popular add-ons:\n${V.extras.map((x) => `- **${x.name}** — $${x.price}${x.unit === "day" ? "/day" : " per rental"}${x.cap ? ` (max $${x.cap})` : ""}`).join("\n")}\nNo GPS needed — every car has Apple CarPlay & Android Auto.`,
    contact: () => `You can reach a real human any time:\n- 📞 **${V.company.phone}**\n- 💬 WhatsApp **${V.company.whatsapp}**\n- ✉️ ${V.company.email}\n\n${V.company.supportHours}`,
    transmission: () => "Every car in our fleet is **automatic** — no stick-shifts. All come with Apple CarPlay / Android Auto and backup cameras.",
    manage: () => {
      const b = window.VeloraApp ? window.VeloraApp.bookings() : [];
      if (!b.length) return `I don't see any bookings on this device yet. Once you reserve, use **Manage booking** in the footer to view or cancel.`;
      return `Here's what I found:\n${b.map((x) => `- **${x.carName}** · ${fmtDate(x.start)}–${fmtDate(x.end)} · code \`${x.code}\` · ${money(x.total)}`).join("\n")}\n\nOpen **Manage booking** in the footer to cancel. ${P.modification}`;
    },
    fleet: () => `Here's the lineup — all automatic, all under 2 years old:\n${V.fleet.map((c) => `- ${carLine(c)}`).join("\n")}`,
  };

  /**
   * Built-in brain. Returns { text, cars?, chips?, action?, facts? }.
   * `facts` are exact computed numbers handed to LLM engines.
   */
  function builtinReply(text, ctx) {
    const a = analyze(text, ctx);
    const e = { ...a.e, raw: a.t };
    const SMALL = ["greet", "thanks", "bye"];
    const small = a.intents.find((i) => SMALL.includes(i));
    let top = a.intents.find((i) => !SMALL.includes(i));
    const res = { chips: null, cars: null, action: null, facts: [] };
    const out = (r) => { if (small === "greet" && r.text && !r.handled) r.text = "Hi there! 👋 " + r.text; return r; };

    // ---- booking action (handled locally for every engine)
    if (a.intents.includes("book") && (e.cars.length || (top === "book" && ctx.car) || a.intents.filter((i) => !SMALL.includes(i)).length === 1)) {
      const carId = e.cars[0] || ctx.car;
      if (carId) {
        const car = carById(carId);
        res.action = () => {
          if (!window.VeloraApp) return;
          const overrides = {};
          if (ctx.location) { overrides.pickup = ctx.location; overrides.dropoff = ctx.location; }
          if (ctx.start) { overrides.start = ctx.start; }
          if (ctx.start && ctx.days) overrides.end = isoDate(addDays(new Date(ctx.start + "T12:00:00"), ctx.days));
          else if (ctx.days) {
            const s = window.VeloraApp.getSearch();
            overrides.end = isoDate(addDays(new Date(s.start + "T12:00:00"), ctx.days));
          }
          if (ctx.age) overrides.age = ctx.age;
          if (Object.keys(overrides).length) window.VeloraApp.setSearch(overrides);
          window.VeloraApp.openReserve(carId);
        };
        res.text = `Great choice! 🙌 Opening the reservation form for the **${car.name}**${ctx.days ? ` (${ctx.days} days)` : ""}. Pick your protection, add your name & email, and you're set.`;
        res.handled = true;
        return out(res);
      }
      res.text = "Happy to book for you! Which car would you like? Here are a few favorites:";
      res.cars = recommend(e, ctx);
      res.handled = true;
      return out(res);
    }
    if (top === "book") top = a.intents.find((i) => i !== "book" && !SMALL.includes(i));
    const second = a.intents.find((i) => i !== top && !SMALL.includes(i) && !["book", "quote", "recommend"].includes(i));

    // ---- compare two or more named cars
    if (e.cars.length >= 2) {
      const cars = e.cars.map(carById);
      res.text = `Side by side:\n${cars.map((c) => `- ${carLine(c)}, age ${c.minAge}+`).join("\n")}\n\n` +
        (cars[0].price < cars[1].price ? `The **${cars[0].name}** is the better value; the **${cars[1].name}** is the upgrade.` : `The **${cars[1].name}** is the better value; the **${cars[0].name}** is the upgrade.`);
      res.cars = cars;
      res.facts.push(res.text);
      return out(res);
    }

    // ---- price / quote
    const hasNeeds = e.people || e.budget || e.cheap || (e.category && !e.cars.length);
    const carForQuote = e.cars[0] || (a.intents.includes("quote") && !hasNeeds && ctx.car);
    if (a.intents.includes("quote") && carForQuote && !["age", "insurance", "childseat", "driver", "tolls", "delivery", "oneway"].includes(top)) {
      const { text: qt, q } = quoteText(carForQuote, ctx);
      res.text = qt + (ctx.days ? "" : "\n\n*Tell me your dates or number of days for an exact total (showing 3 days).*");
      res.cars = [q.car];
      res.chips = [`Book the ${q.car.name}`, "Add Premium protection?", "Weekly price"];
      res.facts.push(qt);
      return out(res);
    }

    // ---- recommendations
    const wantsRec = top === "recommend" || (top === "available" && !e.cars.length) || (hasNeeds && !top) ||
      (hasNeeds && ["quote", "fleet", "available"].includes(top));
    if (wantsRec) {
      const cars = recommend(e, ctx);
      if (!cars.length) {
        res.text = `Hmm, nothing in our fleet matches all of that${e.budget ? ` under $${e.budget}/day` : ""}${e.people ? ` for ${e.people} people` : ""}. The closest options:`;
        res.cars = V.fleet.slice().sort((x, y) => x.price - y.price).slice(0, 3);
      } else {
        const why = [e.people && `${e.people} people`, e.budget && `under $${e.budget}/day`, e.category, (e.age ?? ctx.age) && `driver age ${e.age ?? ctx.age}`].filter(Boolean).join(", ");
        res.text = `${why ? `For **${why}**, ` : ""}here's what I'd pick:\n${cars.map((c, i) => `${i + 1}. ${carLine(c)}`).join("\n")}\n\nTap **Reserve** on any card, or ask me for a price for your dates.`;
        res.cars = cars;
      }
      if ((e.age ?? ctx.age) && (e.age ?? ctx.age) < 25 && (e.age ?? ctx.age) >= 21) res.text += `\n\n(Young driver fee of $${V.pricing.youngDriverFeePerDay}/day applies under 25.)`;
      res.facts.push(res.text);
      return out(res);
    }

    // ---- specific car info
    if (e.cars.length && (!top || ["available", "fleet", "recommend"].includes(top) || a.scored[0].score < 2)) {
      const c = carById(e.cars[0]);
      if (!top || top === "available" || top === "fleet") {
        res.text = top === "available"
          ? `Yes — the **${c.name}** has availability at all locations right now. Lock it in by tapping **Reserve**; free cancellation until 24h before. ✅`
          : `**${c.name}** · ${c.category}\n${c.blurb}\n- **$${c.price}/day** (15% off weekly)\n- ${c.seats} seats · ${c.bags} bags · ${c.transmission}\n- ${c.fuel} · ${c.mpg}\n- Drivers ${c.minAge}+`;
        res.cars = [c];
        res.chips = [`Price for 3 days`, `Book the ${c.name}`, "Compare with something cheaper"];
        res.facts.push(carLine(c));
        return out(res);
      }
    }

    // ---- policy / FAQ intents
    if (top && R[top]) {
      res.text = R[top](e, ctx);
      if (second && R[second] && second !== top) res.text += "\n\n" + R[second](e, ctx);
      if (top === "fleet") res.cars = V.fleet.slice(0, 9);
      if (top === "age" && e.age >= 21) { res.cars = recommend(e, ctx); }
      res.facts.push(res.text);
      return out(res);
    }

    // ---- standalone price question with no car
    if (top === "quote") {
      const cheapest = V.fleet.reduce((m, c) => (c.price < m.price ? c : m));
      res.text = `Rates start at **$${cheapest.price}/day** (${cheapest.name}) and go up to **$${Math.max(...V.fleet.map((c) => c.price))}/day** for the Porsche. Weekly rentals save 15%, monthly 30%.\n\nWhich car and how many days? I'll give you the exact all-in total.`;
      res.chips = ["Tesla for a week", "Cheapest car for 3 days", "SUV for 5 days"];
      res.facts.push(res.text);
      return out(res);
    }

    // ---- small talk only
    if (small) { res.text = R[small](e, ctx); if (small === "greet") res.chips = DEFAULT_CHIPS; return res; }

    // ---- fallback
    res.fallback = true;
    res.text = `I'm not 100% sure about that one. 🤔 I can help with **cars & prices**, **age/license rules**, **insurance**, **pickup**, **pets**, **tolls** and more — or reach a human at **${V.company.phone}**.`;
    res.chips = ["Show me your cars", "How much is an SUV for a week?", "What do I need to rent?", "Talk to a human"];
    return out(res);
  }

  /* =======================================================
     Engines
     ======================================================= */
  const engines = {
    builtin: { label: "Built-in assistant · offline", ready: true },
    ollama: { label: "", ready: false, model: null },
    webllm: { label: "", ready: false, engine: null, loading: false },
  };

  async function detectOllama() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${CONFIG.ollamaUrl}/api/tags`, { signal: ctrl.signal });
      const data = await r.json();
      const names = (data.models || []).map((m) => m.name);
      if (!names.length) { engines.ollama.ready = false; engines.ollama.error = "Ollama is running but has no models. Run: ollama pull " + settings.ollamaModel; return false; }
      const wanted = settings.ollamaModel;
      engines.ollama.model = names.find((n) => n === wanted || n.split(":")[0] === wanted.split(":")[0]) || names[0];
      engines.ollama.ready = true;
      engines.ollama.label = `Local AI · ${engines.ollama.model} (Ollama)`;
      return true;
    } catch {
      engines.ollama.ready = false;
      engines.ollama.error = "Ollama not detected at " + CONFIG.ollamaUrl;
      return false;
    } finally { clearTimeout(to); }
  }

  async function* streamOllama(messages) {
    const r = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: engines.ollama.model, messages, stream: true, options: { temperature: 0.3, num_ctx: 8192 } }),
    });
    if (!r.ok || !r.body) throw new Error("Ollama HTTP " + r.status);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        if (j.message && j.message.content) yield j.message.content;
      }
    }
  }

  async function loadWebLLM() {
    const W = engines.webllm;
    if (W.ready || W.loading) return W.ready;
    if (!("gpu" in navigator)) {
      W.error = "WebGPU isn't available in this browser. Try the latest Chrome or Edge on desktop.";
      return false;
    }
    W.loading = true;
    const prog = $("#webllmProgress");
    prog.hidden = false;
    setStatus("loading", "Downloading in-browser model…");
    try {
      const webllm = await import(CONFIG.webllmCdn);
      W.engine = await webllm.CreateMLCEngine(CONFIG.webllmModel, {
        initProgressCallback: (p) => {
          prog.querySelector(".progress__bar").style.width = Math.round((p.progress || 0) * 100) + "%";
          prog.querySelector("span").textContent = p.text || "Loading…";
        },
      });
      W.ready = true;
      W.label = `In-browser AI · ${CONFIG.webllmModel.split("-q")[0]}`;
      prog.hidden = true;
      return true;
    } catch (err) {
      W.error = "Couldn't load the in-browser model: " + err.message;
      prog.hidden = true;
      return false;
    } finally { W.loading = false; }
  }

  async function* streamWebLLM(messages) {
    const chunks = await engines.webllm.engine.chat.completions.create({ messages, stream: true, temperature: 0.3 });
    for await (const c of chunks) {
      const d = c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
      if (d) yield d;
    }
  }

  /** Which engine answers right now? */
  function activeEngine() {
    const s = settings.engine;
    if (s === "builtin") return "builtin";
    if (s === "webllm") return engines.webllm.ready ? "webllm" : "builtin";
    if (s === "ollama") return engines.ollama.ready ? "ollama" : "builtin";
    return IS_LOCAL_SITE && engines.ollama.ready ? "ollama" : "builtin"; // auto
  }

  /* =======================================================
     UI
     ======================================================= */
  const ui = {
    chat: $("#chat"), body: $("#chatBody"), chips: $("#chatChips"), form: $("#chatForm"),
    input: $("#chatInput"), send: $("#chatSend"), launcher: $("#chatLauncher"), badge: $("#chatBadge"),
    settings: $("#chatSettings"), dot: $("#engineDot"), label: $("#engineLabel"),
  };
  const settings = { engine: "auto", ollamaModel: CONFIG.ollamaModel, ...store.get(STORE.settings, {}) };
  let history = store.get(STORE.chat, []); // [{role, content, cars?}]
  const ctx = {}; // conversation memory (car, days, age, location, dates)
  let busy = false;

  const DEFAULT_CHIPS = ["What cars do you have?", "SUV for a family of 5", "I'm 23 — can I rent?", "Tesla for a week — price?", "Do you allow pets?", "Cancellation policy"];

  function setStatus(kind, text) {
    ui.dot.className = kind === "on" ? "on" : kind === "loading" ? "loading" : "";
    ui.label.textContent = text;
  }
  function refreshStatus() {
    const id = activeEngine();
    if (id === "builtin") {
      const why = settings.engine === "ollama" ? engines.ollama.error : settings.engine === "webllm" ? engines.webllm.error : "";
      setStatus("on", engines.builtin.label + (why ? " — fallback" : ""));
    } else setStatus("on", engines[id].label);
  }

  function scrollDown() { ui.body.scrollTop = ui.body.scrollHeight; }

  function addBubble(role, content) {
    const div = document.createElement("div");
    div.className = `msg msg--${role === "user" ? "user" : "bot"}`;
    div.innerHTML = role === "user" ? esc(content).replace(/\n/g, "<br>") : md(content);
    ui.body.appendChild(div);
    scrollDown();
    return div;
  }

  function addCars(ids) {
    const wrap = document.createElement("div");
    wrap.className = "chat-cars";
    ids.map(carById).filter(Boolean).forEach((c) => {
      wrap.insertAdjacentHTML("beforeend", `
        <div class="chat-car">
          <img src="${c.img}" alt="${esc(c.name)}" loading="lazy" />
          <div><strong>${esc(c.name)}</strong><small>${esc(c.category)} · ${c.seats} seats · $${c.price}/day</small>
          <button data-chat-reserve="${c.id}">Reserve</button></div>
        </div>`);
    });
    ui.body.appendChild(wrap);
    scrollDown();
  }

  function setChips(list) {
    ui.chips.innerHTML = "";
    (list || DEFAULT_CHIPS).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => send(c));
      ui.chips.appendChild(b);
    });
  }

  function typing() {
    const d = document.createElement("div");
    d.className = "msg msg--bot typing";
    d.innerHTML = "<i></i><i></i><i></i>";
    ui.body.appendChild(d);
    scrollDown();
    return d;
  }

  function persist() { store.set(STORE.chat, history.slice(-40)); }

  function renderHistory() {
    ui.body.innerHTML = "";
    if (!history.length) greet();
    else history.forEach((m) => { addBubble(m.role, m.content); if (m.cars && m.cars.length) addCars(m.cars); });
    setChips();
  }

  function greet() {
    const hour = new Date().getHours();
    const hi = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const text = `${hi}! 👋 I'm **Vee**, Velora's AI concierge.\n\nI can find the right car for your trip, quote an exact all-in price, or answer anything about our policies. What are you planning?`;
    history.push({ role: "assistant", content: text });
    addBubble("assistant", text);
    persist();
  }

  /* ---------- send / respond ---------- */
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    ui.send.disabled = true;
    ui.input.value = "";
    autosize();
    history.push({ role: "user", content: text });
    addBubble("user", text);
    persist();

    const local = builtinReply(text, ctx);
    const engineId = activeEngine();
    const t = typing();
    let reply = "";

    try {
      if (engineId === "builtin" || local.handled) {
        await new Promise((r) => setTimeout(r, 450 + Math.min(900, local.text.length * 4)));
        t.remove();
        reply = local.text;
        addBubble("assistant", reply);
      } else {
        // LLM path: pass grounded facts computed by the analyzer.
        const msgs = [{ role: "system", content: buildSystemPrompt() }];
        const past = history.slice(-CONFIG.maxHistory - 1, -1);
        while (past.length && past[0].role !== "user") past.shift();
        past.forEach((m) => msgs.push({ role: m.role, content: m.content }));
        const facts = local.facts.length ? `\n\n[Velora system data — exact, use if relevant]\n${local.facts.join("\n")}` : "";
        msgs.push({ role: "user", content: text + facts });

        const stream = engineId === "ollama" ? streamOllama(msgs) : streamWebLLM(msgs);
        let bubble = null;
        for await (const tok of stream) {
          if (!bubble) { t.remove(); bubble = addBubble("assistant", ""); }
          reply += tok;
          bubble.innerHTML = md(reply);
          scrollDown();
        }
        if (!bubble) { t.remove(); reply = local.text; addBubble("assistant", reply); }
      }
    } catch (err) {
      // Engine failed mid-conversation → graceful fallback.
      console.warn("[Vee] engine error, falling back:", err);
      if (t.isConnected) t.remove();
      if (engineId === "ollama") { engines.ollama.ready = false; refreshStatus(); }
      reply = local.text;
      addBubble("assistant", reply);
    }

    const cars = (local.cars || []).map((c) => c.id);
    if (cars.length) addCars(cars);
    history.push({ role: "assistant", content: reply, cars });
    persist();
    setChips(local.chips);
    if (local.action) setTimeout(local.action, 700);

    busy = false;
    ui.send.disabled = false;
    ui.input.focus();
  }

  /* ---------- events ---------- */
  function autosize() { ui.input.style.height = "auto"; ui.input.style.height = Math.min(ui.input.scrollHeight, 120) + "px"; }
  ui.input.addEventListener("input", autosize);
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ui.input.value); }
  });
  ui.form.addEventListener("submit", (e) => { e.preventDefault(); send(ui.input.value); });

  ui.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-chat-reserve]");
    if (b && window.VeloraApp) window.VeloraApp.openReserve(b.dataset.chatReserve);
  });

  function open() {
    ui.chat.hidden = false;
    ui.launcher.setAttribute("aria-expanded", "true");
    ui.badge.hidden = true;
    scrollDown();
    if (((settings.engine === "auto" && IS_LOCAL_SITE) || settings.engine === "ollama") && !engines.ollama.ready && !busy) detectOllama().then(refreshStatus);
    setTimeout(() => ui.input.focus(), 50);
  }
  function minimize() {
    ui.chat.hidden = true;
    ui.launcher.setAttribute("aria-expanded", "false");
  }
  ui.launcher.addEventListener("click", open);
  $("#chatCloseBtn").addEventListener("click", minimize);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ui.chat.hidden && !document.querySelector("dialog[open]")) minimize(); });

  $("#chatResetBtn").addEventListener("click", () => {
    history = [];
    Object.keys(ctx).forEach((k) => delete ctx[k]);
    persist();
    renderHistory();
  });

  $("#chatSettingsBtn").addEventListener("click", () => { ui.settings.hidden = !ui.settings.hidden; });

  // engine radios
  document.querySelectorAll('input[name="engine"]').forEach((r) => {
    r.checked = r.value === settings.engine;
    r.addEventListener("change", async () => {
      settings.engine = r.value;
      store.set(STORE.settings, settings);
      await applyEngine(true);
    });
  });
  const modelInput = $("#ollamaModel");
  modelInput.value = settings.ollamaModel;
  modelInput.addEventListener("change", async () => {
    settings.ollamaModel = modelInput.value.trim() || CONFIG.ollamaModel;
    store.set(STORE.settings, settings);
    await applyEngine(true);
  });

  async function applyEngine(announce) {
    setStatus("loading", "Connecting…");
    if ((settings.engine === "auto" && IS_LOCAL_SITE) || settings.engine === "ollama") await detectOllama();
    if (settings.engine === "webllm") await loadWebLLM();
    refreshStatus();
    if (!announce) return;
    const id = activeEngine();
    let note;
    if (settings.engine === "ollama" && id !== "ollama") note = `⚠️ ${engines.ollama.error}. Using the built-in assistant for now. See README for the 2-minute Ollama setup.`;
    else if (settings.engine === "webllm" && id !== "webllm") note = `⚠️ ${engines.webllm.error || "In-browser model not ready."} Using the built-in assistant.`;
    else note = `✅ Switched to **${engines[id].label}**.`;
    addBubble("assistant", note);
  }

  /* ---------- boot ---------- */
  renderHistory();
  applyEngine(false);
  if (location.hash === "#chat") open();

  window.VeloraChat = { open, minimize, send: (t) => { open(); send(t); }, _builtinReply: builtinReply, _analyze: analyze };
})();
