const esc = (str = '') =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const carrierSel = document.getElementById('carrier');
const statusSel = document.getElementById('status');
const updateStatusSel = document.getElementById('update-status');
const listEl = document.getElementById('list');

// Redirect to login if the server says we're not (or no longer) authenticated.
function guard(res) {
  if (res.status === 401) {
    location.replace('/login.html');
    throw new Error('Not authenticated.');
  }
  return res;
}

// Sign out.
document.getElementById('logout-link').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  location.replace('/login.html');
});

const createForm = document.getElementById('create-form');
const updateForm = document.getElementById('update-form');
const createMsg = document.getElementById('create-msg');
const updateMsg = document.getElementById('update-msg');

function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'form-msg ' + (ok ? 'ok' : 'err');
}

// Success message with a link to open the shipment's tracking page.
function setMsgWithLink(el, text, tn) {
  el.className = 'form-msg ok';
  el.innerHTML = `${esc(text)} · <a href="/?tn=${encodeURIComponent(tn)}" target="_blank" rel="noopener">View tracking →</a>`;
}

function openTracking(tn) {
  if (tn) window.open(`/?tn=${encodeURIComponent(tn)}`, '_blank');
}

// Quick track: open any number's public tracking page in a new tab.
document.getElementById('quick-track-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const tn = document.getElementById('quick-track-input').value.trim();
  openTracking(tn);
});

async function loadMeta() {
  const { carriers, statuses } = await (await fetch('/api/meta')).json();
  carrierSel.innerHTML = carriers
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join('');
  const opts = statuses
    .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`)
    .join('');
  statusSel.innerHTML = opts;
  updateStatusSel.innerHTML = opts;
}

// Generate a dummy tracking number for the selected carrier.
document.getElementById('gen-btn').addEventListener('click', async () => {
  const carrier = carrierSel.value;
  const { trackingNumber } = await guard(
    await fetch(`/api/tracking-number?carrier=${encodeURIComponent(carrier)}`)
  ).json();
  document.getElementById('trackingNumber').value = trackingNumber;
});

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  Object.keys(data).forEach((k) => {
    if (typeof data[k] === 'string') data[k] = data[k].trim();
  });
  return data;
}

// Create shipment
createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(createForm);
  try {
    const res = guard(
      await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create shipment.');
    setMsgWithLink(createMsg, `Created ${body.trackingNumber}`, body.trackingNumber);
    createForm.reset();
    document.getElementById('update-tn').value = body.trackingNumber;
    loadList();
  } catch (err) {
    setMsg(createMsg, err.message, false);
  }
});

// Update status
updateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(updateForm);
  const tn = data.trackingNumber;
  delete data.trackingNumber;
  try {
    const res = guard(
      await fetch(`/api/packages/${encodeURIComponent(tn)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to update.');
    setMsgWithLink(
      updateMsg,
      `Updated ${body.trackingNumber} → ${body.status}`,
      body.trackingNumber
    );
    loadList();
  } catch (err) {
    setMsg(updateMsg, err.message, false);
  }
});

// List + actions
async function loadList() {
  const packages = await guard(await fetch('/api/packages')).json();
  if (!packages.length) {
    listEl.innerHTML = `<p class="empty">No shipments yet. Create one above.</p>`;
    return;
  }
  listEl.innerHTML = packages
    .map(
      (p) => `
      <div class="list-item">
        <button class="li-tn" data-track="${esc(p.trackingNumber)}" title="Open tracking page">${esc(p.trackingNumber)}</button>
        <span class="li-carrier">${esc(p.carrier)}</span>
        <span class="li-desc">${esc(p.description || '—')} · ${esc(p.status)}</span>
        <span class="li-actions">
          <button data-track="${esc(p.trackingNumber)}" class="ghost">View</button>
          <button data-use="${esc(p.trackingNumber)}" class="ghost">Update</button>
          <button data-del="${esc(p.trackingNumber)}" class="danger">Delete</button>
        </span>
      </div>`
    )
    .join('');
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.dataset.track) {
    openTracking(btn.dataset.track);
  } else if (btn.dataset.use) {
    document.getElementById('update-tn').value = btn.dataset.use;
    updateForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (btn.dataset.del) {
    if (!confirm(`Delete ${btn.dataset.del}?`)) return;
    await fetch(`/api/packages/${encodeURIComponent(btn.dataset.del)}`, {
      method: 'DELETE',
    });
    loadList();
  }
});

document.getElementById('refresh-btn').addEventListener('click', loadList);

loadMeta().then(loadList);
