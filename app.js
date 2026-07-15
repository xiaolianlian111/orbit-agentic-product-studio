const STORE_KEY = 'orbit-studio-v1';
const AGENTS = {
  pm: { name: 'Mira', role: 'Product strategist', initials: 'PM', color: '#4c67d8' },
  ux: { name: 'Noa', role: 'Experience architect', initials: 'UX', color: '#a44fc1' },
  eng: { name: 'Kai', role: 'Full-stack engineer', initials: 'EN', color: '#278466' },
  qa: { name: 'Sage', role: 'Quality lead', initials: 'QA', color: '#e2822e' },
};

const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
};
const persisted = safeParse(storage.get(STORE_KEY), {});
const state = {
  user: persisted.user || null,
  projects: persisted.projects || [],
  activeId: persisted.activeId || null,
  view: 'preview',
  device: 'desktop',
  busy: false,
  raceMode: false,
  raceCandidates: null,
  modal: null,
  toast: null,
};

const app = document.querySelector('#app');
const icons = {
  plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 14-8-4 16-3-6-7-2Z"/><path d="m12 14 3-3"/></svg>',
  export: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
  refresh: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6v6h-6M4 18v-6h6"/><path d="M6.5 8a7 7 0 0 1 11.7-2L20 8M4 16l1.8 2a7 7 0 0 0 11.7-2"/></svg>',
  desktop: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>',
  tablet: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4"/></svg>',
  mobile: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function persist() {
  storage.set(STORE_KEY, JSON.stringify({ user: state.user, projects: state.projects, activeId: state.activeId }));
}

function activeProject() { return state.projects.find(p => p.id === state.activeId) || null; }
function latestVersion(project = activeProject()) { return project?.versions?.[project.versions.length - 1] || null; }

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function showToast(message) {
  state.toast = message; render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { state.toast = null; render(); }, 2600);
}

function render() {
  const project = activeProject();
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar(project)}
      <main class="workspace">
        ${renderTopbar(project)}
        <section class="studio">
          ${renderConversation(project)}
          ${renderCanvas(project)}
        </section>
      </main>
    </div>
    ${state.raceCandidates ? renderRace() : ''}
    ${renderModal()}
    ${state.toast ? `<div class="toast"><span>✓</span>${escapeHtml(state.toast)}</div>` : ''}
  `;
  bindEvents();
  hydrateFrames();
  requestAnimationFrame(() => {
    const messages = document.querySelector('.messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

function renderSidebar(project) {
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">O</div><div><span class="brand-name">Orbit</span><span class="brand-sub">Agentic studio</span></div></div>
    <button class="new-project" data-action="new-project">${icons.plus}<span>Start a new build</span></button>
    <div class="section-label">Recent projects</div>
    <div class="project-list">
      ${state.projects.length ? state.projects.slice().reverse().map(p => `
        <button class="project-item ${p.id === state.activeId ? 'active' : ''}" data-project="${p.id}">
          <span class="project-icon">${typeIcon(p.type)}</span>
          <span class="project-title">${escapeHtml(p.name)}</span>
          <span class="project-age">${timeAgo(p.updatedAt)}</span>
        </button>`).join('') : `<div style="padding:12px 8px;color:var(--muted);font-size:9px;line-height:1.5">Your builds will live here.<br/>They persist on this device.</div>`}
    </div>
    <div class="side-spacer"></div>
    <div class="usage-card"><div class="usage-top"><span>Build capacity</span><b>${state.projects.length}/12</b></div><div class="usage-bar"><span style="width:${Math.min(100,state.projects.length/12*100)}%"></span></div><div class="usage-note">Offline agent is unlimited. Connect a model on deployment for generative mode.</div></div>
    <div class="profile" data-action="settings"><div class="avatar">${escapeHtml((state.user?.name || 'Guest').slice(0,2).toUpperCase())}</div><div class="profile-copy"><span class="profile-name">${escapeHtml(state.user?.name || 'Guest Builder')}</span><span class="profile-role">${escapeHtml(state.user?.role || 'Product builder')}</span></div>${icons.settings}</div>
  </aside>`;
}

