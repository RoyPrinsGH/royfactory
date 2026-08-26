const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

/* Enquiries live in memory — this is the demo build, the production one
 * writes through to the CRM. */
const enquiries = [];
let seq = 1040;

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 100_000) { req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function inboxPage() {
  const rows = enquiries.map((e) => `
      <tr>
        <td class="ref">${esc(e.ref)}</td>
        <td>${esc(e.name) || '<i>—</i>'}</td>
        <td>${esc(e.email) || '<i>—</i>'}</td>
        <td>${esc(e.phone) || '<i>—</i>'}</td>
        <td>${esc(e.property)}</td>
        <td>${esc(e.services.join(', ')) || '<i>—</i>'}</td>
        <td>${esc(e.budget)}</td>
        <td class="msg">${esc(e.message)}</td>
        <td class="when">${esc(e.received.replace('T', ' ').slice(0, 19))}</td>
      </tr>`).join('');

  return `<!doctype html><meta charset="utf-8"><title>Enquiry inbox · Halden &amp; Roe</title>
<style>
  body{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0;background:#f6f4f0;color:#2c2823}
  header{padding:18px 24px;background:#2c2823;color:#f6f4f0}
  h1{margin:0;font:600 15px/1.3 Georgia,serif;letter-spacing:.3px}
  p.sub{margin:3px 0 0;font-size:12px;color:#a89b8b}
  table{border-collapse:collapse;width:100%;background:#fff}
  th{text-align:left;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;
     color:#8a8178;padding:10px 12px;border-bottom:1px solid #e2ddd5}
  td{padding:10px 12px;border-bottom:1px solid #efebe5;vertical-align:top}
  td i{color:#c4bdb2}
  .ref{font-family:ui-monospace,monospace;color:#8a6a4f;white-space:nowrap}
  .msg{max-width:280px;color:#6b635a}
  .when{color:#a09789;white-space:nowrap;font-size:12px}
  .empty{padding:44px;text-align:center;color:#a09789;background:#fff}
</style>
<header><h1>Enquiry inbox</h1><p class="sub">${enquiries.length} enquir${enquiries.length === 1 ? 'y' : 'ies'} · demo build</p></header>
${enquiries.length ? `<table>
  <tr><th>Ref</th><th>Name</th><th>Email</th><th>Phone</th><th>Property</th>
      <th>Services</th><th>Budget</th><th>Message</th><th>Received</th></tr>
  ${rows}
</table>` : '<div class="empty">No enquiries yet.</div>'}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  if (req.method === 'GET' && url.pathname === '/inbox') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(inboxPage());
  }

  if (req.method === 'POST' && url.pathname === '/api/quote') {
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Malformed request.' }));
    }

    if (!clean(data.name) || !clean(data.email)) {
      res.writeHead(422, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Name and email are required.' }));
    }

    const ref = 'HR-' + ++seq;
    enquiries.unshift({
      ref,
      received: new Date().toISOString(),
      name:     clean(data.name, 120),
      email:    clean(data.email, 160),
      phone:    clean(data.phone, 40),
      property: clean(data.property, 40),
      budget:   clean(data.budget, 40),
      services: Array.isArray(data.services) ? data.services.map((s) => clean(s, 40)) : [],
      message:  clean(data.message, 2000),
    });

    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ref }));
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  process.stdout.write(`Halden & Roe running on http://localhost:${PORT}  (inbox: /inbox)\n`);
});
