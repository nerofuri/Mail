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
const updateTn = document.getElementById('update-tn');
const eventsManage = document.getElementById('events-manage');

const updateSubmit = document.getElementById('update-submit');
const editCancel = document.getElementById('edit-cancel');
const updateTime = document.getElementById('update-time');
const simulateBtn = document.getElementById('simulate-btn');

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Convert an ISO string to the value a <input type="datetime-local"> expects
// (local time, no seconds).
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

let shownTn = null; // tracking number currently rendered in the manage list
let editIndex = null; // index of the event being edited, or null for "add"

function exitEditMode() {
  editIndex = null;
  updateSubmit.textContent = 'Add update';
  editCancel.hidden = true;
  updateForm.querySelector('[name="location"]').value = '';
  updateForm.querySelector('[name="note"]').value = '';
  updateTime.value = toLocalInput();
}

function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'form-msg ' + (ok ? 'ok' : 'err');
}

// Inline two-click confirmation (no native confirm() dialog, which some
// browsers suppress after repeated prompts). First click arms the button
// ("Confirm?"), a second click within 3s confirms.
function armConfirm(btn) {
  if (btn._armed) {
    clearTimeout(btn._t);
    btn._armed = false;
    btn.textContent = btn._label;
    btn.classList.remove('confirming');
    return true;
  }
  btn._label = btn.textContent;
  btn._armed = true;
  btn.textContent = 'Confirm?';
  btn.classList.add('confirming');
  btn._t = setTimeout(() => {
    btn._armed = false;
    btn.textContent = btn._label;
    btn.classList.remove('confirming');
  }, 3000);
  return false;
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

// Add a new update, or save edits to an existing one.
updateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(updateForm);
  const tn = data.trackingNumber;
  delete data.trackingNumber;
  // Convert the local date/time to ISO (or drop it to default to "now").
  if (data.timestamp) data.timestamp = new Date(data.timestamp).toISOString();
  else delete data.timestamp;
  if (!data.estimatedDelivery) delete data.estimatedDelivery;

  const editing = editIndex !== null;
  const url = editing
    ? `/api/packages/${encodeURIComponent(tn)}/events/${editIndex}`
    : `/api/packages/${encodeURIComponent(tn)}/events`;

  try {
    const res = guard(
      await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to save update.');
    setMsgWithLink(
      updateMsg,
      editing
        ? `Saved changes to ${body.trackingNumber}`
        : `Updated ${body.trackingNumber} → ${body.status}`,
      body.trackingNumber
    );
    exitEditMode();
    loadEvents(tn);
    loadList();
  } catch (err) {
    setMsg(updateMsg, err.message, false);
  }
});

editCancel.addEventListener('click', () => {
  exitEditMode();
  setMsg(updateMsg, '', true);
});

