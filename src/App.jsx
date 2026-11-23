import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, Clock3, CreditCard, Crown,
  Download, Edit3, Eye, EyeOff, FileImage, Filter, Home, ImagePlus, Info, LogIn, LogOut,
  MapPin, Menu, MessageSquare, Plus, QrCode, Save, Search, Settings, ShieldCheck,
  Smartphone, Sparkles, Trash2, Trophy, User, UserCog, Users, Wallet, X, Zap
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const STORE_KEY = 'panthalchaam.local.demo.v1';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const makeId = (prefix='PT') => `${prefix}-${Math.random().toString(36).slice(2,6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
const seed = () => ({
  app: {
    name: 'PANTHALCHAAM', logo: '', qr: '', upi: '', commission: 10,
    noticeBoard: { enabled: false, message: '', image: '' },
    soundEnabled: true,
  },
  turfs: [
    { id:'turf-01', name:'PANTHALCHAAM ARENA', location:'Kasaragod', description:'Premium football turf · Demo venue', image:'', active:true, formats:['5s','7s','Mini 7s'], prices:{'5s':900,'7s':1300,'Mini 7s':1600}, ownerId:'owner-01' },
    { id:'turf-02', name:'GREENFIELD TURF', location:'Kasaragod', description:'Floodlit football ground · Demo venue', image:'', active:true, formats:['5s','7s'], prices:{'5s':800,'7s':1200,'Mini 7s':0}, ownerId:'owner-01' },
    { id:'turf-03', name:'CITY SPORTS ARENA', location:'Kanhangad', description:'Book your next match · Demo venue', image:'', active:true, formats:['5s','7s'], prices:{'5s':850,'7s':1250,'Mini 7s':0}, ownerId:'owner-02' },
  ],
  owners: [
    { id:'owner-01', name:'Demo Turf Owner', code:'OWNER01', pin:'1234', phone:'9876543210', active:true, turfIds:['turf-01','turf-02'], creditBalance:0 },
    { id:'owner-02', name:'City Arena Owner', code:'OWNER02', pin:'1234', phone:'9876501234', active:true, turfIds:['turf-03'], creditBalance:0 },
  ],
  bookings: [],
  activity: [],
});
function loadStore() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return seed();
    const parsed = JSON.parse(saved);
    const base = seed();
    return {
      ...base, ...parsed,
      app: { ...base.app, ...(parsed.app||{}), noticeBoard:{...base.app.noticeBoard,...(parsed.app?.noticeBoard||{})} },
      turfs: Array.isArray(parsed.turfs) ? parsed.turfs : base.turfs,
      owners: Array.isArray(parsed.owners) ? parsed.owners : base.owners,
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    };
  } catch { return seed(); }
}

async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
      await LocalNotifications.createChannel({
        id:'panthalchaam_alerts', name:'PANTHALCHAAM booking alerts',
        description:'Local booking and payment updates', importance:5, visibility:1,
        sound:'panthalchaam_alert', vibration:true, lights:true, lightColor:'#d9a83f'
      });
      return true;
    } catch (e) { console.warn('Local notification setup:', e); return false; }
  }
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
}
async function notifyDevice(title, body, enabled=true) {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({ notifications:[{
        id: Math.max(1, Math.floor(Date.now() % 2147483000)), title, body,
        channelId:'panthalchaam_alerts', schedule:{ at:new Date(Date.now()+700) },
        sound:'panthalchaam_alert.wav'
      }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon:'/icon.png' });
      try { const audio = new Audio('/panthalchaam_notification.wav'); await audio.play(); } catch {}
    }
    if (navigator.vibrate) navigator.vibrate([160,70,160]);
  } catch (e) { console.warn('Notification failed:', e); }
}
function addActivity(db, text) {
  return [{ id:makeId('EVT'), text, at:new Date().toISOString() }, ...(db.activity||[])].slice(0,40);
}
async function imageToData(file, max=1000, quality=.78) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror=()=>reject(new Error('Could not read image.'));
    reader.onload=()=>{
      const img=new Image(); img.onerror=()=>reject(new Error('Invalid image.'));
      img.onload=()=>{
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function App() {
  const [db,setDb] = useState(loadStore);
  const [page,setPage] = useState('home');
  const [role,setRole] = useState('guest');
  const [ownerSession,setOwnerSession] = useState(null);
  const [modal,setModal] = useState(null);
  const [toast,setToast] = useState('');
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('All');
  const [notificationsReady,setNotificationsReady] = useState(false);
  const [busy,setBusy] = useState(false);

  useEffect(()=>{ try { localStorage.setItem(STORE_KEY,JSON.stringify(db)); } catch(e) { setToast('Storage is full. Try a smaller image.'); } },[db]);
  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),3200); return ()=>clearTimeout(t); } },[toast]);
  useEffect(()=>{ if(Capacitor.isNativePlatform()) requestNotificationPermission().then(setNotificationsReady); },[]);

  const activeTurfs = db.turfs.filter(t=>t.active);
  const visibleBookings = useMemo(()=>db.bookings.filter(b=> role==='admin' || (role==='owner' && b.ownerId===ownerSession?.id)),[db.bookings,role,ownerSession]);
  const notify = async (title,body)=>notifyDevice(title,body,db.app.soundEnabled);
  const patchDb = (updater) => setDb(prev=>typeof updater==='function'?updater(prev):updater);
  const go = (next)=>{ setPage(next); setModal(null); window.scrollTo({top:0,behavior:'smooth'}); };

  const openAdmin = () => setModal({type:'adminLogin'});
  const openOwner = () => setModal({type:'ownerLogin'});
  const signOut = () => { setRole('guest'); setOwnerSession(null); go('home'); setToast('Signed out of demo mode.'); };
  const signInAdmin = async (pin) => {
    if (!String(pin||'').trim()) return setToast('Enter any demo PIN to continue.');
    setRole('admin'); setOwnerSession(null); setModal(null); go('admin'); setToast('Demo admin access granted.');
  };
  const signInOwner = (code,pin) => {
    const owner=db.owners.find(o=>o.code.toLowerCase()===String(code).trim().toLowerCase() && o.active);
    if (!owner) return setToast('Owner ID not found or account is inactive.');
    if (String(pin)!==String(owner.pin)) return setToast('Incorrect demo owner PIN.');
    setRole('owner'); setOwnerSession(owner); setModal(null); go('owner'); setToast(`Welcome, ${owner.name}.`);
  };
  const saveTurf = (turf) => {
    if (turf.formats.includes('Mini 7s') && db.turfs.some(t=>t.id!==turf.id && t.formats.includes('Mini 7s'))) return setToast('Only one turf can offer Mini 7s. Remove it from the other turf first.');
    if (!turf.formats.includes('Mini 7s') && db.turfs.some(t=>t.id===turf.id && t.formats.includes('Mini 7s')) && !db.turfs.some(t=>t.id!==turf.id && t.formats.includes('Mini 7s'))) return setToast('Keep Mini 7s enabled at exactly one turf.');
    if (!turf.name.trim() || !turf.location.trim() || !turf.prices['5s'] || !turf.prices['7s']) return setToast('Enter a turf name, location and both 5s/7s prices.');
    if (turf.formats.includes('Mini 7s') && !turf.prices['Mini 7s']) return setToast('Enter the Mini 7s price.');
    patchDb(prev=>{ const savedTurf={...turf,id:turf.id||makeId('TURF')}; const turfs=turf.id?prev.turfs.map(t=>t.id===turf.id?savedTurf:t):[...prev.turfs,savedTurf]; const owners=prev.owners.map(o=>({...o,turfIds:savedTurf.ownerId?(o.id===savedTurf.ownerId?[...new Set([...(o.turfIds||[]),savedTurf.id])]: (o.turfIds||[]).filter(id=>id!==savedTurf.id)):(o.turfIds||[]).filter(id=>id!==savedTurf.id)})); return {...prev,turfs,owners,activity:addActivity(prev,`${turf.id?'Updated':'Added'} turf ${turf.name}.`)}; });
    setModal(null); setToast('Turf saved on this device.');
  };
  const saveOwner = (owner) => {
    if (!owner.name.trim() || !owner.code.trim() || !owner.pin.trim()) return setToast('Enter owner name, Owner ID and PIN.');
    if (db.owners.some(o=>o.id!==owner.id && o.code.toLowerCase()===owner.code.toLowerCase())) return setToast('That Owner ID is already used.');
    patchDb(prev=>{ const savedOwner={...owner,id:owner.id||makeId('OWN'),creditBalance:Number(owner.creditBalance||0)}; const owners=owner.id?prev.owners.map(o=>o.id===owner.id?savedOwner:o):[...prev.owners,savedOwner]; const turfs=prev.turfs.map(t=>{ const wasAssigned=(owner.turfIds||[]).includes(t.id); return {...t,ownerId:wasAssigned?savedOwner.id:(t.ownerId===savedOwner.id?'':t.ownerId)}; }); const syncedOwners=owners.map(o=>({...o,turfIds:turfs.filter(t=>t.ownerId===o.id).map(t=>t.id)})); return {...prev,owners:syncedOwners,turfs,activity:addActivity(prev,`${owner.id?'Updated':'Created'} owner ${owner.name}.`)}; });
    setModal(null); setToast('Owner saved locally.');
  };
  const createBooking = async (payload) => {
    const turf=db.turfs.find(t=>t.id===payload.turfId && t.active);
    if (!turf) return setToast('This turf is currently unavailable.');
    if (!/^\d{10}$/.test(payload.phone)) return setToast('Customer phone must contain exactly 10 digits.');
    const start=Number(payload.time.slice(0,2))*60;
    const end=start+Number(payload.duration)*60;
    if (start<360 || end>1380) return setToast('Choose a time between 06:00 and 23:00.');
    const dateStart=new Date(`${payload.date}T${payload.time}:00`);
    if (!Number.isFinite(dateStart.getTime()) || dateStart.getTime()<=Date.now()) return setToast('Choose a future date and start time.');
    const collision=db.bookings.some(b=>b.turfId===turf.id && b.date===payload.date && !['Declined','Cancelled'].includes(b.status) && start < (Number(b.time.slice(0,2))*60+Number(b.duration)*60) && (Number(b.time.slice(0,2))*60) < end);
    if (collision) return setToast('That slot already has a pending or approved booking.');
    const price=Number(turf.prices[payload.format]||0)*Number(payload.duration);
    const booking={ id:makeId('PT'), accessCode:String(Math.floor(100000+Math.random()*900000)), turfId:turf.id, turfName:turf.name, ownerId:turf.ownerId||'', format:payload.format, price, date:payload.date, time:payload.time, duration:Number(payload.duration), name:payload.name.trim(), phone:payload.phone, status:'Pending', payment:'Not submitted', paymentRef:'', creditAdded:false, createdAt:new Date().toISOString() };
    patchDb(prev=>({ ...prev, bookings:[booking,...prev.bookings], activity:addActivity(prev,`New booking ${booking.id} created for ${turf.name}.`) }));
    setModal({type:'bookingSuccess',booking});
    await notify('New PANTHALCHAAM booking',`${booking.turfName}: ${booking.format} request from ${booking.name}.`);
  };
  const changeBookingStatus = async (bookingId,status) => {
    const booking=db.bookings.find(b=>b.id===bookingId); if (!booking) return;
    patchDb(prev=>({ ...prev, bookings:prev.bookings.map(b=>b.id===bookingId?{...b,status,updatedAt:new Date().toISOString()}:b), activity:addActivity(prev,`Booking ${bookingId} marked ${status}.`) }));
    await notify(`Booking ${status}`,`${booking.turfName} · ${booking.name} · ${booking.date} ${booking.time}`);
    setToast(`Booking ${status.toLowerCase()}.`);
  };
  const submitProof = async (bookingId,reference) => {
    if (!reference.trim()) return setToast('Enter the payment reference.');
    patchDb(prev=>({ ...prev, bookings:prev.bookings.map(b=>b.id===bookingId?{...b,payment:'Proof submitted',paymentRef:reference.trim(),paymentSubmittedAt:new Date().toISOString()}:b), activity:addActivity(prev,`Payment proof submitted for ${bookingId}.`) }));
    await notify('Payment proof received',`Payment reference submitted for booking ${bookingId}.`);
    setToast('Payment proof saved on this device.');
  };
  const verifyPayment = async (bookingId) => {
    const booking=db.bookings.find(b=>b.id===bookingId); if (!booking) return;
    if (booking.status!=='Approved') return setToast('Only approved bookings can be verified.');
    if (!booking.ownerId) return setToast('Assign this turf to an owner before verifying payment.');
    patchDb(prev=>{
      const nextBookings=prev.bookings.map(b=>b.id===bookingId?{...b,payment:'Verified',creditAdded:true,updatedAt:new Date().toISOString()}:b);
      const nextOwners=prev.owners.map(o=>o.id===booking.ownerId?{...o,creditBalance:Number(o.creditBalance||0)+(booking.creditAdded?0:50)}:o);
      return {...prev,bookings:nextBookings,owners:nextOwners,activity:addActivity(prev,`Payment verified for ${bookingId}; ₹${booking.creditAdded?0:50} owner credit ${booking.creditAdded?'already added':'added once'}.`)};
    });
    await notify('Payment verified','Payment is verified. The owner credit has been updated.');
    setToast('Payment verified. ₹50 owner credit added once.');
  };
  const updateSettings = (app) => { patchDb(prev=>({...prev,app,activity:addActivity(prev,'App settings and notice board updated.')})); setToast('Settings saved on this device.'); };
  const exportData = () => {
    const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='PANTHALCHAAM-local-demo-backup.json'; a.click(); URL.revokeObjectURL(url);
  };
  const importData = async (file) => {
    try { const parsed=JSON.parse(await file.text()); if(!parsed || !Array.isArray(parsed.turfs)||!Array.isArray(parsed.bookings)||!Array.isArray(parsed.owners)) throw new Error(); patchDb(parsed); setToast('Backup imported.'); }
    catch { setToast('That backup file is not valid.'); }
  };
  const resetDemo = () => { if(!window.confirm('Reset all local demo data? This removes demo bookings, owners and settings from this device.')) return; patchDb(seed()); setRole('guest'); setOwnerSession(null); go('home'); setToast('Demo data reset.'); };

  const renderHome = () => <>
    {db.app.noticeBoard.enabled && (db.app.noticeBoard.message || db.app.noticeBoard.image) && <section className="notice-panel"><div className="notice-head"><span className="notice-icon"><MessageSquare size={16}/></span><div><b>NOTICE BOARD</b><small>Message from PANTHALCHAAM</small></div><span className="live-pill">LIVE DEMO</span></div>{db.app.noticeBoard.message&&<p>{db.app.noticeBoard.message}</p>}{db.app.noticeBoard.image&&<img className="notice-photo" src={db.app.noticeBoard.image} alt="Admin notice"/>}</section>}
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> LOCAL DEMO EXPERIENCE</div><h1>BOOK YOUR<br/><em>GAME TIME.</em></h1><p>Pick your turf. Choose your format. Get your match on.</p><div className="hero-actions"><button className="btn btn-gold" onClick={()=>document.getElementById('turfs')?.scrollIntoView({behavior:'smooth'})}>Explore turfs <ArrowRight size={16}/></button><button className="btn btn-ghost" onClick={()=>go('myBookings')}>My bookings</button></div><div className="hero-stats"><div><b>{activeTurfs.length.toString().padStart(2,'0')}</b><span>ACTIVE TURFS</span></div><i/><div><b>3</b><span>FORMATS* </span></div><i/><div><b>06–23</b><span>BOOKING HOURS</span></div></div></div><div className="hero-art"><img src={db.app.logo||'/icon.png'} alt="PANTHALCHAAM logo"/><div className="art-glow"/><div className="art-caption"><b>BOOK · PLAY · ENJOY</b><span>YOUR GAME STARTS HERE</span></div></div></section>
    <section className="section-head" id="turfs"><div><div className="eyebrow">FIND YOUR ARENA</div><h2>Featured <em>turfs</em></h2><p>Choose a ground and reserve your preferred time slot.</p></div><span className="section-count">{activeTurfs.length} VENUES</span></section>
    <div className="turf-grid">{activeTurfs.map((t,index)=><TurfCard key={t.id} turf={t} index={index} onBook={()=>setModal({type:'book',turfId:t.id})}/>)}</div>
    <div className="format-strip"><div className="format-icon"><Trophy size={22}/></div><div><b>Pick your format</b><span>5-a-side · 7-a-side · Mini 7-a-side*</span></div><small>*Mini 7s is available at one demo venue only.</small></div>
  </>;

  const renderMyBookings = () => <section className="page-section"><PageTitle eyebrow="YOUR ACTIVITY" title={<>My <em>bookings</em></>} text="Bookings created on this device are listed here."/>{db.bookings.length===0?<EmptyState icon={<CalendarDays/>} title="No bookings yet" text="Choose a turf and make your first demo booking." action={()=>go('home')} actionText="Explore turfs"/>:<div className="booking-list">{db.bookings.map(b=><CustomerBooking key={b.id} booking={b} settings={db.app} onProof={submitProof}/>)}</div>}</section>;

  const renderAdmin = () => {
    const pending=db.bookings.filter(b=>b.status==='Pending').length;
    const paid=db.bookings.filter(b=>b.payment==='Verified').length;
    const earned=db.bookings.filter(b=>b.payment==='Verified').reduce((sum,b)=>sum+Number(b.price||0),0);
    return <section className="page-section admin-view"><PageTitle eyebrow="CONTROL ROOM · LOCAL DEMO" title={<>Admin <em>dashboard</em></>} text="All changes are stored only on this device. No live accounts or shared data." actions={<button className="btn btn-ghost btn-sm" onClick={signOut}><LogOut size={15}/> Sign out</button>}/>
      <div className="admin-tabs">{[['overview','Overview'],['bookings','Bookings'],['turfs','Turfs'],['owners','Owners'],['settings','Notice & settings']].map(([id,label])=><button key={id} className={page===`admin-${id}`?'active':''} onClick={()=>go(id==='overview'?'admin':`admin-${id}`)}>{label}</button>)}</div>
      {page==='admin'&&<>
        <div className="stats-grid"><Stat icon={<CalendarDays/>} label="TOTAL BOOKINGS" value={db.bookings.length}/><Stat icon={<Clock3/>} label="PENDING REQUESTS" value={pending} accent/><Stat icon={<Users/>} label="OWNERS" value={db.owners.length}/><Stat icon={<CircleDollarSign/>} label="VERIFIED SALES" value={money(earned)}/></div>
        <div className="admin-columns"><div className="panel"><div className="panel-head"><div><b>Recent bookings</b><small>Latest local demo requests</small></div><button className="text-action" onClick={()=>go('admin-bookings')}>View all <ArrowRight size={14}/></button></div>{db.bookings.slice(0,5).length?db.bookings.slice(0,5).map(b=><MiniBooking key={b.id} booking={b}/>):<div className="panel-empty">No bookings created yet.</div>}</div><div className="panel"><div className="panel-head"><div><b>Quick actions</b><small>Manage your demo operation</small></div><Zap size={17}/></div><div className="quick-grid"><button onClick={()=>setModal({type:'turfEdit'})}><Plus/>Add turf</button><button onClick={()=>setModal({type:'ownerEdit'})}><UserCog/>Add owner</button><button onClick={()=>go('admin-settings')}><MessageSquare/>New notice</button><button onClick={exportData}><Download/>Backup data</button></div></div></div>
      </>}
      {page==='admin-bookings'&&<BookingsManager bookings={db.bookings} turfs={db.turfs} owners={db.owners} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} onStatus={changeBookingStatus} onVerify={verifyPayment}/>}
      {page==='admin-turfs'&&<ManageTurfs turfs={db.turfs} owners={db.owners} onAdd={()=>setModal({type:'turfEdit'})} onEdit={t=>setModal({type:'turfEdit',turf:t})} onToggle={id=>patchDb(prev=>({...prev,turfs:prev.turfs.map(t=>t.id===id?{...t,active:!t.active}:t)}))} />}
      {page==='admin-owners'&&<ManageOwners owners={db.owners} turfs={db.turfs} onAdd={()=>setModal({type:'ownerEdit'})} onEdit={o=>setModal({type:'ownerEdit',owner:o})} onToggle={id=>patchDb(prev=>({...prev,owners:prev.owners.map(o=>o.id===id?{...o,active:!o.active}:o)}))}/>}
      {page==='admin-settings'&&<SettingsManager app={db.app} onSave={updateSettings} onExport={exportData} onImport={importData} onReset={resetDemo} notificationsReady={notificationsReady} onEnableNotifications={async()=>{const ok=await requestNotificationPermission();setNotificationsReady(ok);setToast(ok?'On-device notifications enabled.':'Notification permission was not granted.')}}/>}
      {page!=='admin'&&!['admin-bookings','admin-turfs','admin-owners','admin-settings'].includes(page)&&null}
    </section>;
  };

  const renderOwner = () => {
    const owner=db.owners.find(o=>o.id===ownerSession?.id);
    if(!owner || !owner.active) return <section className="page-section"><EmptyState icon={<ShieldCheck/>} title="Owner account unavailable" text="This local demo owner is inactive." action={signOut} actionText="Sign out"/></section>;
    const ownTurfs=db.turfs.filter(t=>(owner.turfIds||[]).includes(t.id));
    const ownBookings=db.bookings.filter(b=>b.ownerId===owner.id);
    return <section className="page-section"><PageTitle eyebrow="OWNER PORTAL · LOCAL DEMO" title={<>Welcome, <em>{owner.name}</em></>} text="Manage only the turfs assigned to this demo owner." actions={<button className="btn btn-ghost btn-sm" onClick={signOut}><LogOut size={15}/> Sign out</button>}/>
      <div className="stats-grid"><Stat icon={<MapPin/>} label="ASSIGNED TURFS" value={ownTurfs.length}/><Stat icon={<CalendarDays/>} label="BOOKINGS" value={ownBookings.length}/><Stat icon={<Clock3/>} label="PENDING" value={ownBookings.filter(b=>b.status==='Pending').length} accent/><Stat icon={<Wallet/>} label="OWNER CREDIT" value={money(owner.creditBalance)}/></div>
      <div className="owner-block"><div className="block-title"><div><div className="eyebrow">YOUR VENUES</div><h3>Assigned <em>turfs</em></h3></div></div><div className="owner-turf-grid">{ownTurfs.map(t=><div className="owner-turf" key={t.id}><div className="mini-pitch"><Trophy size={21}/></div><div><b>{t.name}</b><span>{t.location} · {(t.formats||[]).join(' / ')}</span></div><span className={t.active?'status active':'status'}>{t.active?'ACTIVE':'HIDDEN'}</span></div>)}</div></div>
      <div className="owner-block"><div className="block-title"><div><div className="eyebrow">BOOKING QUEUE</div><h3>Your <em>bookings</em></h3></div><span className="section-count">{ownBookings.length} TOTAL</span></div><BookingsManager bookings={ownBookings} turfs={ownTurfs} owners={db.owners} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} onStatus={changeBookingStatus} onVerify={()=>setToast('Payment verification is handled by admin in this demo.') } ownerMode/></div>
      <div className="credit-note"><Wallet size={21}/><div><b>Owner credit balance</b><span>₹50 credit is added once by admin when a booking payment is verified. Demo balance: {money(owner.creditBalance)}.</span></div></div>
    </section>;
  };

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={()=>go('home')}><img src={db.app.logo||'/icon.png'} alt=""/><span><b>{db.app.name||'PANTHALCHAAM'}</b><small>BOOK · PLAY · ENJOY</small></span></button><div className="top-actions"><span className="local-tag"><span/> OFFLINE DEMO</span>{role==='guest'?<><button className="top-link" onClick={openOwner}>Owner</button><button className="btn btn-gold btn-sm" onClick={openAdmin}><ShieldCheck size={15}/> Admin access</button></>:<><span className="role-label"><User size={14}/> {role==='admin'?'ADMIN':ownerSession?.name||'OWNER'}</span><button className="icon-btn" title="Home" onClick={()=>go('home')}><Home size={17}/></button></>}</div></header>
    <main className="main-wrap">{page==='home'&&renderHome()}{page==='myBookings'&&renderMyBookings()}{page.startsWith('admin')&&role==='admin'&&renderAdmin()}{page==='owner'&&role==='owner'&&renderOwner()}{((page.startsWith('admin')&&role!=='admin')||(page==='owner'&&role!=='owner'))&&<section className="page-section"><EmptyState icon={<ShieldCheck/>} title="Demo sign-in required" text="Open Admin Access or Owner Portal to continue." action={openAdmin} actionText="Admin access"/></section>}</main>
    <footer className="footer"><div className="footer-brand"><img src={db.app.logo||'/icon.png'}/><div><b>PANTHALCHAAM</b><span>BOOK · PLAY · ENJOY</span></div></div><p>Local showcase build · All data stays on this device.</p><div className="footer-links"><button onClick={()=>go('home')}>Home</button><button onClick={()=>go('myBookings')}>My bookings</button><button onClick={openOwner}>Owner</button><button onClick={openAdmin}>Admin</button></div></footer>
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
    {modal&&<Modal title={modal.type==='adminLogin'?'Admin access':modal.type==='ownerLogin'?'Owner portal':modal.type==='book'?'Book this turf':modal.type==='bookingSuccess'?'Booking created':modal.type==='turfEdit'?(modal.turf?'Edit turf':'Add a turf'):modal.type==='ownerEdit'?(modal.owner?'Edit owner':'Create owner'):'PANTHALCHAAM'} onClose={()=>setModal(null)} wide={['turfEdit','ownerEdit','book','bookingSuccess'].includes(modal.type)}>
      {modal.type==='adminLogin'&&<AdminLogin onSubmit={signInAdmin}/>}
      {modal.type==='ownerLogin'&&<OwnerLogin owners={db.owners} onSubmit={signInOwner}/>}
      {modal.type==='book'&&<BookingForm turf={db.turfs.find(t=>t.id===modal.turfId)} onSubmit={createBooking} onCancel={()=>setModal(null)}/>}
      {modal.type==='bookingSuccess'&&<BookingSuccess booking={modal.booking} onClose={()=>{setModal(null);go('myBookings')}}/>}
      {modal.type==='turfEdit'&&<TurfEditor turf={modal.turf} owners={db.owners} turfs={db.turfs} onSave={saveTurf} onCancel={()=>setModal(null)}/>}
      {modal.type==='ownerEdit'&&<OwnerEditor owner={modal.owner} turfs={db.turfs} onSave={saveOwner} onCancel={()=>setModal(null)}/>}
    </Modal>}
  </div>;
}

function Modal({title,onClose,children,wide}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${wide?'modal-wide':''}`}><div className="modal-head"><div><div className="eyebrow">PANTHALCHAAM · LOCAL DEMO</div><h3>{title}</h3></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><div className="modal-body">{children}</div></div></div>; }
function AdminLogin({onSubmit}) { const [pin,setPin]=useState(''); return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit(pin)}}><div className="login-emblem"><ShieldCheck size={28}/></div><p className="modal-intro">Enter any PIN to open the demo admin dashboard. This is intentionally unlocked for presentation only.</p><label>DEMO ADMIN PIN</label><input autoFocus type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Enter any PIN"/><button className="btn btn-gold btn-full" type="submit">Enter admin dashboard <ArrowRight size={16}/></button><small className="helper">No real authentication is used in this local showcase.</small></form>; }
function OwnerLogin({owners,onSubmit}) { const [code,setCode]=useState('OWNER01'); const [pin,setPin]=useState('1234'); return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit(code,pin)}}><div className="login-emblem"><UserCog size={28}/></div><p className="modal-intro">Sign in as a locally created demo owner. Sample Owner ID: <b>OWNER01</b> · PIN: <b>1234</b>.</p><label>OWNER ID</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Owner ID"/><label>PIN</label><input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Owner PIN"/><button className="btn btn-gold btn-full" type="submit">Open owner portal <ArrowRight size={16}/></button><small className="helper">Available demo owners: {owners.filter(o=>o.active).map(o=>o.code).join(', ')||'none yet'}.</small></form>; }
function BookingForm({turf,onSubmit,onCancel}) { const formats=turf?.formats||['5s','7s']; const [form,setForm]=useState({date:today(),time:'18:00',duration:'1',format:formats[0],name:'',phone:''}); const set=(k,v)=>setForm(p=>({...p,[k]:v})); const price=Number(turf?.prices?.[form.format]||0)*Number(form.duration); if(!turf)return <p>Turf unavailable.</p>; return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit({...form,turfId:turf.id})}}><div className="booking-turf-summary"><div className="mini-pitch"><Trophy size={22}/></div><div><b>{turf.name}</b><span><MapPin size={13}/> {turf.location}</span></div></div><div className="field-grid"><div><label>DATE</label><input required type="date" min={today()} value={form.date} onChange={e=>set('date',e.target.value)}/></div><div><label>START TIME</label><select value={form.time} onChange={e=>set('time',e.target.value)}>{Array.from({length:18},(_,i)=>`${String(i+6).padStart(2,'0')}:00`).map(x=><option key={x}>{x}</option>)}</select></div><div><label>FORMAT</label><select value={form.format} onChange={e=>set('format',e.target.value)}>{formats.map(x=><option key={x}>{x}</option>)}</select></div><div><label>DURATION</label><select value={form.duration} onChange={e=>set('duration',e.target.value)}>{[1,2,3,4].map(x=><option key={x} value={x}>{x} hour{x>1?'s':''}</option>)}</select></div></div><div><label>CUSTOMER NAME</label><input required maxLength={80} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full name"/></div><div><label>PHONE NUMBER</label><input required inputMode="numeric" maxLength={10} value={form.phone} onChange={e=>set('phone',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit mobile number"/></div><div className="price-summary"><div><span>Hourly price</span><b>{money(turf.prices[form.format])}</b></div><div><span>Duration</span><b>{form.duration} hour(s)</b></div><div className="total"><span>ESTIMATED TOTAL</span><b>{money(price)}</b></div></div><div className="form-actions"><button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button><button className="btn btn-gold" type="submit">Create local booking <ArrowRight size={16}/></button></div><small className="helper">Demo booking is stored only on this phone. No real reservation is sent.</small></form>; }
function BookingSuccess({booking,onClose}) { return <div className="success-card"><div className="success-icon"><Check size={30}/></div><h3>You're on the list!</h3><p>Your local demo booking has been created.</p><div className="success-details"><div><span>BOOKING ID</span><b>{booking.id}</b></div><div><span>ACCESS CODE</span><b>{booking.accessCode}</b></div><div><span>TURF / FORMAT</span><b>{booking.turfName} · {booking.format}</b></div><div><span>DATE & TIME</span><b>{booking.date} · {booking.time}</b></div><div><span>ESTIMATED TOTAL</span><b>{money(booking.price)}</b></div></div><button className="btn btn-gold btn-full" onClick={onClose}>View my booking <ArrowRight size={16}/></button><small className="helper">Keep your booking ID and access code for this local demo.</small></div>; }
function TurfEditor({turf,owners,turfs,onSave,onCancel}) { const [v,setV]=useState(()=>turf?{...turf,prices:{...turf.prices}}:{id:'',name:'',location:'Kasaragod',description:'',image:'',active:true,formats:['5s','7s'],prices:{'5s':900,'7s':1200,'Mini 7s':1600},ownerId:owners[0]?.id||''}); const [error,setError]=useState(''); const set=(k,x)=>setV(p=>({...p,[k]:x})); const toggleFormat=f=>setV(p=>({...p,formats:p.formats.includes(f)?p.formats.filter(x=>x!==f):[...p.formats,f]})); const upload=async e=>{try{const data=await imageToData(e.target.files?.[0],1000,.75);set('image',data)}catch(err){setError(err.message)}}; return <form className="form-stack" onSubmit={e=>{e.preventDefault();if(!v.formats.includes('5s')||!v.formats.includes('7s'))return setError('Every turf must offer both 5s and 7s.');if(v.formats.includes('Mini 7s')&&turfs.some(t=>t.id!==v.id&&t.formats.includes('Mini 7s')))return setError('Only one turf can offer Mini 7s.');onSave(v)}}><div className="field-grid"><div><label>TURF NAME</label><input required value={v.name} onChange={e=>set('name',e.target.value)} placeholder="Turf name"/></div><div><label>LOCATION</label><input required value={v.location} onChange={e=>set('location',e.target.value)} placeholder="Town / area"/></div></div><div><label>DESCRIPTION</label><input value={v.description||''} onChange={e=>set('description',e.target.value)} placeholder="Short turf description"/></div><div><label>FORMATS</label><div className="check-row"><label className="check-pill"><input type="checkbox" checked={v.formats.includes('5s')} onChange={()=>toggleFormat('5s')} disabled/> 5s <small>Required</small></label><label className="check-pill"><input type="checkbox" checked={v.formats.includes('7s')} onChange={()=>toggleFormat('7s')} disabled/> 7s <small>Required</small></label><label className="check-pill"><input type="checkbox" checked={v.formats.includes('Mini 7s')} onChange={()=>toggleFormat('Mini 7s')}/> Mini 7s</label></div></div><div className="field-grid three"><div><label>5s PRICE / HR (₹)</label><input required type="number" min="1" value={v.prices['5s']} onChange={e=>set('prices',{...v.prices,'5s':Number(e.target.value)})}/></div><div><label>7s PRICE / HR (₹)</label><input required type="number" min="1" value={v.prices['7s']} onChange={e=>set('prices',{...v.prices,'7s':Number(e.target.value)})}/></div>{v.formats.includes('Mini 7s')&&<div><label>MINI 7s / HR (₹)</label><input required type="number" min="1" value={v.prices['Mini 7s']} onChange={e=>set('prices',{...v.prices,'Mini 7s':Number(e.target.value)})}/></div>}</div><div className="field-grid"><div><label>ASSIGNED OWNER</label><select value={v.ownerId||''} onChange={e=>set('ownerId',e.target.value)}><option value="">No owner assigned</option>{owners.map(o=><option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}</select></div><div><label>TURF VISIBILITY</label><select value={String(v.active)} onChange={e=>set('active',e.target.value==='true')}><option value="true">Active / visible</option><option value="false">Hidden / inactive</option></select></div></div><div><label>TURF IMAGE</label><label className="upload-box"><ImagePlus size={19}/><span>{v.image?'Replace turf image':'Upload turf image'}</span><input type="file" accept="image/*" onChange={upload}/></label>{v.image&&<img className="preview-image" src={v.image} alt="Turf preview"/>}</div>{error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}<div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button><button className="btn btn-gold" type="submit"><Save size={16}/> Save turf</button></div></form>; }
function OwnerEditor({owner,turfs,onSave,onCancel}) { const [v,setV]=useState(()=>owner?{...owner,turfIds:[...(owner.turfIds||[])]}:{id:'',name:'',code:'OWNER'+String(Math.floor(10+Math.random()*89)),pin:'1234',phone:'',active:true,turfIds:[]}); const toggle=id=>setV(p=>({...p,turfIds:p.turfIds.includes(id)?p.turfIds.filter(x=>x!==id):[...p.turfIds,id]})); return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSave(v)}}><div className="field-grid"><div><label>OWNER NAME</label><input required value={v.name} onChange={e=>setV(p=>({...p,name:e.target.value}))}/></div><div><label>OWNER ID</label><input required value={v.code} onChange={e=>setV(p=>({...p,code:e.target.value.toUpperCase()}))}/></div><div><label>DEMO PIN</label><input required value={v.pin} onChange={e=>setV(p=>({...p,pin:e.target.value}))}/></div><div><label>PHONE (OPTIONAL)</label><input maxLength={10} inputMode="numeric" value={v.phone||''} onChange={e=>setV(p=>({...p,phone:e.target.value.replace(/\D/g,'').slice(0,10)}))}/></div></div><div><label>ASSIGN TURFS</label><div className="owner-assign-list">{turfs.map(t=><label key={t.id} className="assign-item"><input type="checkbox" checked={v.turfIds.includes(t.id)} onChange={()=>toggle(t.id)}/><span><b>{t.name}</b><small>{t.location}</small></span></label>)}</div></div><div><label>ACCOUNT STATUS</label><select value={String(v.active)} onChange={e=>setV(p=>({...p,active:e.target.value==='true'}))}><option value="true">Active</option><option value="false">Inactive</option></select></div><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button><button className="btn btn-gold" type="submit"><Save size={16}/> Save owner</button></div></form>; }

