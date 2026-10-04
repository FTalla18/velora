/* =========================================================
   Velora — website logic
   Fleet rendering, search, quotes, reservation flow, bookings.
   Exposes window.VeloraApp so the chatbot can drive the UI.
   ========================================================= */
(function () {
  const V = window.VELORA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = V.money;
  const STORAGE_KEY = "velora.bookings";

  const state = {
    filter: "All",
    search: null, // { pickup, dropoff, start, end, age, days }
  };

  /* ---------- helpers ---------- */
  const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const loc = (id) => V.locations.find((l) => l.id === id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  }
  function saveBookings(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
  }

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger");
  const navLinks = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
    if (open) nav.classList.add("is-scrolled");
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }));

  /* ---------- Booking widget ---------- */
  const pickupSel = $("#pickup"), dropoffSel = $("#dropoff");
  const startInp = $("#startDate"), endInp = $("#endDate"), ageInp = $("#age");
  V.locations.forEach((l) => {
    pickupSel.add(new Option(l.short, l.id));
    dropoffSel.add(new Option(l.short, l.id));
  });
  const today = new Date();
  startInp.min = isoDate(today);
  startInp.value = isoDate(addDays(today, 1));
  endInp.value = isoDate(addDays(today, 4));
  endInp.min = startInp.value;
  pickupSel.addEventListener("change", () => { dropoffSel.value = pickupSel.value; });
  startInp.addEventListener("change", () => {
    endInp.min = startInp.value;
    if (endInp.value <= startInp.value) endInp.value = isoDate(addDays(new Date(startInp.value + "T12:00:00"), 3));
  });

  function readSearch() {
    const days = daysBetween(startInp.value, endInp.value);
    return { pickup: pickupSel.value, dropoff: dropoffSel.value, start: startInp.value, end: endInp.value, age: parseInt(ageInp.value, 10) || 30, days };
  }

  $("#book").addEventListener("submit", (e) => {
    e.preventDefault();
    const s = readSearch();
    const note = $("#bookingNote");
    note.textContent = "";
    if (!s.start || !s.end || s.days < 1) { note.textContent = "Return date must be at least one day after pick-up."; return; }
    if (s.age < 21) { note.textContent = "Drivers must be at least 21 years old to rent with Velora."; return; }
    state.search = s;
    renderFleet();
    $("#fleet").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- Fleet ---------- */
  const categories = ["All", ...new Set(V.fleet.map((c) => c.category))];
  const filtersEl = $("#filters");
  categories.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === "All" ? " is-active" : "");
    b.textContent = c;
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => setFilter(c));
    filtersEl.appendChild(b);
  });

  function setFilter(c) {
    state.filter = c;
    $$(".chip", filtersEl).forEach((b) => b.classList.toggle("is-active", b.textContent === c));
    renderFleet();
  }

  function renderFleet() {
    const grid = $("#fleetGrid");
    const s = state.search;
    const cars = V.fleet.filter((c) => state.filter === "All" || c.category === state.filter);
    $("#fleetLead").innerHTML = s
      ? `Showing totals for <strong>${s.days} day${s.days > 1 ? "s" : ""}</strong> · ${esc(loc(s.pickup).short)} · ${fmtDate(s.start)} → ${fmtDate(s.end)}`
      : "Every car is under 2 years old, detailed between rentals, and comes with unlimited miles.";

    grid.innerHTML = cars.length ? "" : `<p class="empty">No cars in this category.</p>`;
    cars.forEach((car, i) => {
      const q = s ? V.quote({ carId: car.id, days: s.days, pickupId: s.pickup, dropoffId: s.dropoff, age: s.age }) : null;
      const tooYoung = s && s.age < car.minAge;
      const el = document.createElement("article");
      el.className = "car";
      el.style.animationDelay = `${i * 60}ms`;
      el.innerHTML = `
        <div class="car__media">
          <img src="${car.img}" alt="${esc(car.name)}" loading="lazy" />
          <span class="car__tag ${car.fuel === "Electric" ? "car__tag--ev" : ""}">${esc(car.category)}</span>
        </div>
        <div class="car__body">
          <div class="car__top">
            <h3 class="car__name">${esc(car.name)}</h3>
            <div class="car__price"><strong>$${car.price}</strong><span>/day</span>
              ${q ? `<span class="car__total">${money(q.total)} total</span>` : ""}
            </div>
          </div>
          <p class="car__blurb">${esc(car.blurb)}</p>
          <ul class="car__specs">
            <li>👤 ${car.seats} seats</li><li>🧳 ${car.bags} bag${car.bags > 1 ? "s" : ""}</li><li>⚙️ ${car.transmission}</li>
            <li>${car.fuel === "Electric" ? "🔋" : "⛽"} ${car.mpg}</li><li>${car.minAge}+ yrs</li>
          </ul>
          ${tooYoung ? `<p class="car__warn">Requires drivers aged ${car.minAge}+.</p>` : ""}
          <div class="car__actions">
            <button class="btn btn--ghost btn--sm" data-ask="${car.id}">Ask Vee</button>
            <button class="btn btn--dark btn--sm" data-reserve="${car.id}" ${tooYoung ? "disabled" : ""}>Reserve</button>
          </div>
        </div>`;
      grid.appendChild(el);
    });
  }

  $("#fleetGrid").addEventListener("click", (e) => {
    const r = e.target.closest("[data-reserve]");
    if (r) return openReserve(r.dataset.reserve);
    const a = e.target.closest("[data-ask]");
    if (a && window.VeloraChat) {
      const car = V.fleet.find((c) => c.id === a.dataset.ask);
      window.VeloraChat.open();
      window.VeloraChat.send(`Tell me about the ${car.name}`);
    }
  });

  /* ---------- Locations ---------- */
  $("#locationsGrid").innerHTML = V.locations.map((l) => `
    <article class="loc">
      <div class="loc__code">${l.id.toUpperCase()}${l.airport ? "<small>✈ Airport</small>" : ""}</div>
      <strong>${esc(l.name)}</strong>
      <p>${esc(l.address)}</p>
      <p>🕒 ${esc(l.hours)}</p>
    </article>`).join("");

  /* ---------- FAQ (generated from policies) ---------- */
  const faq = [
    ["How old do I need to be?", V.policies.age],
    ["What do I need to bring?", V.policies.license],
    ["How does pickup work?", V.policies.pickup],
    ["Which payment methods do you accept?", V.policies.payment + " " + V.policies.deposit],
    ["What's your cancellation policy?", V.policies.cancellation + " " + V.policies.modification],
    ["Is mileage unlimited?", V.policies.mileage],
    ["Do I need to buy insurance?", V.policies.insurance],
    ["Can I bring my pet?", V.policies.pets],
    ["How does fuel / charging work?", V.policies.fuel],
  ];
  $("#faqList").innerHTML = faq.map(([q, a], i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");

  /* ---------- Footer ---------- */
  $("#footerPhone").textContent = V.company.phone;
  $("#footerEmail").textContent = V.company.email;
  $("#year").textContent = new Date().getFullYear();
  $$("[data-open-chat]").forEach((b) => b.addEventListener("click", () => window.VeloraChat && window.VeloraChat.open()));

  /* ---------- Reservation modal ---------- */
  const modal = $("#reserveModal");
  let current = null; // { car, search }

  V.protection.forEach((p, i) => {
    $("#mProtection").insertAdjacentHTML("beforeend", `
      <label class="choice"><input type="radio" name="protection" value="${p.id}" ${i === 0 ? "checked" : ""}/>
        <span><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></span>
        <span class="price">${p.price ? "$" + p.price + "/day" : "Included"}</span></label>`);
  });
  V.extras.forEach((x) => {
    $("#mExtras").insertAdjacentHTML("beforeend", `
      <label class="choice"><input type="checkbox" name="extra" value="${x.id}"/>
        <span><b>${esc(x.name)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</span>
        <span class="price">$${x.price}${x.unit === "day" ? "/day" : ""}</span></label>`);
  });

  function currentQuote() {
    const s = current.search;
    return V.quote({
      carId: current.car.id, days: s.days, pickupId: s.pickup, dropoffId: s.dropoff, age: s.age,
      protection: ($("input[name=protection]:checked", modal) || {}).value,
      extras: $$("input[name=extra]:checked", modal).map((i) => i.value),
      promo: $("#mPromo").value.trim(),
    });
  }

  function updateBreakdown() {
    const q = currentQuote();
    $("#mBreakdown").innerHTML = q.lines.map((l) => `<li class="${l.amount < 0 ? "neg" : ""}"><span>${esc(l.label)}</span><span>${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}</span></li>`).join("");
    $("#mTotal").textContent = money(q.total);
    $("#mEligibility").textContent = q.eligible ? `≈ ${money(q.perDay)}/day all-in` : `This car requires drivers aged ${q.car.minAge}+.`;
    $("#mConfirm").disabled = !q.eligible;
  }
  modal.addEventListener("input", updateBreakdown);
  modal.addEventListener("change", updateBreakdown);

  function openReserve(carId, overrides = {}) {
    const car = V.fleet.find((c) => c.id === carId);
    if (!car) return;
    const search = { ...(state.search || readSearch()), ...overrides };
    if (search.days < 1) search.days = 1;
    current = { car, search };
    $("#reserveForm").reset();
    $("#mCarImg").src = car.img;
    $("#mCarImg").alt = car.name;
    $("#reserveTitle").textContent = car.name;
    const pu = loc(search.pickup), dr = loc(search.dropoff);
    $("#mTrip").textContent = `${pu.short}${dr.id !== pu.id ? " → " + dr.short : ""} · ${fmtDate(search.start)} – ${fmtDate(search.end)} · ${search.days} day${search.days > 1 ? "s" : ""}`;
    updateBreakdown();
    if (window.VeloraChat) window.VeloraChat.minimize();
    modal.showModal();
  }

  $("#reserveForm").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const name = $("#mName"), email = $("#mEmail");
    if (!name.value.trim() || !email.checkValidity()) {
      e.preventDefault();
      (name.value.trim() ? email : name).reportValidity();
      return;
    }
    const q = currentQuote();
    const code = "VL-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const booking = {
      code, carId: q.car.id, carName: q.car.name, img: q.car.img, ...current.search,
      total: q.total, name: name.value.trim(), email: email.value.trim(), createdAt: Date.now(),
    };
    saveBookings([booking, ...loadBookings()]);
    $("#confirmText").innerHTML = `${esc(booking.name.split(" ")[0])}, your <strong>${esc(q.car.name)}</strong> is reserved for ${fmtDate(booking.start)} – ${fmtDate(booking.end)}. Total ${money(q.total)}, paid at pickup. Confirmation sent to ${esc(booking.email)}.`;
    $("#confirmCode").textContent = code;
    setTimeout(() => $("#confirmModal").showModal(), 150);
  });

  /* ---------- Manage bookings ---------- */
  function renderBookings() {
    const list = loadBookings();
    $("#bookingsList").innerHTML = list.length
      ? list.map((b) => `
        <div class="booking-item">
          <img src="${b.img}" alt="" />
          <div><strong>${esc(b.carName)}</strong> · <code>${b.code}</code><br/>
          <span class="muted">${fmtDate(b.start)} – ${fmtDate(b.end)} · ${esc(loc(b.pickup).short)} · ${money(b.total)}</span></div>
          <button data-cancel="${b.code}">Cancel</button>
        </div>`).join("")
      : `<p class="muted">No bookings yet. Your reservations will appear here.</p>`;
  }
  $("#myBookingsBtn").addEventListener("click", () => { renderBookings(); $("#bookingsModal").showModal(); });
  $("#bookingsList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cancel]");
    if (!b) return;
    e.preventDefault();
    saveBookings(loadBookings().filter((x) => x.code !== b.dataset.cancel));
    renderBookings();
  });

  // close modals by clicking the backdrop
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  renderFleet();

  /* ---------- Public API for the chatbot ---------- */
  window.VeloraApp = {
    openReserve,
    getSearch: () => state.search || readSearch(),
    setSearch({ pickup, dropoff, start, end, age }) {
      if (pickup) { pickupSel.value = pickup; dropoffSel.value = dropoff || pickup; }
      if (dropoff) dropoffSel.value = dropoff;
      if (start) startInp.value = start;
      if (end) endInp.value = end;
      if (age) ageInp.value = age;
      if (endInp.value <= startInp.value) endInp.value = isoDate(addDays(new Date(startInp.value + "T12:00:00"), 3));
      state.search = readSearch();
      renderFleet();
    },
    showCategory(cat) { setFilter(categories.includes(cat) ? cat : "All"); $("#fleet").scrollIntoView({ behavior: "smooth" }); },
    bookings: loadBookings,
  };
})();
