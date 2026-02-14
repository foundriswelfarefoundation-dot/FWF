window.AUTH = {
  // Backend URL - Railway deployment
  BACKEND_URL: 'https://fwf-production.up.railway.app',
  
  async api(url, opts={}){
    // Prepend backend URL for auth/member/admin endpoints
    const fullUrl = url.startsWith('/api/') ? `${this.BACKEND_URL}${url}` : url;
    
    const res = await fetch(fullUrl, {
      method: opts.method||'GET',
      headers: {'Content-Type':'application/json'},
      body: opts.body?JSON.stringify(opts.body):undefined,
      credentials: 'include'
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({error:'Error'}));
      throw new Error(err.error||'Request failed');
    }
    return res.json();
  }
};
