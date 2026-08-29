# Sustainability primer — LifeHack 2026

Our broad topic is **sustainability**. This is background gathered before the briefs dropped so
we do not spend build time on it. Treat as orientation, not as the brief.

---

## Ecovolt — the likely partner behind a sustainability brief

Researched 29 Aug 2026. Sources: ecovolt.ai, NUS News, OpenGov Asia, GovInsider.

**What they are.** A Singapore startup — "AI for the built environment" — founded by NUS
students who met at the **SDG Open Hack in 2024**, incubated at **BLOCK71 SIH** since April 2025.
Positioning: *AI Building Orchestration System* / AI-native cloud BMS (building management
system).

**The core insight they built on: idle plug load.** Electricity consumed by devices that stay
plugged in but are not actively used. It is invisible on a normal utility bill because the meter
only sees the building total, so nobody can attribute or act on it.

**Hardware.** Custom adapters, socket plates and extension cords — i.e. smart plugs — that meter
and transmit plug-level consumption. Over **1,500 smart plugs deployed**.

**Software.** A cloud platform aggregating plug-level → room → building → portfolio:
- Circuit-level energy monitoring, with fault and surge detection
- HVAC control with dynamic demand-based cooling and airflow
- Lighting and fan control per space
- Two named UIs: **Everest** (desktop, full visibility and control) and **Base** (simplified
  mobile view for on-the-ground operators)

**Claimed impact.** 8–20% energy reduction; ~100 tonnes CO₂ prevented this year. Deployed at
**NUS** and **Nanyang Junior College** — education campuses are their beachhead.

**What this tells us about how they think.** They care about (a) granular attribution of energy
to a responsible party, (b) turning that into an *action* rather than a dashboard, and (c) two
distinct user personas — a facilities manager at a desk and an operator on their feet. If their
brief is open-ended, solutions that respect those three things will land better than a generic
"green dashboard".

---

## The trap to avoid

The default sustainability hackathon project is **a dashboard that visualises consumption**.
Every year, many teams build it, and it demos poorly because a chart does not show a decision.
The differentiator in this space is almost always one of:

- **Attribution** — whose consumption is this, and who can act on it?
- **Counterfactual** — what would have been used if nothing changed? Savings are only credible
  against a baseline.
- **Action / closing the loop** — the system does something (schedules, switches off, nudges,
  raises a ticket), not just reports.
- **Behaviour** — the hard part of building energy is people, not equipment.

If we end up with a dashboard, make sure it answers "so what do I do now?" on the same screen.

## Metrics that make a sustainability demo credible

Judges from this domain probe numbers. Have these straight:

- **kWh** consumed/saved, and **cost** at a real tariff (Singapore commercial electricity is
  roughly S$0.25–0.35/kWh — cite whatever figure you use).
- **Emissions**: kWh × grid emission factor. Singapore's grid factor is roughly
  **0.4 kg CO₂e/kWh** — Singapore is almost entirely natural gas, so this is much lower than
  coal-heavy grids. Cite EMA if you use it.
- **Baseline vs. actual** — a saving claim without a stated baseline is not a claim.
- **Payback period** if there is hardware cost.

Be honest that prototype numbers are simulated or extrapolated. Judges respect a clearly stated
assumption far more than a confident fake number, and they *will* ask where it came from.

## Data sources worth knowing (verify before relying on any)

- **data.gov.sg** — Singapore open data: energy consumption, environment, transport, waste.
- **EMA (Energy Market Authority)** — grid emission factor, electricity tariffs, consumption stats.
- **NEA** — weather, air quality, waste and recycling statistics.
- **BCA Green Mark** — Singapore's green building rating scheme. Useful vocabulary if the brief
  is buildings-focused.
- **OneMap / data.gov.sg** — building footprints and geospatial layers.
- **Open-Meteo** — free weather API, no key, useful for correlating cooling load with temperature.
- **Electricity Maps** — grid carbon intensity by region (free tier).

Simulating a plausible sensor stream is usually faster and more reliable for a 24-hour demo than
wiring up a real dataset — just **say clearly in the demo that it is simulated** and make the
simulation realistic (daily and weekly cycles, occupancy patterns, noise).

## Vocabulary to use correctly

Getting these right signals credibility to a domain judge; getting them wrong costs you.

- **Plug load** — energy drawn by devices plugged into sockets, as opposed to fixed building
  systems (HVAC, lifts, lighting).
- **BMS / BAS** — building management/automation system.
- **HVAC** — heating, ventilation, air-conditioning. In Singapore, cooling dominates and is
  typically the single largest load in a commercial building.
- **Demand response** — shifting or shedding load in response to grid or price signals.
- **Scope 1 / 2 / 3** — direct emissions / purchased electricity / value chain. Building
  electricity is **Scope 2**.
- **Emission factor** — kg CO₂e per kWh.
- **Submetering** — metering below the utility meter, per floor/room/circuit. This is what makes
  attribution possible.
- **Occupancy-based control** — driving systems from whether a space is actually in use.

## Common IoT protocols (if the brief involves real devices)

MQTT (pub/sub, the default for sensor telemetry), Modbus and BACnet (legacy building systems),
LoRaWAN (long range, low power), Zigbee/Z-Wave (home/building mesh). For a 24-hour prototype,
MQTT over a public broker or a simple WebSocket stream is almost always the right call.