function TurfCard({turf,index,onBook}) { return <article className="turf-card"><div className={`turf-image turf-image-${index%3}`} style={turf.image?{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.72)),url(${turf.image})`}:{}}>{!turf.image&&<><div className="pitch-lines"/><span className="pitch-center"/></>}<span className="turf-chip">{turf.location}</span><span className="turf-index">0{index+1}</span><div className="image-title"><span>AVAILABLE FOR BOOKING</span><b>{turf.name}</b></div></div><div className="turf-card-body"><p>{turf.description||'Book a slot and bring your team.'}</p><div className="format-prices">{turf.formats.map(f=><div key={f}><span>{f}</span><b>{money(turf.prices[f])}<small>/hr</small></b></div>)}</div><button className="btn btn-gold btn-full" onClick={onBook}>Book this turf <ArrowRight size={16}/></button></div></article>; }
function PageTitle({eyebrow,title,text,actions}) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{text&&<p>{text}</p>}</div>{actions}</div>; }
function Stat({icon,label,value,accent}) { return <div className={`stat-card ${accent?'stat-accent':''}`}><span className="stat-icon">{icon}</span><div><small>{label}</small><b>{value}</b></div></div>; }
function EmptyState({icon,title,text,action,actionText}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action&&<button className="btn btn-gold" onClick={action}>{actionText||'Continue'} <ArrowRight size={15}/></button>}</div>; }
function MiniBooking({booking}) { return <div className="mini-booking"><div className="booking-avatar"><CalendarDays size={17}/></div><div className="mini-booking-main"><b>{booking.name} <span>{booking.format}</span></b><small>{booking.turfName} · {booking.date} · {booking.time}</small></div><div className="mini-booking-end"><StatusPill status={booking.status}/><b>{money(booking.price)}</b></div></div>; }
function StatusPill({status}) { const cls=status==='Approved'?'approved':status==='Declined'?'declined':status==='Cancelled'?'declined':'pending'; return <span className={`status-pill ${cls}`}>{status}</span>; }
function CustomerBooking({booking,settings,onProof}) { const [reference,setReference]=useState(booking.paymentRef||''); const [show,setShow]=useState(false); return <article className="customer-booking"><div className="customer-booking-head"><div><div className="eyebrow">BOOKING · {booking.id}</div><h3>{booking.turfName}</h3><span className="muted-line">{booking.date} · {booking.time} · {booking.duration} hr · {booking.format}</span></div><StatusPill status={booking.status}/></div><div className="customer-booking-info"><div><small>CUSTOMER</small><b>{booking.name}</b></div><div><small>PHONE</small><b>{booking.phone}</b></div><div><small>TOTAL</small><b>{money(booking.price)}</b></div><div><small>PAYMENT</small><b>{booking.payment}</b></div></div><div className="access-code"><span>ACCESS CODE</span><b>{booking.accessCode}</b><button onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={14}/>:<Eye size={14}/>} {show?'Hide':'Show details'}</button></div>{show&&<div className="access-extra"><p>Booking ID: <b>{booking.id}</b></p><p>Local-only demo: this booking is saved in the app on this device.</p></div>}{booking.status==='Approved'&&booking.payment!=='Verified'&&<div className="payment-proof"><div><b>Submit payment proof</b><span>Enter the UPI transaction/reference number.</span></div><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Payment reference" disabled={booking.payment==='Proof submitted'}/><button className="btn btn-gold btn-sm" disabled={booking.payment==='Proof submitted'} onClick={()=>onProof(booking.id,reference)}>Submit proof</button></div>}{booking.payment==='Verified'&&<div className="verified-note"><CheckCircle2 size={15}/> Payment verified in this demo.</div>}{settings.qr&&booking.status==='Approved'&&booking.payment!=='Verified'&&<details className="qr-details"><summary>View payment QR / UPI details</summary><div>{settings.qr.startsWith('data:')&&<img src={settings.qr} alt="Payment QR"/>}{settings.upi&&<b>{settings.upi}</b>}</div></details>}</article>; }
function BookingsManager({bookings,turfs,owners,filter,setFilter,query,setQuery,onStatus,onVerify,ownerMode=false}) { const filtered=bookings.filter(b=>(filter==='All'||b.status===filter||b.payment===filter)&&(!query||`${b.id} ${b.name} ${b.phone} ${b.turfName}`.toLowerCase().includes(query.toLowerCase()))); return <div className="panel bookings-manager"><div className="manager-toolbar"><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, turf or booking ID"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Pending</option><option>Approved</option><option>Declined</option><option>Proof submitted</option><option>Verified</option></select></div>{filtered.length===0?<div className="panel-empty">No bookings match this filter yet.</div>:<div className="manage-booking-list">{filtered.map(b=><div className="manage-booking" key={b.id}><div className="manage-booking-top"><div><span className="booking-id">{b.id}</span><h4>{b.name} <small>{b.format}</small></h4><p>{b.turfName} · {b.date} at {b.time} · {b.duration} hour(s)</p><small className="muted-line">{b.phone} · Access code {b.accessCode}</small></div><div className="manage-booking-price"><b>{money(b.price)}</b><StatusPill status={b.status}/></div></div><div className="manage-booking-bottom"><span className="payment-label">PAYMENT: <b>{b.payment}</b>{b.paymentRef&&` · ${b.paymentRef}`}</span><div className="action-row">{b.status==='Pending'&&<><button className="btn btn-green btn-xs" onClick={()=>onStatus(b.id,'Approved')}><Check size={13}/> Approve</button><button className="btn btn-danger btn-xs" onClick={()=>onStatus(b.id,'Declined')}><X size={13}/> Decline</button></>}{!ownerMode&&b.status==='Approved'&&b.payment==='Proof submitted'&&<button className="btn btn-gold btn-xs" onClick={()=>onVerify(b.id)}><CheckCircle2 size={13}/> Verify payment + ₹50 credit</button>}{b.status==='Approved'&&b.payment==='Not submitted'&&<span className="waiting-text">Waiting for payment proof</span>}{b.payment==='Verified'&&<span className="verified-note"><CheckCircle2 size={14}/> Verified</span>}</div></div></div>)}</div>}</div>; }
function ManageTurfs({turfs,owners,onAdd,onEdit,onToggle}) { return <div className="manage-section"><div className="section-toolbar"><div><h3>Manage <em>turfs</em></h3><p>Every venue has 5s and 7s; Mini 7s is limited to one turf.</p></div><button className="btn btn-gold btn-sm" onClick={onAdd}><Plus size={15}/> Add turf</button></div><div className="manage-grid">{turfs.map(t=><div className="manage-turf" key={t.id}><div className="manage-turf-image">{t.image?<img src={t.image}/>:<Trophy size={25}/>}<span className={t.active?'status active':'status'}>{t.active?'ACTIVE':'HIDDEN'}</span></div><div className="manage-turf-content"><b>{t.name}</b><span><MapPin size={12}/> {t.location}</span><div className="turf-price-line">5s {money(t.prices['5s'])} · 7s {money(t.prices['7s'])}{t.formats.includes('Mini 7s')&&` · Mini ${money(t.prices['Mini 7s'])}`}</div><small>Owner: {owners.find(o=>o.id===t.ownerId)?.name||'Unassigned'}</small><div className="manage-actions"><button onClick={()=>onEdit(t)}><Edit3 size={14}/> Edit</button><button onClick={()=>onToggle(t.id)}>{t.active?<EyeOff size={14}/>:<Eye size={14}/>} {t.active?'Hide':'Activate'}</button></div></div></div>)}</div></div>; }
function ManageOwners({owners,turfs,onAdd,onEdit,onToggle}) { return <div className="manage-section"><div className="section-toolbar"><div><h3>Owner <em>accounts</em></h3><p>Create demo owner access and assign venues.</p></div><button className="btn btn-gold btn-sm" onClick={onAdd}><Plus size={15}/> Add owner</button></div><div className="owners-grid">{owners.map(o=><div className="owner-card" key={o.id}><div className="owner-card-head"><div className="owner-avatar"><User size={20}/></div><span className={o.active?'status active':'status'}>{o.active?'ACTIVE':'INACTIVE'}</span></div><h3>{o.name}</h3><span className="owner-code">{o.code}</span><div className="owner-card-meta"><div><small>ASSIGNED TURFS</small><b>{(o.turfIds||[]).length}</b></div><div><small>CREDIT BALANCE</small><b>{money(o.creditBalance)}</b></div></div><p>{turfs.filter(t=>(o.turfIds||[]).includes(t.id)).map(t=>t.name).join(' · ')||'No turf assigned'}</p><div className="manage-actions"><button onClick={()=>onEdit(o)}><Edit3 size={14}/> Edit account</button><button onClick={()=>onToggle(o.id)}>{o.active?'Deactivate':'Activate'}</button></div></div>)}</div></div>; }
function SettingsManager({app,onSave,onExport,onImport,onReset,notificationsReady,onEnableNotifications}) {
  const [v,setV]=useState(()=>({...app,noticeBoard:{...app.noticeBoard}}));
  const [note,setNote]=useState('');
  const upload=async (field,file,max=1000)=>{
    try { const image=await imageToData(file,max,.76); setV(p=>({...p,[field]:image})); }
    catch(e) { setNote(e.message); }
  };
  const uploadNotice=async e=>{
    try { const image=await imageToData(e.target.files?.[0],1000,.76); setV(p=>({...p,noticeBoard:{...p.noticeBoard,image}})); }
    catch(err) { setNote(err.message); }
  };
  return (
    <div className="settings-layout">
      <div className="panel settings-panel">
        <div className="panel-head"><div><b>App identity</b><small>Local demo branding and payment options</small></div><Settings size={18}/></div>
        <div className="form-stack">
          <label>APP NAME</label>
          <input value={v.name} onChange={e=>setV(p=>({...p,name:e.target.value}))}/>
          <label>IN-APP LOGO / ICON IMAGE</label>
          <label className="upload-box"><ImagePlus size={18}/><span>Choose a replacement image</span><input type="file" accept="image/*" onChange={e=>upload('logo',e.target.files?.[0],700)}/></label>
          <img className="settings-logo-preview" src={v.logo||'/icon.png'} alt="Logo preview"/>
          <small className="helper">The launcher icon stays the original PANTHALCHAAM icon in this demo. This changes the logo shown inside the app.</small>
          <label>UPI ID</label>
          <input value={v.upi||''} onChange={e=>setV(p=>({...p,upi:e.target.value}))} placeholder="yourname@upi"/>
          <label>PAYMENT QR</label>
          <label className="upload-box"><QrCode size={18}/><span>Upload payment QR image</span><input type="file" accept="image/*" onChange={e=>upload('qr',e.target.files?.[0],800)}/></label>
          {v.qr && <div className="qr-preview"><img src={v.qr} alt="QR preview"/><button type="button" className="text-action" onClick={()=>setV(p=>({...p,qr:''}))}>Remove QR</button></div>}
          <label>COMMISSION DISPLAY (%)</label>
          <input type="number" min="0" max="100" value={v.commission??10} onChange={e=>setV(p=>({...p,commission:Number(e.target.value)}))}/>
          <label className="switch-line"><span><b>Booking ringtone & vibration</b><small>Use the PANTHALCHAAM notification sound when supported.</small></span><input type="checkbox" checked={v.soundEnabled!==false} onChange={e=>setV(p=>({...p,soundEnabled:e.target.checked}))}/></label>
          <button type="button" className="btn btn-gold btn-full" onClick={()=>{onSave(v);setNote('Settings saved.')}}><Save size={16}/> Save app settings</button>
        </div>
      </div>
      <div className="panel settings-panel">
        <div className="panel-head"><div><b>Optional notice board</b><small>Admin-created message shown on the home screen</small></div><MessageSquare size={18}/></div>
        <div className="form-stack">
          <label className="switch-line"><span><b>Show notice board on home</b><small>Turn the custom notice on or off.</small></span><input type="checkbox" checked={!!v.noticeBoard.enabled} onChange={e=>setV(p=>({...p,noticeBoard:{...p.noticeBoard,enabled:e.target.checked}}))}/></label>
          <label>NOTICE MESSAGE</label>
          <textarea rows="5" maxLength={1200} value={v.noticeBoard.message||''} onChange={e=>setV(p=>({...p,noticeBoard:{...p.noticeBoard,message:e.target.value}}))} placeholder="Write a notice for customers..."/>
          <label>OPTIONAL NOTICE IMAGE</label>
          <label className="upload-box"><ImagePlus size={18}/><span>Upload notice image</span><input type="file" accept="image/*" onChange={uploadNotice}/></label>
          {v.noticeBoard.image && <div className="notice-preview"><img src={v.noticeBoard.image} alt="Notice preview"/><button type="button" className="text-action" onClick={()=>setV(p=>({...p,noticeBoard:{...p.noticeBoard,image:''}}))}>Remove image</button></div>}
          <button type="button" className="btn btn-gold btn-full" onClick={()=>onSave(v)}><Save size={16}/> Save notice board</button>
          <div className="notice-preview-text"><span className="live-pill">HOME PREVIEW</span><b>{v.noticeBoard.enabled?'NOTICE BOARD ENABLED':'NOTICE BOARD HIDDEN'}</b><p>{v.noticeBoard.message||'Your optional notice message will appear here.'}</p></div>
        </div>
      </div>
      <div className="panel settings-panel data-panel">
        <div className="panel-head"><div><b>Local demo data</b><small>Backup, restore or reset this device's sample data.</small></div><Smartphone size={18}/></div>
        <div className="data-actions">
          <button type="button" className="btn btn-ghost" onClick={onExport}><Download size={16}/> Export backup</button>
          <label className="btn btn-ghost"><UploadIcon/> Import backup<input type="file" accept="application/json,.json" onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/></label>
          <button type="button" className="btn btn-danger" onClick={onReset}><Trash2 size={15}/> Reset demo</button>
        </div>
        <div className="notification-setting"><div><b>On-device notifications</b><small>{notificationsReady?'Permission is enabled on this device.':'Enable local alerts and ringtone for demo booking activity.'}</small></div><button type="button" className="btn btn-gold btn-sm" onClick={onEnableNotifications}>{notificationsReady?'Enabled':'Enable alerts'}</button></div>
        <p className="local-warning"><Info size={15}/> This is a showcase-only app. No Firebase, server, internet booking sync or multi-phone connection is used. Export a backup before clearing app data.</p>
      </div>
      {note && <div className="inline-error">{note}</div>}
    </div>
  );
}
function UploadIcon(){return <Download size={15}/>}

export default App;
