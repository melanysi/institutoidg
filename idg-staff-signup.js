(() => {
  'use strict';
  const form = document.getElementById('request-form');
  const feedback = document.getElementById('feedback');
  const submit = document.getElementById('submit');
  const cfg = window.IDG_SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.publishableKey || !window.supabase) {
    feedback.textContent = 'Serviço indisponível. Tente novamente mais tarde.';
    return;
  }
  const db = window.supabase.createClient(cfg.url, cfg.publishableKey);
  const pendingKey = 'idg_staff_signup_pending_v2';
  const setMessage = message => { feedback.textContent = message; };
  const validPending = data => data && typeof data.name === 'string' && typeof data.email === 'string';
  const getPending = () => {
    try { const data = JSON.parse(localStorage.getItem(pendingKey)); return validPending(data) ? data : null; }
    catch { return null; }
  };
  const savePending = (name, email) => localStorage.setItem(pendingKey, JSON.stringify({name, email: email.toLowerCase()}));
  const clearPending = () => localStorage.removeItem(pendingKey);
  const normalEmail = value => (value || '').trim().toLowerCase();

  async function recordRequest(user, name) {
    if (!user?.id || !name?.trim()) throw new Error('Informe seu nome completo para finalizar a solicitação.');
    const { data: existing, error: readError } = await db.from('idg_staff_access_requests')
      .select('status').eq('user_id', user.id).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      clearPending();
      setMessage(existing.status === 'approved'
        ? 'Seu acesso já foi aprovado. Entre na área de coordenação.'
        : existing.status === 'pending'
          ? 'Sua solicitação está aguardando análise do administrador geral.'
          : 'Seu cadastro já foi analisado. Procure a administração para uma nova avaliação.');
      return;
    }
    const { error } = await db.from('idg_staff_access_requests')
      .insert({user_id: user.id, full_name: name.trim(), requested_role: 'coordinator'});
    if (error) {
      if (error.code === '23505') {
        clearPending();
        setMessage('Sua solicitação já está registrada. Aguarde a análise do administrador geral.');
        return;
      }
      throw error;
    }
    clearPending();
    setMessage('Solicitação registrada com sucesso! Aguarde a aprovação do administrador geral.');
    form.reset();
  }

  async function finishConfirmedSession() {
    const pending = getPending();
    if (!pending) return;
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user || normalEmail(user.email) !== pending.email) return;
    await recordRequest(user, pending.name);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    setMessage('Verificando sua conta e solicitação…');
    try {
      const name = document.getElementById('name').value.trim();
      const email = normalEmail(document.getElementById('email').value);
      const password = document.getElementById('password').value;
      if (name.length < 3 || password.length < 12 || !email) throw new Error('Revise seu nome, e-mail e senha.');

      const { data: { user: activeUser } } = await db.auth.getUser();
      if (activeUser && normalEmail(activeUser.email) !== email) await db.auth.signOut();
      let user = activeUser && normalEmail(activeUser.email) === email ? activeUser : null;
      if (!user) {
        const login = await db.auth.signInWithPassword({email, password});
        if (!login.error) {
          user = login.data.user;
        } else if (login.error.message?.toLowerCase().includes('email not confirmed')) {
          savePending(name, email);
          setMessage('Seu e-mail ainda não foi confirmado. Abra o link de confirmação e depois volte aqui para finalizar a solicitação com seu e-mail e senha.');
          return;
        } else {
          const registration = await db.auth.signUp({
            email, password, options: {emailRedirectTo: window.location.origin + '/solicitar-acesso.html'}
          });
          if (registration.error) throw registration.error;
          user = registration.data.user;
          if (!registration.data.session) {
            savePending(name, email);
            setMessage('Cadastro iniciado! Confirme o e-mail recebido. Depois volte a esta página e entre com o mesmo e-mail e senha para finalizar a solicitação. A aprovação ainda será necessária.');
            return;
          }
        }
      }
      savePending(name, email);
      await recordRequest(user, name);
    } catch (error) {
      setMessage('Não foi possível registrar a solicitação: ' + (error?.message || 'tente novamente.'));
    } finally {
      submit.disabled = false;
    }
  });

  // Ao retornar do link de confirmação, conclui o pedido automaticamente
  // quando há sessão válida. Apenas nome e e-mail são guardados localmente.
  finishConfirmedSession().catch(error => {
    setMessage('E-mail confirmado. Para finalizar a solicitação, informe novamente seus dados: ' + (error?.message || 'tente novamente.'));
  });
})();