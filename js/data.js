/* =========================================================
   Velora — business knowledge base
   Single source of truth for the website AND the chatbot.
   Edit prices, policies and locations here; everything else
   (fleet cards, quotes, AI system prompt) updates automatically.
   ========================================================= */

window.VELORA = {
  company: {
    name: "Velora",
    tagline: "Rent the drive, not the hassle.",
    phone: "(813) 555-0142",
    email: "hello@velora-rentals.example",
    whatsapp: "(813) 555-0199",
    supportHours: "Phone & chat support 24/7. Counters open 6:00 AM – 11:00 PM daily.",
  },

  locations: [
    { id: "tpa", name: "Tampa International Airport (TPA)", short: "Tampa Airport", address: "4100 George J Bean Pkwy, Rental Car Center, Level 2", hours: "24/7", airport: true },
    { id: "dtt", name: "Downtown Tampa", short: "Downtown Tampa", address: "401 N Ashley Dr, Tampa, FL", hours: "7:00 AM – 9:00 PM", airport: false },
    { id: "mco", name: "Orlando International Airport (MCO)", short: "Orlando Airport", address: "1 Jeff Fuqua Blvd, Terminal C Garage", hours: "24/7", airport: true },
    { id: "mia", name: "Miami International Airport (MIA)", short: "Miami Airport", address: "3900 NW 25th St, Rental Car Center", hours: "24/7", airport: true },
  ],

  fleet: [
    { id: "fiat-500", name: "Fiat 500", category: "Economy", price: 39, seats: 4, bags: 1, doors: 2, transmission: "Automatic", fuel: "Gas", mpg: "33 mpg", minAge: 21, img: "assets/img/fiat-500.jpg", tags: ["cheap", "budget", "city", "parking", "solo", "couple"], blurb: "Tiny footprint, huge personality. Parks anywhere in Ybor or South Beach." },
    { id: "vw-polo", name: "Volkswagen Polo", category: "Compact", price: 45, seats: 5, bags: 2, doors: 4, transmission: "Automatic", fuel: "Gas", mpg: "35 mpg", minAge: 21, img: "assets/img/vw-polo.jpg", tags: ["cheap", "budget", "city", "economical", "commute"], blurb: "Efficient, comfy and easy on the wallet for everyday errands." },
    { id: "toyota-camry", name: "Toyota Camry", category: "Midsize Sedan", price: 58, seats: 5, bags: 3, doors: 4, transmission: "Automatic", fuel: "Hybrid", mpg: "52 mpg", minAge: 21, img: "assets/img/toyota-camry.jpg", tags: ["business", "comfortable", "reliable", "hybrid", "road trip"], blurb: "The do-everything sedan — quiet, roomy and sips fuel." },
    { id: "tesla-model-3", name: "Tesla Model 3", category: "Electric", price: 79, seats: 5, bags: 2, doors: 4, transmission: "Automatic", fuel: "Electric", mpg: "272 mi range", minAge: 21, img: "assets/img/tesla-model-3.jpg", tags: ["electric", "ev", "eco", "green", "tech", "autopilot"], blurb: "Zero emissions, instant torque, Supercharger access included." },
    { id: "honda-crv", name: "Honda CR-V", category: "SUV", price: 72, seats: 5, bags: 4, doors: 4, transmission: "Automatic", fuel: "Gas", mpg: "30 mpg", minAge: 21, img: "assets/img/honda-crv.jpg", tags: ["family", "suv", "luggage", "beach", "road trip", "pets"], blurb: "Room for the beach gear, the cooler and everyone's opinions." },
    { id: "ford-expedition", name: "Ford Expedition", category: "Full-size SUV", price: 115, seats: 8, bags: 6, doors: 4, transmission: "Automatic", fuel: "Gas", mpg: "19 mpg", minAge: 21, img: "assets/img/ford-expedition.jpg", tags: ["family", "group", "large", "7 seats", "8 seats", "suv", "luggage", "theme parks", "pets"], blurb: "Eight seats and serious cargo space for the whole crew." },
    { id: "bmw-m5", name: "BMW M5", category: "Luxury", price: 189, seats: 5, bags: 3, doors: 4, transmission: "Automatic", fuel: "Gas", mpg: "17 mpg", minAge: 25, img: "assets/img/bmw-m5.jpg", tags: ["luxury", "business", "executive", "fast", "premium"], blurb: "Boardroom manners with a 600-hp alter ego." },
    { id: "ford-mustang", name: "Ford Mustang GT", category: "Sports", price: 129, seats: 4, bags: 2, doors: 2, transmission: "Automatic", fuel: "Gas", mpg: "18 mpg", minAge: 25, img: "assets/img/ford-mustang.jpg", tags: ["sports", "fun", "v8", "muscle", "weekend", "date"], blurb: "American V8 soundtrack for your Gulf Coast weekend." },
    { id: "porsche-panamera", name: "Porsche Panamera", category: "Exotic", price: 289, seats: 4, bags: 2, doors: 4, transmission: "Automatic", fuel: "Gas", mpg: "21 mpg", minAge: 30, img: "assets/img/porsche-panamera.jpg", tags: ["exotic", "luxury", "wedding", "special occasion", "premium", "fast"], blurb: "Arrive like you mean it. Weddings, anniversaries, big deals." },
  ],

  pricing: {
    currency: "USD",
    taxRate: 0.075,            // FL sales tax
    surchargePerDay: 2,        // FL rental car surcharge
    airportFeeRate: 0.10,      // concession recovery fee at airport locations
    youngDriverFeePerDay: 25,  // drivers aged 21–24
    weeklyDiscount: 0.15,      // 7+ days
    monthlyDiscount: 0.30,     // 28+ days
    oneWayFee: 75,             // between any two Velora locations
    deliveryFee: 29,           // delivery to a Tampa/Orlando/Miami hotel or home, each way
  },

  protection: [
    { id: "basic", name: "Basic Liability", price: 0, desc: "State-minimum liability included with every rental." },
    { id: "standard", name: "Standard Cover", price: 19, desc: "Collision damage waiver with a $500 deductible, theft protection." },
    { id: "premium", name: "Premium Zero", price: 34, desc: "$0 deductible, tire & glass, roadside assistance, lockout service." },
  ],

  extras: [
    { id: "child-seat", name: "Child / booster seat", price: 12, unit: "day", cap: 72 },
    { id: "extra-driver", name: "Additional driver", price: 10, unit: "day", note: "Spouse / domestic partner is free." },
    { id: "sunpass", name: "SunPass toll transponder", price: 5.99, unit: "day", cap: 29.99, note: "Plus actual tolls at the cash-free rate." },
    { id: "wifi", name: "Mobile Wi-Fi hotspot", price: 8, unit: "day" },
    { id: "beach-kit", name: "Beach kit (2 chairs, umbrella, cooler)", price: 15, unit: "rental" },
  ],

  policies: {
    age: "Minimum age is 21 for Economy through Full-size SUV. Luxury and Sports require 25+, Exotic requires 30+. Drivers aged 21–24 pay a $25/day young-driver fee.",
    license: "A valid, unexpired driver's license held for at least 1 year. International visitors: a license in the Latin alphabet plus passport is accepted; otherwise bring an International Driving Permit (IDP) with your home license.",
    payment: "We accept Visa, Mastercard, Amex, Discover, Apple Pay and Google Pay. Debit cards are accepted for Economy–SUV classes with a valid return travel itinerary. Cash is not accepted for deposits.",
    deposit: "A refundable security hold of $200 is placed at pickup ($500 for Luxury, Sports and Exotic). It's released within 3–5 business days after return.",
    cancellation: "Free cancellation up to 24 hours before pickup. Within 24 hours a $50 fee applies. No-shows are charged one rental day.",
    modification: "Change dates, car or location any time in 'Manage booking' or via chat — you only pay the price difference.",
    mileage: "Unlimited mileage on all cars except Exotic, which includes 200 miles/day (then $0.75/mile). Travel to Georgia, Alabama and the Carolinas is allowed; other states require approval.",
    fuel: "Pick up full, return full. Or prepay a tank at local pump prices and return it empty. Missing fuel is charged at $9.99/gallon. Electric cars: return with at least 20% charge or pay a $35 recharge fee. Supercharging during the rental is free.",
    lateReturn: "29-minute grace period. After that, $15 per hour up to the cost of one extra day.",
    pets: "Pets are welcome in SUVs and the Camry in a carrier or with a seat cover. A $50 cleaning fee applies only if the car comes back with pet hair.",
    smoking: "All cars are non-smoking (including vaping). Violation fee: $250.",
    insurance: "Your personal auto policy or credit card often covers rentals — check before you buy. Basic liability is always included; Standard ($19/day) and Premium Zero ($34/day) are optional.",
    roadside: "24/7 roadside assistance at (813) 555-0142. Included free with Premium Zero; otherwise $69 per call-out for lockouts, jump starts or flat tires not caused by a mechanical fault.",
    pickup: "Skip the counter: check in on your phone, get a digital key or locker code, and walk straight to your car. Airport shuttles run every 8 minutes.",
    longTerm: "7+ days saves 15%. 28+ days saves 30% and includes a free maintenance swap.",
    crossBorder: "Our cars can't be taken outside the US (no Mexico, Canada, or ferry trips to the Bahamas).",
    cleaning: "Every car is professionally cleaned and sanitized between rentals. Return it reasonably tidy; excessive sand or mess is $75.",
  },

  promos: [
    { code: "FIRSTDRIVE", desc: "10% off your first rental" },
    { code: "WEEKENDER", desc: "Pick up Fri, return Mon — get Sunday free on Sports & Luxury" },
  ],
};