function renderTopbar(project) {
  return `<header class="topbar">
    <div class="project-heading"><h1>${escapeHtml(project?.name || 'Untitled product')}</h1><span class="save-state"><i class="save-dot"></i>${project ? 'Saved locally' : 'Ready to build'}</span></div>
    <div class="top-spacer"></div>
    <div class="segmented">
      ${['preview','blueprint','versions'].map(v => `<button data-view="${v}" class="${state.view===v?'active':''}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>
    <button class="ghost-btn" data-action="export" ${project?'':'disabled'}>${icons.export} Export HTML</button>
    <button class="primary-btn accent" data-action="share" ${project?'':'disabled'}><span>↗</span> Publish</button>
  </header>`;
}

function renderConversation(project) {
  const messages = project?.messages || [{ agent:'pm', text:`Hi ${escapeHtml(state.user?.name?.split(' ')[0] || 'there')} — tell us what you want to build. I’ll clarify the product, then Noa, Kai, and Sage will design, build, and test it.` }];
  return `<section class="conversation">
    <div class="conversation-head"><strong>Build session</strong><div class="team-stack">${Object.entries(AGENTS).map(([id,a])=>`<span class="team-dot ${id}" title="${a.name} · ${a.role}">${a.initials}</span>`).join('')}</div></div>
    <div class="messages">${messages.map(renderMessage).join('')}${state.busy ? renderThinking() : ''}</div>
    <div class="composer-wrap">
      <div class="suggestions">
        ${project ? ['Add search & filters','Make it feel premium','Add an analytics view'].map(s=>`<button class="suggestion" data-prompt="${s}">${s}</button>`).join('') : ['Habit coach','Client CRM','Expense tracker'].map(s=>`<button class="suggestion" data-starter="${s}">${s}</button>`).join('')}
      </div>
      <div class="composer">
        <textarea id="prompt" ${state.busy?'disabled':''} placeholder="${project ? 'Ask the team to refine this product…' : 'Describe the product, audience, and what it should help them do…'}"></textarea>
        <div class="composer-actions">
          <button class="mode-pill ${state.raceMode?'active':''}" data-action="toggle-race"><span>⏱</span> Race mode</button>
          <span class="mode-pill" title="The server uses a configured model and falls back automatically"><span>✦</span> Agent team</span>
          <span class="composer-spacer"></span>
          <button class="send-btn" data-action="send" ${state.busy?'disabled':''}>${icons.send}</button>
        </div>
      </div>
    </div>
  </section>`;
}

function renderMessage(message) {
  const agent = message.agent ? AGENTS[message.agent] : null;
  const meta = agent
    ? `<span class="agent-badge" style="background:${agent.color}">${agent.initials}</span><b>${agent.name}</b><span>${agent.role}</span>`
    : `<span class="agent-badge" style="background:#292a27">YOU</span><b>${escapeHtml(state.user?.name || 'You')}</b>`;
  return `<div class="message ${agent?'agent':'user'}"><div class="message-meta">${meta}</div><div class="message-bubble"><p>${escapeHtml(message.text)}</p>${message.card ? renderAgentCard(message.card) : ''}</div></div>`;
}

function renderAgentCard(card) {
  return `<div class="agent-card"><div class="agent-card-head"><span class="agent-card-title">${escapeHtml(card.title)}</span><span class="status-chip">complete</span></div><ul>${card.items.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
}

function renderThinking() {
  const key = state.thinkingAgent || 'pm', agent = AGENTS[key];
  return `<div class="message agent"><div class="message-meta"><span class="agent-badge" style="background:${agent.color}">${agent.initials}</span><b>${agent.name}</b><span>${agent.role}</span></div><div class="message-bubble">${escapeHtml(state.thinkingText || 'Working')}<span class="thinking"><i></i><i></i><i></i></span></div></div>`;
}

function renderCanvas(project) {
  const version = latestVersion(project);
  return `<section class="canvas">
    <div class="canvas-bar"><button class="icon-btn" data-action="refresh" title="Refresh preview">${icons.refresh}</button><div class="url-bar"><i class="url-dot"></i><span>orbit.local/${project ? slug(project.name) : 'new-product'}</span></div><div class="canvas-spacer"></div><div class="device-switch">${['desktop','tablet','mobile'].map(d=>`<button class="${state.device===d?'active':''}" data-device="${d}" title="${d}">${icons[d]}</button>`).join('')}</div></div>
    <div class="viewport">${renderWorkspaceView(project, version)}</div>
  </section>`;
}

function renderWorkspaceView(project, version) {
  if (!project || !version) return `<div class="empty-canvas"><div class="empty-card"><div class="empty-orbit"></div><h2>From intent to interface.</h2><p>Describe a useful product. Four specialized agents will turn it into a tested, interactive app you can preview, refine, and export.</p><div class="starter-grid">${[['✓','Team planner','A focused project board for small teams'],['↗','Expense pulse','A simple spending tracker for freelancers'],['◌','Habit garden','A calm daily habit companion']].map(x=>`<button class="starter" data-starter="${x[2]}"><span class="starter-icon">${x[0]}</span><span>${x[1]}</span></button>`).join('')}</div></div></div>`;
  if (state.view === 'preview') return `<iframe class="preview-frame ${state.device}" id="preview-frame" title="Generated application preview"></iframe>`;
  if (state.view === 'blueprint') return renderBlueprint(version.spec);
  return renderVersions(project);
}

function renderBlueprint(spec) {
  return `<div style="align-self:stretch;width:min(850px,100%);margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="agent-card" style="padding:18px;background:white"><div class="modal-kicker">Product brief</div><h2 style="font:600 20px Manrope;margin:8px 0">${escapeHtml(spec.name)}</h2><p style="font-size:10px;color:var(--muted);line-height:1.6">${escapeHtml(spec.tagline)}</p><ul style="margin-top:18px">${spec.features.map(x=>`<li style="font-size:10px">${escapeHtml(x)}</li>`).join('')}</ul></div>
    <div class="agent-card" style="padding:18px;background:white"><div class="modal-kicker">Success contract</div><div style="display:grid;gap:12px;margin-top:15px">${[['Problem',spec.plan.problem],['Primary user',spec.plan.user],['Success signal',spec.plan.success]].map(x=>`<div><b style="display:block;font-size:9px;margin-bottom:4px">${x[0]}</b><span style="font-size:10px;color:var(--muted);line-height:1.5">${escapeHtml(x[1])}</span></div>`).join('')}</div></div>
    <div class="agent-card" style="grid-column:1/-1;padding:18px;background:#20211e;color:white"><div class="modal-kicker">Data model</div><pre style="margin:14px 0 0;white-space:pre-wrap;color:#c8cabf;font:9px/1.7 'DM Mono'">${escapeHtml(JSON.stringify(spec.entities,null,2))}</pre></div>
  </div>`;
}

function renderVersions(project) {
  return `<div style="align-self:stretch;width:min(760px,100%);margin:auto"><div style="margin-bottom:14px"><div class="modal-kicker">Build history</div><h2 style="font:600 20px Manrope;margin:8px 0 0">Every idea stays reversible.</h2></div><div style="display:grid;gap:8px">${project.versions.slice().reverse().map((v,i)=>`<button data-version="${v.id}" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px;border:1px solid var(--line);border-radius:11px;background:white;text-align:left;cursor:pointer"><span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:${v.spec.theme.accent}22;color:${v.spec.theme.accent};font-weight:700">${project.versions.length-i}</span><span style="flex:1"><b style="display:block;font-size:10px">${escapeHtml(v.label)}</b><small style="color:var(--muted);font-size:8px">${new Date(v.createdAt).toLocaleString()}</small></span><span class="status-chip">${i===0?'live':'saved'}</span></button>`).join('')}</div></div>`;
}

function renderRace() {
  return `<div class="race-overlay"><div class="race-head"><div><h2>Two teams. One stronger direction.</h2><p>Compare visual approaches, then promote a winner to your build history.</p></div><div class="top-spacer"></div><button class="icon-btn" data-action="close-race">×</button></div><div class="race-grid">${state.raceCandidates.map((candidate,i)=>`<div class="race-option"><div class="race-option-head"><strong>Direction ${String.fromCharCode(65+i)}</strong><span>${i?'Dense · analytical':'Calm · editorial'}</span><button class="mini-btn" data-race-choice="${i}">Choose</button></div><iframe id="race-${i}" title="Race candidate ${i+1}"></iframe></div>`).join('')}</div></div>`;
}

function renderModal() {
  if (!state.user) return `<div class="modal-backdrop"><div class="modal welcome"><span class="modal-kicker">Welcome to Orbit</span><h2>Your product team is ready.</h2><p>Four agents will shape, design, build, and test your idea. First, tell them how to address you.</p><div class="field"><label>Your name</label><input id="onboard-name" placeholder="e.g. Lin Chen" autofocus /></div><div class="field"><label>I’m building as a…</label><div class="role-grid">${['Founder','Product designer','Engineer'].map((r,i)=>`<button class="role-option ${i===0?'active':''}" data-role="${r}"><b>${r}</b><small>${i===0?'Validate & launch':i===1?'Prototype & learn':'Build & extend'}</small></button>`).join('')}</div></div><div class="modal-actions"><button class="primary-btn accent" data-action="complete-onboarding">Enter the studio →</button></div></div></div>`;
  if (state.modal === 'settings') return `<div class="modal-backdrop"><div class="modal"><button class="close-x" data-action="close-modal">×</button><span class="modal-kicker">Workspace settings</span><h2>Built for ownership.</h2><p>Your projects live in local storage. No product data leaves the browser unless model generation is configured on the deployment.</p><div class="setting-row"><div><strong>Model routing</strong><span>Server model → resilient local agent fallback</span></div><button class="toggle on"></button></div><div class="setting-row"><div><strong>Local persistence</strong><span>${state.projects.length} projects · survives refresh</span></div><button class="toggle on"></button></div><div class="field"><label>Display name</label><input id="settings-name" value="${escapeHtml(state.user.name)}" /></div><div class="modal-actions"><button class="ghost-btn" data-action="reset-demo">Reset demo data</button><button class="primary-btn" data-action="save-settings">Save changes</button></div></div></div>`;
  if (state.modal === 'publish') return `<div class="modal-backdrop"><div class="modal"><button class="close-x" data-action="close-modal">×</button><span class="modal-kicker">Ready for the world</span><h2>Production handoff</h2><p>This demo keeps publishing intentional. Export the generated HTML now, or deploy the Orbit repository to Vercel for a public build URL.</p><div class="agent-card"><div class="agent-card-head"><span class="agent-card-title">Preflight</span><span class="status-chip">3/3 passed</span></div><ul><li>Interactive states verified</li><li>Local persistence enabled</li><li>Responsive preview available</li></ul></div><div class="modal-actions"><button class="ghost-btn" data-action="close-modal">Not yet</button><button class="primary-btn accent" data-action="export">Export build</button></div></div></div>`;
  return '';
}

function bindEvents() {
  document.querySelectorAll('[data-project]').forEach(el => el.onclick = () => { state.activeId = el.dataset.project; state.view='preview'; persist(); render(); });
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => { state.view = el.dataset.view; render(); });
  document.querySelectorAll('[data-device]').forEach(el => el.onclick = () => { state.device = el.dataset.device; render(); });
  document.querySelectorAll('[data-starter]').forEach(el => el.onclick = () => fillAndSend(el.dataset.starter));
  document.querySelectorAll('[data-prompt]').forEach(el => el.onclick = () => { const input=document.querySelector('#prompt'); if(input){input.value=el.dataset.prompt;input.focus();} });
  document.querySelectorAll('[data-role]').forEach(el => el.onclick = () => { document.querySelectorAll('[data-role]').forEach(x=>x.classList.remove('active')); el.classList.add('active'); });
  document.querySelectorAll('[data-version]').forEach(el => el.onclick = () => restoreVersion(el.dataset.version));
  document.querySelectorAll('[data-race-choice]').forEach(el => el.onclick = () => chooseRace(Number(el.dataset.raceChoice)));
  document.querySelectorAll('[data-action]').forEach(el => el.onclick = () => handleAction(el.dataset.action));
  const prompt = document.querySelector('#prompt');
  if (prompt) prompt.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt(); } };
}

