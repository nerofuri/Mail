const form = document.getElementById('login-form');
const msg = document.getElementById('login-msg');

// If already signed in, skip straight to the admin panel.
fetch('/api/session')
  .then((r) => r.json())
  .then((s) => {
    if (s.authenticated) location.replace('/admin.html');
  })
  .catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Sign in failed.');
    location.replace('/admin.html');
  } catch (err) {
    msg.className = 'form-msg err';
    msg.textContent = err.message;
  }
});
