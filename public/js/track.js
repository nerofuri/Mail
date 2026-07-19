const form = document.getElementById('track-form');
const input = document.getElementById('track-input');
const result = document.getElementById('result');

const statusClass = (status) => {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('exception')) return 'exception';
  if (s.includes('returned')) return 'returned';
  if (s.includes('customs')) return 'customs';
  if (s.includes('out for')) return 'out';
  return '';
};

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const esc = (str = '') =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function render(pkg) {
  const events = [...pkg.events].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );

  const meta = [
    ['Carrier', pkg.carrier],
    ['From', pkg.origin || '—'],
    ['To', pkg.destination || '—'],
    ['Recipient', pkg.recipient || '—'],
    ['Est. delivery', fmtDate(pkg.estimatedDelivery)],
  ];

  result.innerHTML = `
    <div class="top">
      <div>
        <h2>${esc(pkg.description || 'Shipment')}</h2>
        <div class="tn">${esc(pkg.trackingNumber)}</div>
      </div>
      <span class="badge ${statusClass(pkg.status)}">${esc(pkg.status)}</span>
    </div>

    <div class="meta-grid">
      ${meta
        .map(
          ([k, v]) =>
            `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`
        )
        .join('')}
    </div>

    <ul class="timeline">
      ${events
        .map(
          (e, i) => `
        <li class="${i === 0 ? 'current' : ''}">
          <div class="t-status">${esc(e.status)}</div>
          <div class="t-meta">${fmt(e.timestamp)}${
            e.location ? ' · ' + esc(e.location) : ''
          }</div>
          ${e.note ? `<div class="t-note">${esc(e.note)}</div>` : ''}
        </li>`
        )
        .join('')}
    </ul>
  `;
  result.hidden = false;
}

function renderError(msg) {
  result.innerHTML = `<div class="error-box">${esc(msg)}</div>`;
  result.hidden = false;
}

async function track(tn) {
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(tn)}`);
    if (res.status === 404) {
      renderError(
        `No shipment found for "${tn}". Check the number, or create it in the Admin panel.`
      );
      return;
    }
    if (!res.ok) throw new Error('Something went wrong.');
    render(await res.json());
  } catch (err) {
    renderError(err.message || 'Unable to fetch tracking information.');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const tn = input.value.trim();
  if (tn) {
    history.replaceState(null, '', `?tn=${encodeURIComponent(tn)}`);
    track(tn);
  }
});

// Deep link support: /?tn=XXXX
const params = new URLSearchParams(location.search);
const initial = params.get('tn');
if (initial) {
  input.value = initial;
  track(initial);
}