function handleAction(action) {
  if (action === 'new-project') { state.activeId=null; state.view='preview'; state.raceCandidates=null; render(); }
  if (action === 'send') sendPrompt();
  if (action === 'toggle-race') { state.raceMode=!state.raceMode; render(); }
  if (action === 'settings') { state.modal='settings'; render(); }
  if (action === 'close-modal') { state.modal=null; render(); }
  if (action === 'share') { state.modal='publish'; render(); }
  if (action === 'refresh') hydrateFrames();
  if (action === 'export') exportBuild();
  if (action === 'close-race') { state.raceCandidates=null; render(); }
  if (action === 'complete-onboarding') completeOnboarding();
  if (action === 'save-settings') saveSettings();
  if (action === 'reset-demo') resetDemo();
}

function completeOnboarding() {
  const name = document.querySelector('#onboard-name')?.value.trim() || 'Guest Builder';
  const role = document.querySelector('[data-role].active')?.dataset.role || 'Founder';
  state.user = { name, role }; persist(); render();
}

function saveSettings() {
  const name = document.querySelector('#settings-name')?.value.trim();
  if (name) state.user.name = name;
  state.modal = null; persist(); showToast('Workspace settings saved');
}

function resetDemo() {
  if (!confirm('Remove all local Orbit projects?')) return;
  const user = state.user; state.projects=[]; state.activeId=null; state.modal=null; state.user=user; persist(); render();
}

