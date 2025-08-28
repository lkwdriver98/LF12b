(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}

  function $(s){return document.querySelector(s)}
  function $all(s){return document.querySelectorAll(s)}

  const TOKEN_KEY='tf_token', STORAGE='tf_user';

  function token(){ return localStorage.getItem(TOKEN_KEY) || ''; }
  function user(){ try{ return JSON.parse(localStorage.getItem(STORAGE)||'null'); }catch{ return null; } }

  function setStatus(msg){ const el = $('#adminStatus'); if(el) el.textContent = msg; }

  function enableCsv(enabled){
    const btn = $('#exportCsvBtn');
    if(!btn) return;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '' : '0.6';
    btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
  }

  async function authedJSON(url, opts={}){
    const r = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token()}`,
        ...(opts.headers||{})
      }
    });
    // Versuche JSON, auch bei Fehler
    let data = {};
    try { data = await r.json(); } catch {}
    if(!r.ok){
      const msg = data?.error || `HTTP ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function renderUsers(rows){
    const tbody = $('#usersTable tbody'); if(!tbody) return;
    tbody.innerHTML = '';
    rows.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${new Date(u.created_at).toLocaleString()}</td>
        <td><button class="btn" data-del="${u.id}">Löschen</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function toCSV(rows){
    const head = ['id','name','email','role','created_at'];
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    return [head.join(',')]
      .concat(rows.map(u=> head.map(k=>esc(u[k])).join(',')))
      .join('\n');
  }

  function download(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  async function requireAdminOrPrompt(){
    // prüfe Token/Me
    if(!token()){
      setStatus('Nicht angemeldet. Bitte einloggen.');
      openLogin();
      throw new Error('no-token');
    }
    try{
      const me = await authedJSON('/api/me');
      if(!me?.user){
        setStatus('Nicht angemeldet. Bitte einloggen.');
        openLogin();
        throw new Error('no-user');
      }
      if(me.user.role !== 'admin'){
        setStatus('Keine Adminrechte – bitte mit einem Admin-Account einloggen.');
        openLogin();
        throw new Error('no-admin');
      }
      // sync local user (falls veraltet)
      localStorage.setItem(STORAGE, JSON.stringify(me.user));
      return me.user;
    }catch(e){
      if(e.status===401){
        setStatus('Sitzung abgelaufen. Bitte neu anmelden.');
        openLogin();
      }else{
        setStatus(`Fehler: ${e.message}`);
      }
      throw e;
    }
  }

  function openLogin(){
    // modal öffnen, falls vorhanden (wird von app.js auto-injiziert)
    const modal = $('#authModal');
    const tabLogin = $('#tabLogin');
    const loginForm = $('#loginForm');
    if(modal){ modal.classList.remove('hidden'); }
    if(tabLogin){ tabLogin.setAttribute('aria-selected','true'); }
    if(loginForm){ loginForm.classList.remove('hidden'); }
  }

  async function load(){
    enableCsv(false);
    setStatus('Lade Benutzer…');
    try{
      await requireAdminOrPrompt();
      const data = await authedJSON('/api/users');
      const rows = data.users || [];
      window.__usersCache = rows;
      renderUsers(rows);
      setStatus(`${rows.length} Benutzer geladen.`);
      enableCsv(rows.length > 0);
    }catch(e){
      // bereits Status gesetzt in requireAdminOrPrompt
      renderUsers([]);
    }
  }

  async function del(id){
    try{
      await requireAdminOrPrompt();
    }catch{ return; }
    if(!confirm(`Benutzer #${id} wirklich löschen?`)) return;
    try{
      await authedJSON(`/api/users/${id}`, { method:'DELETE' });
      setStatus(`Benutzer #${id} gelöscht.`);
      await load();
    }catch(e){
      setStatus(`Löschen fehlgeschlagen: ${e.message}`);
    }
  }

  async function createUser(e){
    e.preventDefault();
    try{
      await requireAdminOrPrompt();
    }catch{ return; }

    const name = $('#newName')?.value.trim() || '';
    const email = $('#newEmail')?.value.trim() || '';
    const password = $('#newPassword')?.value || '';
    const role = $('#newRole')?.value || 'user';
    if(!name || !email || password.length < 8){
      setStatus('Bitte gültige Angaben (Passwort min. 8 Zeichen).');
      return;
    }
    try{
      await authedJSON('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role })
      });
      setStatus(`Benutzer angelegt (${role}).`);
      $('#createForm')?.reset();
      await load();
    }catch(e){
      setStatus(`Anlegen fehlgeschlagen: ${e.message}`);
    }
  }

  function init(){
    // Buttons
    $('#reloadBtn')?.addEventListener('click', load);
    $('#exportCsvBtn')?.addEventListener('click', ()=>{
      const rows = window.__usersCache || [];
      if(!rows.length){ setStatus('Keine Daten zum Export.'); return; }
      const csv = toCSV(rows);
      download(`users_${new Date().toISOString().slice(0,10)}.csv`, csv);
    });
    $('#createForm')?.addEventListener('submit', createUser);

    // Delegated delete
    $('#usersTable')?.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-del]');
      if(btn){ del(Number(btn.getAttribute('data-del'))); }
    });

    // auto-load
    load();
    const yearEl = $('#year'); if(yearEl) yearEl.textContent = new Date().getFullYear();
  }
})();
