const SUPABASE_URL = 'https://dwxbbfaifhizpmhikacg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3eGJiZmFpZmhpenBtaGlrYWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODY4MzAsImV4cCI6MjEwMDY2MjgzMH0.gWgDhOTNkxvFae_ZzbCUHvgQjYapnL0yAuiRPwU3DN0';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector('.screen').scrollTop = 0;
}
function goTab(id, btn){
  showView(id);
  const nav = btn.closest('.bottomnav');
  nav.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}
function togglePw(id, btn){
  const input = document.getElementById(id);
  if(input.type === 'password'){ input.type='text'; btn.textContent='🙈'; }
  else { input.type='password'; btn.textContent='👁️'; }
}
function setErr(inputWrapId, errId, show){
  document.getElementById(inputWrapId).classList.toggle('err', show);
  document.getElementById(errId).classList.toggle('show', show);
}

async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  let ok = true;
  setErr('loginEmailWrap','loginEmailErr', email.length === 0); if(email.length===0) ok=false;
  setErr('loginPassWrap','loginPassErr', pass.length === 0); if(pass.length===0) ok=false;
  if(!ok) return;

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error){
    showToast('⚠️ ' + (error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message));
    return;
  }
  await loadProfileIntoUI(data.user.id);
  showView('view-feed');
  await loadFeed();
  showToast('Login realizado 🎉');
}

async function doSignup(){
  const email = document.getElementById('suEmail').value.trim();
  const pass = document.getElementById('suPass').value.trim();
  const pass2 = document.getElementById('suPass2').value.trim();
  const terms = document.getElementById('suTerms').checked;
  let ok = true;
  const emailOk = email.includes('@') && email.includes('.');
  setErr('suEmailWrap','suEmailErr', !emailOk); if(!emailOk) ok=false;
  const passOk = pass.length >= 8;
  setErr('suPassWrap','suPassErr', !passOk); if(!passOk) ok=false;
  const matchOk = pass2.length>0 && pass === pass2;
  setErr('suPass2Wrap','suPass2Err', !matchOk); if(!matchOk) ok=false;
  document.getElementById('suTermsErr').classList.toggle('show', !terms);
  if(!terms) ok=false;
  if(!ok) return;

  const name = (document.getElementById('suName').value.trim() || email.split('@')[0]).replace('@','').replace(/\s+/g,'');
  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { username: name } }
  });
  if(error){
    showToast('⚠️ ' + error.message);
    return;
  }
  if(!data.session){
    showToast('✅ Conta criada! Confirme seu email pra poder entrar.');
    showView('view-login');
    return;
  }
  await loadProfileIntoUI(data.user.id);
  showView('view-feed');
  await loadFeed();
  showToast('Conta criada 🎉 Bem-vinda!');
}

async function loadProfileIntoUI(userId){
  const { data } = await sb.from('profiles').select('username').eq('id', userId).single();
  const uname = data ? data.username : 'voce';
  document.getElementById('profileName').textContent = uname;
  document.getElementById('profileHandle').textContent = '@' + uname;
  document.getElementById('profileHandleTop').textContent = '@' + uname;
}