function fillAndSend(text) {
  const input = document.querySelector('#prompt');
  if (input) { input.value = text; sendPrompt(); }
}

async function sendPrompt() {
  const input = document.querySelector('#prompt');
  const prompt = input?.value.trim();
  if (!prompt || state.busy) return;
  await runBuild(prompt);
}

async function runBuild(prompt) {
  state.busy = true;
  let project = activeProject();
  if (!project) {
    project = { id: crypto.randomUUID(), name: 'New product', type:'generic', prompt, createdAt:Date.now(), updatedAt:Date.now(), messages:[], versions:[] };
    state.projects.push(project); state.activeId = project.id;
  }
  project.messages.push({ agent:null, text:prompt });
  state.thinkingAgent='pm'; state.thinkingText='Shaping the product brief'; persist(); render();

  const contextPrompt = project.versions.length ? `${project.prompt}\nRefinement request: ${prompt}` : prompt;
  const specPromise = generateSpec(contextPrompt, latestVersion(project)?.spec);
  await wait(650);
  const quickSpec = localSpec(contextPrompt, latestVersion(project)?.spec);
  project.messages.push({agent:'pm',text:`I’ve narrowed this to a clear job: ${quickSpec.plan.problem}`,card:{title:'Product contract',items:[`User · ${quickSpec.plan.user}`,`Success · ${quickSpec.plan.success}`,`Scope · ${quickSpec.features.slice(0,3).join(' · ')}`]}});
  state.thinkingAgent='ux'; state.thinkingText='Mapping the primary journey'; persist(); render();
  await wait(650);
  project.messages.push({agent:'ux',text:'I kept the experience focused on one obvious action, fast feedback, and useful empty states.',card:{title:'Experience map',items:['Orient in under 5 seconds','Complete the core job in one flow','Keep every important state reversible']}});
  state.thinkingAgent='eng'; state.thinkingText='Building interface and data states'; persist(); render();
  const spec = await specPromise;
  await wait(750);
  project.messages.push({agent:'eng',text:'The application is live in preview. Its working states persist in the browser.',card:{title:'Implementation',items:[`${spec.type} interaction model`,`Responsive application shell`,'Local-first data persistence']}});
  state.thinkingAgent='qa'; state.thinkingText='Running interaction checks'; persist(); render();
  await wait(600);
  project.messages.push({agent:'qa',text:'Preflight complete — primary action, empty state, responsive viewport, and persistence are all wired.',card:{title:'Quality gate',items:['Core interaction · passed','Refresh persistence · passed','Mobile viewport · passed']}});

  project.name = spec.name; project.type=spec.type; project.prompt = project.versions.length ? project.prompt : prompt; project.updatedAt=Date.now();
  if (state.raceMode) {
    const second = structuredClone(spec);
    second.theme = { accent: alternateAccent(spec.theme.accent), surface: spec.theme.surface === 'dark' ? 'cool' : 'dark' };
    second.tagline = `${spec.tagline} — focused view`;
    state.raceCandidates = [spec, second];
  } else addVersion(project, spec, project.versions.length ? `Refined · ${prompt.slice(0,42)}` : 'Initial build');
  state.busy=false; state.view='preview'; persist(); render(); showToast(state.raceMode ? 'Race candidates are ready' : 'Build completed and saved');
}

async function generateSpec(prompt, previous) {
  try {
    const response = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt}) });
    if (!response.ok) throw new Error('fallback');
    return normalizeSpec(await response.json(), prompt, previous);
  } catch { return localSpec(prompt, previous); }
}

function addVersion(project, spec, label) {
  project.versions.push({ id:crypto.randomUUID(), createdAt:Date.now(), label, spec:normalizeSpec(spec, project.prompt) });
}

function chooseRace(index) {
  const project=activeProject(), spec=state.raceCandidates[index];
  addVersion(project,spec,`Race winner · Direction ${String.fromCharCode(65+index)}`);
  state.raceCandidates=null; state.raceMode=false; project.updatedAt=Date.now(); persist(); render(); showToast('Direction promoted to the live build');
}

function restoreVersion(id) {
  const project=activeProject(), found=project.versions.find(v=>v.id===id);
  if (!found || found===latestVersion(project)) { state.view='preview'; render(); return; }
  addVersion(project,structuredClone(found.spec),`Restored · ${found.label}`); project.updatedAt=Date.now(); persist(); state.view='preview'; render(); showToast('Version restored as a new checkpoint');
}

