(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}

  function $(s){return document.querySelector(s)}
  function $all(s){return document.querySelectorAll(s)}

  const STORAGE='tf_user';        // gespeichert: {id,name,email,role}
  const TOKEN_KEY='tf_token';     // JWT
  const API = "";                 // gleicher Origin

  function getUser(){try{return JSON.parse(localStorage.getItem(STORAGE))}catch{return null}}
  function setUser(u){localStorage.setItem(STORAGE,JSON.stringify(u))}
  function clearUser(){localStorage.removeItem(STORAGE)}
  function token(){ return localStorage.getItem(TOKEN_KEY) || ''; }

  function ensureAuthModal(){
    if($('#authModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="authModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div class="modal__panel">
          <div class="tabs" role="tablist">
            <button id="tabLogin" class="tab" role="tab" aria-selected="true">Anmelden</button>
            <button id="tabRegister" class="tab" role="tab" aria-selected="false">Registrieren</button>
          </div>
          <form id="loginForm" class="grid" autocomplete="on">
            <div class="row"><label for="loginEmail">E-Mail</label><input id="loginEmail" type="email" required></div>
            <div class="row"><label for="loginPassword">Passwort</label><input id="loginPassword" type="password" required></div>
            <div style="display:flex;gap:.6rem;justify-content:flex-end">
              <button class="btn" type="button" id="switchToRegister">Neu hier?</button>
              <button class="btn btn--primary" type="submit">Login</button>
            </div>
            <p id="loginStatus" aria-live="polite"></p>
          </form>
          <form id="registerForm" class="grid hidden" autocomplete="on">
            <div class="row"><label for="regName">Name</label><input id="regName" type="text" required></div>
            <div class="row"><label for="regEmail">E-Mail</label><input id="regEmail" type="email" required></div>
            <div class="row"><label for="regPassword">Passwort</label><input id="regPassword" type="password" required></div>
            <small style="color:var(--muted)">Öffentliche Registrierung erstellt immer <strong>role=user</strong>.</small>
            <div style="display:flex;gap:.6rem;justify-content:flex-end">
              <button class="btn" type="button" id="switchToLogin">Schon ein Konto?</button>
              <button class="btn btn--primary" type="submit">Registrieren</button>
            </div>
            <p id="registerStatus" aria-live="polite"></p>
          </form>
          <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
            <button id="authClose" class="btn">Schließen</button>
          </div>
        </div>
      </div>
    `);
  }

  async function fetchJSON(url, opts={}){
    const r = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        ...(opts.headers||{})
      }
    });
    const data = await r.json().catch(()=> ({}));
    if(!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }

  function applyAuth(){
    const u=getUser(), isLogged=!!u, isAdmin=isLogged&&u.role==='admin';
    $('#loginBtn')?.classList.toggle('hidden',isLogged);
    $('#logoutBtn')?.classList.toggle('hidden',!isLogged);
    $all('#admin,[data-role="admin"]').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  }

  function init(){
    ensureAuthModal(); // ← stellt sicher, dass der Modal existiert

    const loginBtn=$('#loginBtn'), logoutBtn=$('#logoutBtn');
    const modal=$('#authModal'), closeBtn=$('#authClose');
    const tabLogin=$('#tabLogin'), tabRegister=$('#tabRegister');
    const loginForm=$('#loginForm'), registerForm=$('#registerForm');
    const loginStatus=$('#loginStatus'), registerStatus=$('#registerStatus');

    function open(){modal&&modal.classList.remove('hidden')}
    function close(){modal&&modal.classList.add('hidden')}
    function showLogin(){tabLogin?.setAttribute('aria-selected','true');tabRegister?.setAttribute('aria-selected','false');loginForm?.classList.remove('hidden');registerForm?.classList.add('hidden')}
    function showRegister(){tabLogin?.setAttribute('aria-selected','false');tabRegister?.setAttribute('aria-selected','true');loginForm?.classList.add('hidden');registerForm?.classList.remove('hidden')}

    loginBtn && (loginBtn.onclick=()=>{ open(); showLogin(); });
    logoutBtn && (logoutBtn.onclick=()=>{
      localStorage.removeItem(TOKEN_KEY);
      clearUser(); applyAuth();
    });
    closeBtn && (closeBtn.onclick=close);
    $('#switchToRegister')?.addEventListener('click',()=>showRegister());
    $('#switchToLogin')?.addEventListener('click',()=>showLogin());
    modal?.addEventListener('click',e=>{ if(e.target===modal) close(); });
    tabLogin?.addEventListener('click',showLogin);
    tabRegister?.addEventListener('click',showRegister);

    // Login -> Backend
    loginForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); if(!loginStatus) return;
      loginStatus.textContent='';
      const email = $('#loginEmail')?.value.trim()||'';
      const password = $('#loginPassword')?.value||'';
      if(!email || !password){ loginStatus.textContent = 'Bitte ausfüllen.'; return; }
      try{
        const data = await fetchJSON(`${API}/api/login`, {
          method:'POST', body: JSON.stringify({ email, password })
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        applyAuth(); close();
      }catch(err){ loginStatus.textContent = err.message; }
    });

    // Register -> Backend (immer role=user)
    registerForm?.addEventListener('submit', async (e)=>{
      e.preventDefault(); if(!registerStatus) return;
      registerStatus.textContent='';
      const name=$('#regName')?.value.trim()||'';
      const email=$('#regEmail')?.value.trim()||'';
      const password=$('#regPassword')?.value||'';
      if(!name||!email||password.length<4){ registerStatus.textContent='Bitte gültige Angaben.'; return; }
      try{
        const data = await fetchJSON(`${API}/api/register`, {
          method:'POST', body: JSON.stringify({ name, email, password })
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        applyAuth(); close();
      }catch(err){ registerStatus.textContent = err.message; }
    });

    // Kontaktformular (nur Frontend-Demo)
    const form=$('#contactForm'), statusEl=$('#formStatus');
    form?.addEventListener('submit',e=>{
      e.preventDefault(); const d=new FormData(form);
      if(!d.get('name')||!d.get('email')||!d.get('message')){statusEl.textContent='Bitte alle Felder ausfüllen.';return}
      form.reset(); statusEl.textContent='Danke! Wir melden uns zeitnah.';
    });

    $('#year')?.textContent=new Date().getFullYear();
    applyAuth();
  }
})();