function setRecoverTab(type){
  document.getElementById('tabEmail').classList.toggle('on', type==='email');
  document.getElementById('tabPhone').classList.toggle('on', type==='phone');
  document.getElementById('recoverLabel').textContent = type==='email' ? 'Email cadastrado' : 'Telefone cadastrado';
  document.getElementById('recoverInput').placeholder = type==='email' ? 'voce@email.com' : '(00) 00000-0000';
}
async function doRecover(){
  const val = document.getElementById('recoverInput').value.trim();
  if(val.length===0){ showToast('Preencha o campo primeiro'); return; }
  if(document.getElementById('tabPhone').classList.contains('on')){
    showToast('📱 Recuperação por SMS ainda não está configurada (só email por enquanto)');
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(val);
  if(error){ showToast('⚠️ ' + error.message); return; }
  showToast('✅ Link de recuperação enviado pro seu email');
  setTimeout(()=>showView('view-login'), 1200);
}

async function toggleLike(el){
  const postId = el.dataset.postId;
  const liked = el.dataset.liked === '1';
  const num = parseInt(el.textContent.replace('♡','').replace('♥','').trim());
  el.textContent = (liked ? '♡ ' : '♥ ') + (liked ? num-1 : num+1);
  el.dataset.liked = liked ? '0' : '1';
  el.style.color = liked ? '' : 'var(--magenta)';
  if(!postId) return; // demo cards without a real DB id stay visual-only
  const { data: userData } = await sb.auth.getUser();
  if(!userData.user) return;
  if(liked){
    await sb.from('likes').delete().eq('post_id', postId).eq('user_id', userData.user.id);
  } else {
    await sb.from('likes').insert({ post_id: postId, user_id: userData.user.id });
  }
}

/* ===== Video source: gallery vs camera ===== */
let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recTimerInterval = null;
let recSeconds = 0;
let currentFacingMode = 'user';

function openCreate(){
  showCreateStep('source');
  showView('view-create');
}
function showCreateStep(step){
  document.getElementById('sourceStep').style.display = step==='source' ? 'block' : 'none';
  document.getElementById('cameraStep').style.display = step==='camera' ? 'block' : 'none';
  document.getElementById('trimStep').style.display = step==='trim' ? 'block' : 'none';
}

function setTrimPreview(url){
  const preview = document.getElementById('trimPreview');
  preview.src = url;
}

function pickFromGallery(){
  document.getElementById('galleryInput').click();
}
function onGalleryPicked(e){
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  setTrimPreview(url);
  showCreateStep('trim');
  showToast('🖼️ Vídeo importado da galeria');
}

async function startCamera(){
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode: currentFacingMode },
      audio:true
    });
    document.getElementById('cameraPreview').srcObject = cameraStream;
    showCreateStep('camera');
    showToast('🎥 Permissão de câmera e microfone concedida');
  }catch(err){
    showToast('⚠️ Não conseguimos acessar sua câmera. Verifique as permissões do navegador.');
  }
}
function cancelCamera(){
  stopCameraStream();
  showCreateStep('source');
}
async function flipCamera(){
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  stopCameraStream();
  await startCamera();
}
function stopCameraStream(){
  if(cameraStream){
    cameraStream.getTracks().forEach(t=>t.stop());
    cameraStream = null;
  }
}
function toggleRecording(){
  const btn = document.getElementById('recordBtn');
  const badge = document.getElementById('recBadge');
  const hint = document.getElementById('cameraHint');
  if(!mediaRecorder || mediaRecorder.state === 'inactive'){
    recordedChunks = [];
    try{
      mediaRecorder = new MediaRecorder(cameraStream);
    }catch(err){
      showToast('⚠️ Gravação não suportada neste navegador');
      return;
    }
    mediaRecorder.ondataavailable = (e)=>{ if(e.data.size>0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = ()=>{
      const blob = new Blob(recordedChunks, {type:'video/webm'});
      const url = URL.createObjectURL(blob);
      setTrimPreview(url);
      stopCameraStream();
      showCreateStep('trim');
      showToast('✅ Vídeo gravado com sucesso');
    };
    mediaRecorder.start();
    btn.classList.add('recording');
    badge.style.display = 'block';
    hint.textContent = 'toque novamente pra parar';
    recSeconds = 0;
    recTimerInterval = setInterval(()=>{
      recSeconds++;
      const m = Math.floor(recSeconds/60), s = recSeconds%60;
      document.getElementById('recTimer').textContent = m+':'+(s<10?'0':'')+s;
    },1000);
  } else {
    mediaRecorder.stop();
    btn.classList.remove('recording');
    badge.style.display = 'none';
    clearInterval(recTimerInterval);
  }
}
function retakeVideo(){
  document.getElementById('trimPreview').removeAttribute('src');
  showCreateStep('source');
}

/* ===== Location permission ===== */
function addLocation(){
  const chip = document.getElementById('locChip');
  if(!navigator.geolocation){
    showToast('⚠️ Localização não suportada neste navegador');
    return;
  }
  showToast('📍 Solicitando permissão de localização...');
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      const lat = pos.coords.latitude.toFixed(3);
      const lon = pos.coords.longitude.toFixed(3);
      chip.textContent = '📍 ' + lat + ', ' + lon;
      chip.style.background = '#EAFBF3';
      chip.style.borderColor = '#B9F0D6';
      chip.style.color = '#1EB954';
      showToast('✅ Permissão de localização concedida');
    },
    ()=>{ showToast('⚠️ Permissão de localização negada'); },
    { timeout:8000 }
  );
}