function exportBuild() {
  const version=latestVersion();
  if (!version) return;
  const blob=new Blob([buildAppHtml(version.spec,0)],{type:'text/html'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`${slug(version.spec.name)}.html`; link.click(); URL.revokeObjectURL(link.href);
  state.modal=null; showToast('Standalone app exported');
}

function hydrateFrames() {
  const version=latestVersion();
  const frame=document.querySelector('#preview-frame');
  if (frame && version) frame.srcdoc=buildAppHtml(version.spec,0);
  state.raceCandidates?.forEach((spec,i)=>{ const race=document.querySelector(`#race-${i}`); if(race) race.srcdoc=buildAppHtml(spec,i); });
}

function wait(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,'-').replace(/^-|-$/g,'') || 'app'; }
function alternateAccent(accent) { return accent.toLowerCase()==='#ff5c35' ? '#6657d9' : '#ff5c35'; }
function typeIcon(type) { return ({tasks:'✓',finance:'↗',habits:'◌',crm:'◎',inventory:'□',events:'◇',generic:'✦'})[type] || '✦'; }

function normalizeSpec(raw, prompt, previous) {
  const fallback=localSpec(prompt,previous);
  return {
    name:String(raw?.name||fallback.name).slice(0,40), tagline:String(raw?.tagline||fallback.tagline).slice(0,120),
    type:['tasks','finance','habits','crm','inventory','events','generic'].includes(raw?.type)?raw.type:fallback.type,
    theme:{accent:/^#[0-9a-f]{6}$/i.test(raw?.theme?.accent)?raw.theme.accent:fallback.theme.accent,surface:['warm','cool','dark'].includes(raw?.theme?.surface)?raw.theme.surface:fallback.theme.surface},
    features:Array.isArray(raw?.features)?raw.features.slice(0,6).map(String):fallback.features,
    entities:Array.isArray(raw?.entities)?raw.entities.slice(0,4):fallback.entities,
    sampleItems:Array.isArray(raw?.sampleItems)&&raw.sampleItems.length?raw.sampleItems.slice(0,6):fallback.sampleItems,
    plan:{problem:String(raw?.plan?.problem||fallback.plan.problem),user:String(raw?.plan?.user||fallback.plan.user),success:String(raw?.plan?.success||fallback.plan.success)}
  };
}

function localSpec(prompt, previous) {
  const p=prompt.toLowerCase();
  let type='generic';
  if (/task|project|kanban|todo|任务|项目|协作|看板/.test(p)) type='tasks';
  else if (/expense|budget|money|finance|invoice|支出|预算|财务|记账/.test(p)) type='finance';
  else if (/habit|routine|streak|fitness|习惯|打卡|健身/.test(p)) type='habits';
  else if (/crm|client|lead|customer|客户|销售|线索/.test(p)) type='crm';
  else if (/inventory|stock|warehouse|库存|仓库/.test(p)) type='inventory';
  else if (/event|rsvp|booking|schedule|活动|报名|预约/.test(p)) type='events';
  else if (previous?.type) type=previous.type;
  const maps={
    tasks:{name:'Northstar Board',tagline:'Keep the team moving on what matters.',features:['Capture work instantly','Prioritize the next move','Track momentum','Filter by owner'],user:'small product teams',success:'Every owner knows the next action',items:[['Launch onboarding','Today · Maya'],['Review user signals','Tomorrow · Sam'],['Ship mobile polish','Friday · Alex']]},
    finance:{name:'Pennywise',tagline:'Clarity for every dollar in motion.',features:['Log income and expenses','See spending patterns','Set monthly guardrails','Export a clean ledger'],user:'independent professionals',success:'Weekly finances take under five minutes',items:[['Design retainer','Income · Today'],['Workspace tools','Software · Yesterday'],['Client lunch','Meals · Monday']]},
    habits:{name:'Daylight',tagline:'Small rituals, visible momentum.',features:['Daily one-tap check-in','Gentle streaks','Weekly reflection','Flexible routines'],user:'people building sustainable routines',success:'Users complete one meaningful ritual daily',items:[['Morning walk','7 day streak'],['Read 20 minutes','4 day streak'],['Plan tomorrow','12 day streak']]},
    crm:{name:'Kindred CRM',tagline:'Relationships, remembered.',features:['Capture every lead','See the next follow-up','Search contacts','Track relationship health'],user:'freelancers and small studios',success:'No warm relationship goes cold',items:[['Avery Chen','Proposal · follow up today'],['Milo Studio','Discovery · Thursday'],['Sunbeam Co.','Active · healthy']]},
    inventory:{name:'Stockroom',tagline:'Know what is moving before it runs out.',features:['Live stock counts','Low-stock signals','Quick adjustments','Supplier notes'],user:'small retail operators',success:'Zero surprise stockouts',items:[['Studio notebook','42 units'],['Canvas tote','8 units · low'],['Desk calendar','21 units']]},
    events:{name:'Gather',tagline:'A calmer way to bring people together.',features:['Publish event details','Track RSVPs','Manage capacity','Send updates'],user:'community organizers',success:'Guests know exactly where to be',items:[['Design breakfast','24 going · Aug 18'],['Founder walk','12 going · Aug 22'],['Demo evening','38 going · Sep 02']]},
    generic:{name:'Signal Desk',tagline:'Turn scattered intent into visible progress.',features:['Capture important inputs','Organize the work','Track progress','Keep useful notes'],user:'busy builders',success:'The next useful action is always visible',items:[['Define the first outcome','Priority · Today'],['Invite a collaborator','Open · Tomorrow'],['Review early feedback','Planned · Friday']]}
  };
  const m=maps[type];
  const dark=/dark|暗色|深色/.test(p); const premium=/premium|高级|奢华/.test(p);
  const accent= type==='finance'?'#177a61':type==='habits'?'#6e8b46':type==='crm'?'#6657d9':type==='inventory'?'#bd6428':type==='events'?'#d84d78':'#ff5c35';
  return {name:previous?.name||m.name,tagline:m.tagline,type,theme:{accent:previous?.theme?.accent||accent,surface:dark?'dark':premium?'cool':(previous?.theme?.surface||'warm')},features:m.features,entities:[{name:type==='crm'?'Contact':type==='finance'?'Transaction':'Item',fields:['title','status','createdAt']},{name:'Activity',fields:['action','timestamp']}],sampleItems:m.items.map((x,i)=>({title:x[0],meta:x[1],value:[64,32,81][i]})),plan:{problem:`Help ${m.user} ${m.tagline.toLowerCase()}`,user:m.user,success:m.success}};
}

function buildAppHtml(spec, variant = 0) {
  const data = JSON.stringify(spec).replace(/</g, '\\u003c');
  const isDark = spec.theme.surface === 'dark';
  const typeCopy = {
    tasks:{eyebrow:'TEAM WORKSPACE',heading:'Good morning, team.',sub:'Here’s what deserves attention today.',primary:'Add task',item:'task',metric1:'In progress',metric2:'Completed',metric3:'Focus score'},
    finance:{eyebrow:'MONEY OVERVIEW',heading:'Your month, in focus.',sub:'A clear view of income, spending, and room to move.',primary:'Add transaction',item:'transaction',metric1:'Balance',metric2:'Spent this month',metric3:'Savings rate'},
    habits:{eyebrow:'TODAY · DAILY RHYTHM',heading:'Make today count.',sub:'Small actions become a life when you can see them add up.',primary:'Add ritual',item:'ritual',metric1:'Today',metric2:'Best streak',metric3:'Consistency'},
    crm:{eyebrow:'RELATIONSHIP DESK',heading:'Stay close to the right people.',sub:'Every relationship has a clear next move.',primary:'Add contact',item:'contact',metric1:'Active leads',metric2:'Follow-ups',metric3:'Pipeline health'},
    inventory:{eyebrow:'STOCK OVERVIEW',heading:'Everything in its place.',sub:'See movement, low stock, and what needs action.',primary:'Add product',item:'product',metric1:'Products',metric2:'Low stock',metric3:'Stock health'},
    events:{eyebrow:'EVENTS HUB',heading:'Bring people together.',sub:'Plan the details. Keep every guest in the loop.',primary:'New event',item:'event',metric1:'Upcoming',metric2:'Total guests',metric3:'RSVP rate'},
    generic:{eyebrow:'WORKSPACE OVERVIEW',heading:'Move the right work forward.',sub:'A clean home for decisions, progress, and next actions.',primary:'Add item',item:'item',metric1:'Open items',metric2:'Completed',metric3:'Momentum'}
  }[spec.type] || {};
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap');
:root{--accent:${spec.theme.accent};--bg:${isDark?'#161713':variant?'#eef0f5':'#f6f5f0'};--panel:${isDark?'#20211d':'#fff'};--ink:${isDark?'#f2f1e9':'#1b1c19'};--muted:${isDark?'#92948a':'#777870'};--line:${isDark?'#35362f':'#e4e2d9'};font-family:Inter,sans-serif;color:var(--ink);background:var(--bg)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink)}button,input{font:inherit;color:inherit}.layout{display:grid;grid-template-columns:190px 1fr;min-height:100vh}.side{display:flex;flex-direction:column;padding:22px 14px;border-right:1px solid var(--line);background:${isDark?'#1b1c18':'rgba(255,255,255,.58)'}}.logo{display:flex;align-items:center;gap:9px;padding:0 7px 25px;font:700 14px Manrope}.logo i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:#fff;background:var(--accent);font-style:normal}.nav{display:grid;gap:3px}.nav button{display:flex;align-items:center;gap:9px;width:100%;padding:9px;border:0;border-radius:8px;color:var(--muted);background:transparent;font-size:10px;text-align:left;cursor:pointer}.nav button:hover,.nav button.active{color:var(--ink);background:var(--panel)}.nav b{width:16px;text-align:center;font-size:12px}.side-label{margin:24px 8px 8px;color:var(--muted);font:500 7px 'DM Mono';letter-spacing:.11em}.mini-progress{padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}.mini-progress strong{font-size:9px}.bar{height:4px;margin:9px 0 6px;border-radius:9px;background:var(--line);overflow:hidden}.bar i{display:block;width:72%;height:100%;background:var(--accent)}.mini-progress small{color:var(--muted);font-size:7px}.side-foot{margin-top:auto;display:flex;align-items:center;gap:8px;padding:9px 6px}.avatar{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);font-size:8px;font-weight:700}.side-foot b{display:block;font-size:8px}.side-foot small{color:var(--muted);font-size:7px}.main{min-width:0}.top{display:flex;align-items:center;height:55px;padding:0 30px;border-bottom:1px solid var(--line)}.search{display:flex;align-items:center;gap:7px;width:230px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.search input{width:100%;border:0;outline:0;background:transparent;font-size:8px}.top-space{flex:1}.top-icon{display:grid;place-items:center;width:29px;height:29px;margin-left:6px;border:1px solid var(--line);border-radius:8px;background:var(--panel);cursor:pointer}.content{max-width:1020px;margin:auto;padding:42px 40px 60px}.eyebrow{color:var(--accent);font:500 8px 'DM Mono';letter-spacing:.13em}.hero{display:flex;align-items:end;gap:20px;margin:8px 0 28px}.hero h1{margin:0;font:600 clamp(24px,3vw,37px) Manrope;letter-spacing:-.05em}.hero p{margin:7px 0 0;color:var(--muted);font-size:10px}.hero button,.add-btn{margin-left:auto;padding:9px 13px;border:0;border-radius:8px;color:white;background:var(--ink);font-size:9px;cursor:pointer}.hero button:hover,.add-btn:hover{transform:translateY(-1px)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:25px}.metric{padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.metric-head{display:flex;justify-content:space-between;color:var(--muted);font-size:8px}.metric strong{display:block;margin-top:12px;font:600 23px Manrope;letter-spacing:-.04em}.metric small{display:block;margin-top:4px;color:#23815c;font-size:7px}.metric .spark{display:flex;align-items:end;gap:3px;height:24px;margin-top:8px}.metric .spark i{flex:1;border-radius:3px 3px 0 0;background:color-mix(in srgb,var(--accent) 24%,transparent)}.section-head{display:flex;align-items:center;margin:0 0 10px}.section-head h2{margin:0;font:600 12px Manrope}.filter{margin-left:auto;padding:6px 8px;border:1px solid var(--line);border-radius:7px;color:var(--muted);background:var(--panel);font-size:8px;cursor:pointer}.items{display:grid;gap:7px}.item{display:grid;grid-template-columns:29px 1fr auto;align-items:center;gap:10px;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);transition:.18s}.item:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(20,20,15,.06)}.check{display:grid;place-items:center;width:27px;height:27px;border:1px solid var(--line);border-radius:8px;color:transparent;background:transparent;cursor:pointer}.item.done .check{color:#fff;border-color:var(--accent);background:var(--accent)}.item.done .item-title{text-decoration:line-through;color:var(--muted)}.item-title{font-size:9px;font-weight:600}.item-meta{margin-top:3px;color:var(--muted);font-size:7px}.score{padding:4px 7px;border-radius:999px;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);font:500 7px 'DM Mono'}.empty{padding:35px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--muted);font-size:9px}.insights{display:none;grid-template-columns:1.3fr .7fr;gap:10px}.chart-card,.note-card{padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.chart-card h2,.note-card h2{margin:0 0 15px;font:600 12px Manrope}.chart{display:flex;align-items:end;gap:7px;height:160px;padding-top:15px;border-bottom:1px solid var(--line)}.chart i{flex:1;min-width:13px;border-radius:6px 6px 0 0;background:color-mix(in srgb,var(--accent) 75%,white)}.note-card p{color:var(--muted);font-size:9px;line-height:1.7}.settings-panel{display:none;max-width:600px}.setting{display:flex;align-items:center;padding:15px 0;border-bottom:1px solid var(--line)}.setting b{display:block;font-size:9px}.setting small{color:var(--muted);font-size:7px}.setting button{margin-left:auto;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--panel);font-size:8px}dialog.app-dialog{width:min(380px,calc(100% - 32px));padding:0;border:1px solid var(--line);border-radius:14px;color:var(--ink);background:var(--panel);box-shadow:0 24px 80px rgba(0,0,0,.25)}dialog.app-dialog::backdrop{background:rgba(12,12,10,.35);backdrop-filter:blur(4px)}.dialog-body{padding:20px}.dialog-body h3{margin:0;font:600 16px Manrope}.dialog-body p{margin:6px 0 15px;color:var(--muted);font-size:9px}.dialog-body input{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;outline:0;background:var(--bg);font-size:10px}.dialog-body input:focus{border-color:var(--accent)}.dialog-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:15px}.dialog-actions button{padding:7px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel);font-size:8px;cursor:pointer}.dialog-actions button.primary{border-color:var(--ink);color:var(--panel);background:var(--ink)}.flash{animation:flash .45s ease}@keyframes flash{50%{background:color-mix(in srgb,var(--accent) 14%,var(--panel))}}
@media(max-width:700px){.layout{grid-template-columns:1fr}.side{display:none}.content{padding:28px 18px}.top{padding:0 18px}.metrics{grid-template-columns:1fr}.hero{align-items:start;flex-direction:column}.hero button{margin-left:0}.insights{grid-template-columns:1fr}}
</style></head><body><div class="layout"><aside class="side"><div class="logo"><i>${escapeHtml(spec.name.slice(0,1))}</i>${escapeHtml(spec.name)}</div><nav class="nav"><button class="active" data-page="overview"><b>⌂</b>Overview</button><button data-page="insights"><b>⌁</b>Insights</button><button data-page="settings"><b>⚙</b>Settings</button></nav><div class="side-label">THIS WEEK</div><div class="mini-progress"><strong>${escapeHtml(spec.plan.success)}</strong><div class="bar"><i></i></div><small>72% toward target</small></div><div class="side-foot"><div class="avatar">GB</div><div><b>Guest Builder</b><small>Workspace owner</small></div></div></aside><main class="main"><header class="top"><label class="search"><span>⌕</span><input id="search" placeholder="Search ${escapeHtml(typeCopy.item)}s…"></label><div class="top-space"></div><button class="top-icon" title="Notifications">◌</button><button class="top-icon" title="Help">?</button></header><div class="content"><section id="overview"><div class="eyebrow">${typeCopy.eyebrow}</div><div class="hero"><div><h1>${typeCopy.heading}</h1><p>${typeCopy.sub}</p></div><button id="add">＋ ${typeCopy.primary}</button></div><div class="metrics"><article class="metric"><div class="metric-head"><span>${typeCopy.metric1}</span><span>↗</span></div><strong id="metric-count">${spec.type==='finance'?'$8,420':spec.sampleItems.length}</strong><small>↑ 12% from last period</small></article><article class="metric"><div class="metric-head"><span>${typeCopy.metric2}</span><span>◎</span></div><strong>${spec.type==='finance'?'$2,184':'12'}</strong><small>On track this week</small></article><article class="metric"><div class="metric-head"><span>${typeCopy.metric3}</span><span>◫</span></div><strong>${spec.type==='finance'?'38%':'84%'}</strong><div class="spark"><i style="height:31%"></i><i style="height:44%"></i><i style="height:37%"></i><i style="height:68%"></i><i style="height:55%"></i><i style="height:88%"></i><i style="height:76%"></i></div></article></div><div class="section-head"><h2>Focus list</h2><button class="filter" id="filter">All ${escapeHtml(typeCopy.item)}s ▾</button></div><div class="items" id="items"></div></section><section class="insights" id="insights"><article class="chart-card"><h2>Momentum over time</h2><div class="chart">${[38,56,42,61,85,78,92,69,88].map(h=>`<i style="height:${h}%"></i>`).join('')}</div></article><article class="note-card"><h2>Agent insight</h2><p>${escapeHtml(spec.plan.success)}. Momentum is strongest on Tuesdays; the best next move is to clear the oldest open item.</p><button class="add-btn" style="margin:10px 0 0">View recommendation</button></article></section><section class="settings-panel" id="settings"><div class="eyebrow">PRODUCT SETTINGS</div><div class="hero"><div><h1>Make it yours.</h1><p>Core preferences for this generated workspace.</p></div></div>${['Weekly digest','Progress reminders','Compact view','Local data backup'].map((x,i)=>`<div class="setting"><div><b>${x}</b><small>${i%2?'Adjust how information appears':'Keep the team updated automatically'}</small></div><button>${i===2?'Standard':'Enabled'}</button></div>`).join('')}</section></div></main></div><dialog class="app-dialog" id="item-dialog"><form class="dialog-body" id="item-form"><h3>Add ${escapeHtml(typeCopy.item)}</h3><p>Create a new record in this generated application.</p><input id="item-name" maxlength="80" placeholder="${escapeHtml(typeCopy.item[0].toUpperCase()+typeCopy.item.slice(1))} name" autocomplete="off"><div class="dialog-actions"><button type="button" id="cancel-item">Cancel</button><button class="primary" type="submit">Add ${escapeHtml(typeCopy.item)}</button></div></form></dialog><script>
const SPEC=${data};const KEY='generated-'+${JSON.stringify(slug(spec.name))};let saved;try{saved=JSON.parse(localStorage.getItem(KEY))}catch(e){};let items=saved||SPEC.sampleItems.map((x,i)=>({...x,id:Date.now()+i,done:false}));let openOnly=false;const root=document.getElementById('items'),search=document.getElementById('search'),filter=document.getElementById('filter'),itemDialog=document.getElementById('item-dialog'),itemName=document.getElementById('item-name');function save(){try{localStorage.setItem(KEY,JSON.stringify(items))}catch(e){}}function draw(q=''){const visible=items.filter(x=>(!openOnly||!x.done)&&x.title.toLowerCase().includes(q.toLowerCase()));root.innerHTML=visible.length?visible.map(x=>'<article class="item '+(x.done?'done':'')+'" data-id="'+x.id+'"><button class="check" title="Toggle status">✓</button><div><div class="item-title">'+esc(x.title)+'</div><div class="item-meta">'+esc(x.meta||'Just added · Open')+'</div></div><span class="score">'+(x.done?'DONE':(x.value||68)+'%')+'</span></article>').join(''):'<div class="empty">No matching items. Try a different search.</div>';document.getElementById('metric-count').textContent=SPEC.type==='finance'?'$8,420':items.filter(x=>!x.done).length;root.querySelectorAll('.item').forEach(el=>el.onclick=e=>{if(e.target.closest('.check')){const item=items.find(x=>String(x.id)===el.dataset.id);item.done=!item.done;save();draw(search.value)}})}function esc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}draw();search.oninput=e=>draw(e.target.value);document.getElementById('add').onclick=()=>{itemName.value='';itemDialog.showModal();setTimeout(()=>itemName.focus(),0)};document.getElementById('cancel-item').onclick=()=>itemDialog.close();document.getElementById('item-form').onsubmit=e=>{e.preventDefault();const title=itemName.value.trim();if(!title)return;items.unshift({id:Date.now(),title,meta:'Just now · New',value:72,done:false});save();openOnly=false;filter.textContent='All ${escapeHtml(typeCopy.item)}s ▾';draw(search.value);itemDialog.close();root.firstElementChild?.classList.add('flash')};filter.onclick=()=>{openOnly=!openOnly;filter.textContent=openOnly?'Open only':'All ${escapeHtml(typeCopy.item)}s ▾';draw(search.value)};document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));['overview','insights','settings'].forEach(id=>{const el=document.getElementById(id);el.style.display=id===b.dataset.page?(id==='insights'?'grid':'block'):'none'})});
</script></body></html>`;
}

render();