/* ---------- Shared pricing engine (used by booking UI + chatbot) ---------- */
window.VELORA.quote = function ({ carId, days = 1, pickupId = "tpa", dropoffId, age = 30, protection = "basic", extras = [], promo = "" }) {
  const V = window.VELORA, P = V.pricing;
  const car = V.fleet.find((c) => c.id === carId);
  if (!car) return null;
  days = Math.max(1, Math.round(days));
  const lines = [];
  const base = car.price * days;
  lines.push({ label: `${car.name} × ${days} day${days > 1 ? "s" : ""} @ $${car.price}`, amount: base });

  let discount = 0;
  if (days >= 28) discount = base * P.monthlyDiscount;
  else if (days >= 7) discount = base * P.weeklyDiscount;
  if (discount) lines.push({ label: `${days >= 28 ? "Monthly" : "Weekly"} discount`, amount: -discount });

  if (promo && promo.toUpperCase() === "FIRSTDRIVE") {
    const d = (base - discount) * 0.1;
    lines.push({ label: "Promo FIRSTDRIVE (10%)", amount: -d });
    discount += d;
  }

  const prot = V.protection.find((p) => p.id === protection) || V.protection[0];
  if (prot.price) lines.push({ label: `${prot.name} × ${days}`, amount: prot.price * days });

  extras.forEach((id) => {
    const e = V.extras.find((x) => x.id === id);
    if (!e) return;
    let amt = e.unit === "day" ? e.price * days : e.price;
    if (e.cap) amt = Math.min(amt, e.cap);
    lines.push({ label: e.name, amount: amt });
  });

  if (age >= 21 && age < 25) lines.push({ label: `Young driver fee × ${days}`, amount: P.youngDriverFeePerDay * days });
  if (dropoffId && dropoffId !== pickupId) lines.push({ label: "One-way fee", amount: P.oneWayFee });

  const pickup = V.locations.find((l) => l.id === pickupId);
  const rentalNet = base - discount;
  if (pickup && pickup.airport) lines.push({ label: "Airport concession fee (10%)", amount: rentalNet * P.airportFeeRate });
  lines.push({ label: "FL rental surcharge", amount: P.surchargePerDay * days });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = subtotal * P.taxRate;
  lines.push({ label: "Sales tax (7.5%)", amount: tax });
  const total = subtotal + tax;

  const eligible = age >= car.minAge;
  return { car, days, lines, total, perDay: total / days, eligible };
};

window.VELORA.money = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
