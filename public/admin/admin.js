(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
  function $(s){return document.querySelector(s)}
  function $all(s){return document.querySelectorAll(s)}
  const TOKEN_KEY='tf_token', STORAGE='tf_user';

  function token(){ return localStorage.getItem(TOKEN_KEY) || ''; }
  function user(){ try{ return JSON.parse(localStorage.getItem(STORAGE)||'null'); }catch{ return null; } }

  async function authedJSON(url, opts={}){
    const r = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token()}`,
        ...(opts.headers||{})
      }
    });
    const data = await r.json().catch(()=> ({}));
    if(!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }

  function renderUsers(rows){
    const tbody = $('#usersTable tbody'); tbody.innerHTML = '';
    rows.forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${new Date(u.created_at).toLocaleString()}</td>
        <td>
          <button class="btn" data-del="${u.id}">Löschen</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function toCSV(rows){
    const head = ['id','name','email','role','created_at'];
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const lines = [head.join(',')].concat(
      rows.map(u=> head.map(k=>esc(u[k])).join(','))
    );
    return lines.join('\n');
  }

  function download(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  async function load(){
    const status = $('#adminStatus');
    try{
      status.textContent = 'Lade Benutzer…';
      const data = await authedJSON('/api/users');
      renderUsers(data.users||[]);
      status.textContent = `${(data.users||[]).length} Benutzer geladen.`;
      window.__usersCache = data.users||[];
    }catch(e){
      status.textContent = `Fehler: ${e.message}`;
      renderUsers([]);
    }
  }

  async function del(id){
    if(!confirm(`Benutzer #${id} wirklich löschen?`)) return;
    const status = $('#adminStatus');
    try{
      await authedJSON(`/api/users/${id}`, { method:'DELETE' });
      status.textContent = `Benutzer #${id} gelöscht.`;
      await load();
    }catch(e){
      status.textContent = `Löschen fehlgeschlagen: ${e.message}`;
    }
  }

  async function createUser(e){
    e.preventDefault();
    const status = $('#adminStatus');
    status.textContent = '';
    const name = $('#newName')?.value.trim() || '';
    const email = $('#newEmail')?.value.trim() || '';
    const password = $('#newPassword')?.value || '';
    const role = $('#newRole')?.value || 'user';
    if(!name || !email || password.length < 8){
      status.textContent = 'Bitte gültige Angaben (Passwort min. 8 Zeichen).';
      return;
    }
    try{
      await authedJSON('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role })
      });
      status.textContent = `Benutzer angelegt (${role}).`;
      $('#createForm')?.reset();
      await load();
    }catch(e){
      status.textContent = `Anlegen fehlgeschlagen: ${e.message}`;
    }
  }

  function init(){
    // Guard: nur Admin
    const me = user();
    if(!me || me.role !== 'admin'){
      $('#adminStatus')?.append(' (nicht angemeldet oder keine Adminrechte)');
    }

    $('#reloadBtn')?.addEventListener('click', load);
    $('#exportCsvBtn')?.addEventListener('click', ()=>{
      const rows = window.__usersCache || [];
      const csv = toCSV(rows);
      download(`users_${new Date().toISOString().slice(0,10)}.csv`, csv);
    });
    $('#createForm')?.addEventListener('submit', createUser);

    // Delegated delete buttons
    $('#usersTable')?.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-del]');
      if(btn){ del(Number(btn.getAttribute('data-del'))); }
    });

    // auto-load
    load();
    $('#year')?.textContent = new Date().getFullYear();
  }
})();
