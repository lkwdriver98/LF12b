<!-- speichern unter: app/public/js/auth.js -->
<script>
window.TF_AUTH=(function(){
  const KEY='tf_token';
  const token=()=>localStorage.getItem(KEY);
  async function me(){
    const t=token(); if(!t) return null;
    try{const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+t}});
        if(!r.ok) return null; return (await r.json()).user;}catch{return null}
  }
  async function requireLogin(){
    const u=await me(); if(!u){location.href='/index.html#login';} return u;
  }
  async function requireAdmin(){
    const u=await me(); if(!u){location.href='/index.html#login'; return null;}
    if(u.role!=='admin'){location.href='/index.html'; return null;} return u;
  }
  function logout(){localStorage.removeItem(KEY);}
  return {KEY,token,me,requireLogin,requireAdmin,logout};
})();
</script>