// Simulate a full delivery for the tracking number in the update field.
async function simulate(tn) {
  tn = (tn || '').trim();
  if (!tn) {
    setMsg(updateMsg, 'Enter a tracking number first.', false);
    return;
  }
  try {
    const res = guard(
      await fetch(`/api/packages/${encodeURIComponent(tn)}/simulate`, {
        method: 'POST',
      })
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to simulate delivery.');
    setMsgWithLink(updateMsg, `Simulated delivery for ${tn}`, tn);
    exitEditMode();
    updateTn.value = tn;
    loadEvents(tn);
    loadList();
  } catch (err) {
    setMsg(updateMsg, err.message, false);
  }
}

simulateBtn.addEventListener('click', () => {
  if (!updateTn.value.trim()) {
    setMsg(updateMsg, 'Enter a tracking number first.', false);
    return;
  }
  if (!armConfirm(simulateBtn)) return; // first click arms, second simulates
  simulate(updateTn.value);
});

// Show a shipment's existing updates (with a delete button on each).
async function loadEvents(tn) {
  tn = (tn || '').trim();
  if (!tn) {
    eventsManage.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/track/${encodeURIComponent(tn)}`);
  if (res.status === 404) {
    eventsManage.innerHTML = `<p class="empty">No shipment found for “${esc(tn)}”.</p>`;
    return;
  }
  if (!res.ok) {
    eventsManage.innerHTML = '';
    return;
  }
  const pkg = await res.json();
  shownTn = pkg.trackingNumber;
  // Keep original array index (used for edit/delete), display newest first.
  const events = pkg.events
    .map((e, i) => ({ ...e, _i: i }))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  eventsManage.innerHTML = `
    <h3 class="section-title">Updates for ${esc(pkg.trackingNumber)} (${events.length})</h3>
    <ul class="ev-list">
      ${events
        .map(
          (e) => `
        <li class="ev-item">
          <div class="ev-main">
            <span class="ev-status">${esc(e.status)}</span>
            <span class="ev-meta">${esc(fmt(e.timestamp))}${e.location ? ' · ' + esc(e.location) : ''}</span>
            ${e.note ? `<span class="ev-note">${esc(e.note)}</span>` : ''}
          </div>
          <span class="ev-actions">
            <button type="button" class="ev-edit" title="Edit this update"
              data-edit-ev="${e._i}" data-tn="${esc(pkg.trackingNumber)}"
              data-status="${esc(e.status)}" data-location="${esc(e.location || '')}"
              data-note="${esc(e.note || '')}" data-time="${esc(e.timestamp || '')}">Edit</button>
            <button type="button" class="ev-del" title="Delete this update"
              data-del-ev="${e._i}" data-tn="${esc(pkg.trackingNumber)}"
              ${events.length <= 1 ? 'disabled' : ''}>Delete</button>
          </span>
        </li>`
        )
        .join('')}
    </ul>`;
}

// Load an existing event into the form for editing. Reads the event's data
// straight off the button, so it never depends on stale in-memory state.
function startEdit(btn) {
  updateTn.value = btn.dataset.tn;
  updateStatusSel.value = btn.dataset.status;
  updateForm.querySelector('[name="location"]').value = btn.dataset.location || '';
  updateForm.querySelector('[name="note"]').value = btn.dataset.note || '';
  updateTime.value = toLocalInput(btn.dataset.time || undefined);
  editIndex = Number.parseInt(btn.dataset.editEv, 10);
  updateSubmit.textContent = 'Save changes';
  editCancel.hidden = false;
  setMsg(updateMsg, 'Editing an existing update — change fields and Save.', true);
  updateForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Manage-list actions: edit or delete a single update.
eventsManage.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('button[data-edit-ev]');
  if (editBtn) {
    startEdit(editBtn);
    return;
  }
  const btn = e.target.closest('button[data-del-ev]');
  if (!btn) return;
  if (!armConfirm(btn)) return; // first click arms, second click deletes
  const tn = btn.dataset.tn;
  try {
    const res = guard(
      await fetch(
        `/api/packages/${encodeURIComponent(tn)}/events/${btn.dataset.delEv}`,
        { method: 'DELETE' }
      )
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to delete update.');
    setMsg(updateMsg, 'Update deleted.', true);
    loadEvents(tn);
    loadList();
  } catch (err) {
    setMsg(updateMsg, err.message, false);
  }
});

// Auto-load a shipment's updates when the tracking number field changes — but
// NOT if it already shows that shipment, so clicking Edit/Delete (which blurs
// this field) never rebuilds the list out from under the click.
function maybeLoadEvents() {
  const tn = updateTn.value.trim().toUpperCase();
  if (tn && tn === shownTn) return;
  if (editIndex !== null) exitEditMode();
  loadEvents(updateTn.value);
}
updateTn.addEventListener('change', maybeLoadEvents);

// Enter in the tracking-number field should load the shipment, not submit the
// form (which would add an unintended update).
updateTn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    maybeLoadEvents();
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
          <button data-sim="${esc(p.trackingNumber)}" class="ghost">Simulate</button>
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
    updateTn.value = btn.dataset.use;
    exitEditMode();
    loadEvents(btn.dataset.use);
    updateForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (btn.dataset.sim) {
    if (!armConfirm(btn)) return;
    simulate(btn.dataset.sim);
  } else if (btn.dataset.del) {
    if (!armConfirm(btn)) return;
    try {
      const res = guard(
        await fetch(`/api/packages/${encodeURIComponent(btn.dataset.del)}`, {
          method: 'DELETE',
        })
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete shipment.');
      }
      loadList();
    } catch (err) {
      setMsg(updateMsg, err.message, false);
    }
  }
});

document.getElementById('refresh-btn').addEventListener('click', loadList);

updateTime.value = toLocalInput(); // default the date/time to now
loadMeta().then(loadList);