function updateCharCount(){
  const val = document.getElementById('capInput').value;
  document.getElementById('capCount').textContent = val.length;
}
function addHashtag(){
  const tag = prompt('Digite sua hashtag (sem #):', 'meugif');
  if(tag){
    const chip = document.getElementById('hashChip');
    chip.textContent = '#' + tag.replace(/\s+/g,'');
    chip.style.display = 'inline-block';
  }
}
async function doPost(){
  const trimPreview = document.getElementById('trimPreview');
  if(!trimPreview.src){
    showToast('⚠️ Escolha ou grave um vídeo primeiro');
    return;
  }
  const { data: userData } = await sb.auth.getUser();
  if(!userData.user){
    showToast('⚠️ Você precisa estar logada pra postar');
    return;
  }
  const caption = document.getElementById('capInput').value.trim() || 'meu novo gif';
  const hashChip = document.getElementById('hashChip');
  const hashtag = hashChip.style.display !== 'none' ? hashChip.textContent : '';
  const locChip = document.getElementById('locChip');
  const hasLoc = locChip.textContent.trim().startsWith('📍') && locChip.textContent.includes(',');
  const [lat, lng] = hasLoc ? locChip.textContent.replace('📍','').split(',').map(s=>parseFloat(s.trim())) : [null,null];

  showToast('⏳ Enviando seu GIF...');

  try{
    const videoBlob = await fetch(trimPreview.src).then(r=>r.blob());
    const fileName = `${userData.user.id}/${Date.now()}.webm`;
    const { error: uploadErr } = await sb.storage.from('gifs').upload(fileName, videoBlob, { contentType: videoBlob.type || 'video/webm' });
    if(uploadErr) throw uploadErr;

    const { data: pub } = sb.storage.from('gifs').getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;

    const { error: insertErr } = await sb.from('posts').insert({
      user_id: userData.user.id,
      video_url: publicUrl,
      caption, hashtag,
      location_lat: lat, location_lng: lng
    });
    if(insertErr) throw insertErr;

    showToast('✅ GIF postado no seu feed');
    stopCameraStream();
    document.getElementById('capInput').value='';
    document.getElementById('hashChip').style.display='none';
    document.getElementById('locChip').textContent = '📍 marcar onde foi';
    document.getElementById('locChip').style.cssText='';
    updateCharCount();
    showCreateStep('source');
    showView('view-feed');
    await loadFeed();
    maybeAskNotifications();
  }catch(err){
    showToast('⚠️ Erro ao postar: ' + err.message);
  }
}

async function loadFeed(){
  const { data, error } = await sb
    .from('posts_with_stats')
    .select('*, profiles(username)')
    .order('created_at', { ascending:false });
  if(error){ console.error(error); return; }

  const { data: userData } = await sb.auth.getUser();
  const myLikes = new Set();
  if(userData.user){
    const { data: likeRows } = await sb.from('likes').select('post_id').eq('user_id', userData.user.id);
    (likeRows||[]).forEach(r=>myLikes.add(r.post_id));
  }

  const list = document.getElementById('feedList');
  list.querySelectorAll('.gif-card[data-db="1"]').forEach(c=>c.remove());
  const fragment = document.createDocumentFragment();

  data.forEach(post=>{
    const card = document.createElement('div');
    card.className = 'gif-card';
    card.dataset.db = '1';
    const sealHtml = post.seal ? `<div class="seal ${post.seal}"><span class="medal">${post.seal==='gold'?'🥇':post.seal==='silver'?'🥈':'🥉'}</span>${post.seal==='gold'?'Ouro':post.seal==='silver'?'Prata':'Bronze'}</div>` : '';
    const liked = myLikes.has(post.id);
    card.innerHTML = `
      <div class="gif-media">
        <video src="${post.video_url}" autoplay muted loop playsinline></video>
        ${sealHtml}
        <div class="loop-tag">↻ gif</div>
        <div class="mood-pill">✨ ${post.mood || 'seu gif'}</div>
      </div>
      <div class="gif-body">
        <div class="gif-user"><div class="avatar"></div><div class="uname">@${post.profiles ? post.profiles.username : 'usuario'}</div></div>
        <div class="caption">${post.caption} ${post.hashtag ? '<span class="hashtag">'+post.hashtag+'</span>' : ''}</div>
        <div class="card-actions">
          <span onclick="toggleLike(this)" data-post-id="${post.id}" data-liked="${liked?'1':'0'}" style="${liked?'color:var(--magenta);':''}">${liked?'♥':'♡'} ${post.like_count}</span>
          <span>↻ 0</span><span>➤</span>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  });
  list.prepend(fragment);
}
function maybeAskNotifications(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    setTimeout(()=>{
      Notification.requestPermission().then(result=>{
        if(result === 'granted') showToast('🔔 Notificações ativadas — você vai saber quando ganhar um selo');
        else showToast('🔕 Notificações desativadas (você pode ativar depois)');
      });
    }, 1400);
  }
}

function setMood(el, name){
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('moodNow').textContent = name;
}

async function doLogout(){
  await sb.auth.signOut();
  showView('view-login');
  showToast('Você saiu da conta');
}

/* Auto-login if there's already a valid session */
(async function checkSession(){
  const { data } = await sb.auth.getSession();
  if(data.session){
    await loadProfileIntoUI(data.session.user.id);
    showView('view-feed');
    await loadFeed();
  }
})();
