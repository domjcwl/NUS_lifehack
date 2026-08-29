const ITEMS = [
  {
    tag: "NUS",
    title: "Blue bin contamination is the campus bottleneck",
    body: "A single unrinsed container can send a whole bag to incineration. Rinsing is the highest-leverage habit on this list.",
  },
  {
    tag: "Singapore",
    title: "The national recycling rate has stalled",
    body: "Domestic recycling has hovered around the same level for years. The gap is behavioural, not infrastructural — bins exist; sorting does not happen.",
  },
  {
    tag: "Explainer",
    title: "Why soft plastics are not accepted",
    body: "Bags and wrappers jam sorting machinery at materials recovery facilities. They belong in general waste unless a dedicated collection point exists.",
  },
  {
    tag: "Explainer",
    title: "Bubble tea cups are two materials",
    body: "The cup is usually recyclable once rinsed; the sealed film and straw are not. Separating them takes about four seconds.",
  },
];

export default function News() {
  return (
    <div className="space-y-5 rise">
      <header>
        <p className="mono text-[10px] text-[var(--ink-soft)]">Context, not lecture</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Worth knowing</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Short and practical. Information is not what changes behaviour — the streak does
          that — but knowing why the rules exist makes them easier to follow.
        </p>
      </header>

      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-3">
        <p className="mono text-[10px] text-[var(--gold)]">Sample content</p>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Written for the prototype. A live build would pull from NEA and campus sustainability
          feeds.
        </p>
      </div>

      <ul className="space-y-3">
        {ITEMS.map((it) => (
          <li key={it.title} className="card px-5 py-4">
            <p className="mono text-[10px] text-[var(--sea)]">{it.tag}</p>
            <h2 className="mt-1.5 font-medium">{it.title}</h2>
            <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{it.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
