(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}
  function $(s){return document.querySelector(s)} function $all(s){return document.querySelectorAll(s)}
  function init(){
    const ADMIN_KEY='TECHFLAIR-ADMIN', STORAGE='tf_user';
    const loginBtn=$('#loginBtn'), logoutBtn=$('#logoutBtn');
    const modal=$('#authModal'), closeBtn=$('#authClose');
    const tabLogin=$('#tabLogin'), tabRegister=$('#tabRegister');
    const loginForm=$('#loginForm'), registerForm=$('#registerForm');
    const loginStatus=$('#loginStatus'), registerStatus=$('#registerStatus');
    const adminDeploy=$('#admin-deploy');

    function getUser(){try{return JSON.parse(localStorage.getItem(STORAGE))}catch{return null}}
    function setUser(u){localStorage.setItem(STORAGE,JSON.stringify(u))}
    function clearUser(){localStorage.removeItem(STORAGE)}
    function applyAuth(){
      const u=getUser(), isLogged=!!u, isAdmin=isLogged&&u.role==='admin';
      if(loginBtn) loginBtn.classList.toggle('hidden',isLogged);
      if(logoutBtn) logoutBtn.classList.toggle('hidden',!isLogged);
      $all('#admin,[data-role="admin"]').forEach(el=>el.classList.toggle('hidden',!isAdmin));
    }
    function open(){modal&&modal.classList.remove('hidden')}
    function close(){modal&&modal.classList.add('hidden')}
    function showLogin(){tabLogin?.setAttribute('aria-selected','true');tabRegister?.setAttribute('aria-selected','false');loginForm?.classList.remove('hidden');registerForm?.classList.add('hidden')}
    function showRegister(){tabLogin?.setAttribute('aria-selected','false');tabRegister?.setAttribute('aria-selected','true');loginForm?.classList.add('hidden');registerForm?.classList.remove('hidden')}

    loginBtn&& (loginBtn.onclick=()=>{open();showLogin()})
    logoutBtn&& (logoutBtn.onclick=()=>{clearUser();applyAuth()})
    closeBtn&& (closeBtn.onclick=close)
    $('#switchToRegister')?.addEventListener('click',()=>showRegister())
    $('#switchToLogin')?.addEventListener('click',()=>showLogin())
    modal?.addEventListener('click',e=>{if(e.target===modal)close()})
    tabLogin?.addEventListener('click',showLogin)
    tabRegister?.addEventListener('click',showRegister)

    loginForm?.addEventListener('submit',e=>{
      e.preventDefault(); if(!loginStatus) return;
      loginStatus.textContent='';
      const email=$('#loginEmail')?.value.trim()||''; const saved=getUser();
      if(!saved||saved.email!==email){loginStatus.textContent='Kein Konto gefunden. Bitte registrieren.';return}
      applyAuth(); close();
    })
    registerForm?.addEventListener('submit',e=>{
      e.preventDefault(); if(!registerStatus) return;
      registerStatus.textContent='';
      const name=$('#regName')?.value.trim()||'', email=$('#regEmail')?.value.trim()||'', pw=$('#regPassword')?.value||'', key=$('#regKey')?.value.trim()||'';
      if(!name||!email||pw.length<4){registerStatus.textContent='Bitte gültige Angaben machen.';return}
      const role=(key==='TECHFLAIR-ADMIN')?'admin':'user'; setUser({name,email,role}); close(); applyAuth();
    })

    // Kontaktformular
    const form=$('#contactForm'), statusEl=$('#formStatus');
    form?.addEventListener('submit',e=>{
      e.preventDefault(); const d=new FormData(form);
      if(!d.get('name')||!d.get('email')||!d.get('message')){statusEl.textContent='Bitte alle Felder ausfüllen.';return}
      form.reset(); statusEl.textContent='Danke! Wir melden uns zeitnah.';
    })

    // Admin-Demo
    adminDeploy && (adminDeploy.textContent='Bereitgestellt: –')
    $('#year')?.textContent = new Date().getFullYear();
    applyAuth();
  }
})();
