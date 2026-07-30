const form = document.getElementById('track-form');
const input = document.getElementById('track-input');
const result = document.getElementById('result');
const extras = document.getElementById('extras');
const btn = document.getElementById('track-btn');

// Journey stages for the progress stepper.
const STEP_LABELS = ['Shipped', 'In Transit', 'Arriving', 'Delivered'];
const STAGE = {
  'Label generated': { step: 0, pct: 8 },
  'Awaiting flight': { step: 0, pct: 30 },
  'Held at customs': { step: 1, pct: 62 },
  'Customs cleared': { step: 2, pct: 72 },
  'Label Created': { step: 0, pct: 8 },
  'Picked Up': { step: 0, pct: 22 },
  'In Transit': { step: 1, pct: 45 },
  'Customs Clearance': { step: 1, pct: 58 },
  'Arrived at Facility': { step: 2, pct: 70 },
  'Out for Delivery': { step: 2, pct: 90 },
  'Delivered': { step: 3, pct: 100 },
  'Exception': { step: 1, pct: 45, alert: true },
  'Returned to Sender': { step: 0, pct: 20, alert: true },
};

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
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const vehicleSVG = `<svg class="route-vehicle" width="22" height="22" viewBox="0 0 24 24" fill="none">
  <path d="M2 21l20-9L2 3v7l14 2-14 2z" fill="currentColor"/></svg>`;

function stepperHTML(status) {
  const stage = STAGE[status] || { step: 0, pct: 6 };
  const nodes = STEP_LABELS.map((label, i) => {
    let cls = '';
    if (i < stage.step) cls = 'done';
    else if (i === stage.step) cls = 'current';
    const check =
      i < stage.step
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
    return `<div class="step ${cls}"><span class="step-dot">${check}</span><span class="step-label">${label}</span></div>`;
  }).join('');

  return `
    <div class="stepper">
      <div class="stepper-track"><div class="stepper-fill" data-pct="${stage.pct}"></div></div>
      <div class="stepper-nodes">${nodes}</div>
    </div>`;
}

function routeHTML(pkg) {
  const stage = STAGE[pkg.status] || { pct: 6 };
  const short = (s) => (s || '—').split(',').slice(0, 2).join(',').trim();
  return `
    <div class="route">
      <div class="end from"><div class="k">From</div><div class="v">${esc(short(pkg.origin))}</div></div>
      <div class="route-line" data-pct="${stage.pct}">${vehicleSVG}</div>
      <div class="end to"><div class="k">To</div><div class="v">${esc(short(pkg.destination))}</div></div>
    </div>`;
}

function render(pkg) {
  const events = [...pkg.events].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );
  const meta = [
    ['Carrier', pkg.carrier],
    ['Recipient', pkg.recipient || '—'],
    ['Est. delivery', fmtDate(pkg.estimatedDelivery)],
  ];

  result.innerHTML = `
    <div class="top">
      <div>
        <h2>${esc(pkg.description || 'Shipment')}</h2>
        <div class="tn-row">
          <span class="tn">${esc(pkg.trackingNumber)}</span>
          <button class="copy-btn" id="copy-btn" title="Copy tracking number" aria-label="Copy tracking number">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
        </div>
      </div>
      <span class="badge ${statusClass(pkg.status)}">${esc(pkg.status)}</span>
    </div>

    ${stepperHTML(pkg.status)}
    ${routeHTML(pkg)}

    <div class="meta-grid">
      ${meta
        .map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`)
        .join('')}
    </div>

    <h3 class="section-title">Tracking history</h3>
    <ul class="timeline">
      ${events
        .map(
          (e, i) => `
        <li class="${i === 0 ? 'current' : ''}" style="animation-delay:${i * 70}ms">
          <div class="t-status">${esc(e.status)}</div>
          <div class="t-meta">${fmt(e.timestamp)}${e.location ? ' · ' + esc(e.location) : ''}</div>
          ${e.note ? `<div class="t-note">${esc(e.note)}</div>` : ''}
        </li>`
        )
        .join('')}
    </ul>
  `;
  result.hidden = false;
  if (extras) extras.hidden = true;

  // Animate progress fill + vehicle after paint.
  requestAnimationFrame(() => {
    const fill = result.querySelector('.stepper-fill');
    if (fill) fill.style.width = fill.dataset.pct + '%';
    const line = result.querySelector('.route-line');
    const vehicle = result.querySelector('.route-vehicle');
    if (line && vehicle) vehicle.style.left = line.dataset.pct + '%';
  });

  // Copy-to-clipboard.
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    const original = copyBtn.innerHTML;
    const check =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pkg.trackingNumber);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = check;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = original;
        }, 1500);
      } catch {
        /* clipboard blocked; ignore */
      }
    });
  }

  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSkeleton() {
  result.innerHTML = `
    <div class="skeleton" style="padding:0;border:0;margin:0;background:none">
      <div class="sk-row w40"></div>
      <div class="sk-row tall w60"></div>
      <div class="sk-row w80"></div>
      <div class="sk-row w60"></div>
      <div class="sk-row w80"></div>
    </div>`;
  result.hidden = false;
}

function renderError(tn) {
  result.innerHTML = `
    <div class="error-box">
      <span class="err-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v5M12 16.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      <div>
        <strong>No shipment found</strong><br />
        We couldn't find <code>${esc(tn)}</code>. Check the number, or create it in
        the <a href="/admin.html">Admin panel</a>.
      </div>
    </div>`;
  result.hidden = false;
  if (extras) extras.hidden = false;
}

async function track(tn) {
  btn.classList.add('loading');
  renderSkeleton();
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(tn)}`);
    if (res.status === 404) return renderError(tn);
    if (!res.ok) throw new Error('Something went wrong.');
    render(await res.json());
  } catch (err) {
    result.innerHTML = `<div class="error-box"><span class="err-icon">!</span><div>${esc(
      err.message || 'Unable to fetch tracking information.'
    )}</div></div>`;
    result.hidden = false;
  } finally {
    btn.classList.remove('loading');
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

// Deep link: /?tn=XXXX
const params = new URLSearchParams(location.search);
const initial = params.get('tn');
if (initial) {
  input.value = initial;
  track(initial);
}
