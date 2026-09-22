import React, { useState, useMemo, useEffect } from "react";
import {
  Search, MessageSquare, User, ShieldCheck, Plus, MapPin, Clock, Heart, Phone,
  Lock, Check, X, ChevronLeft, Smartphone, Laptop, Car, Home, Shirt, Sofa,
  Wrench, Gamepad2, BadgeCheck, Flag, Send, ImagePlus, Eye, LayoutGrid,
  SlidersHorizontal, AlertTriangle, CreditCard, Sparkles, Store,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  INBOX — Marketplace du Cameroun · démo responsive (screencast)      */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

.ib * { box-sizing:border-box; margin:0; padding:0; }
.ib {
  --or:#FF6E14; --or-dk:#E85A02; --or-lt:#FFF3EB;
  --ink:#171A1F; --ink-2:#4A5159; --muted:#7C848D;
  --bg:#F6F6F7; --card:#FFFFFF; --line:#E5E6E8; --line-2:#F0F0F1;
  --ok:#1E9E62; --ok-bg:#E9F7F0; --warn:#B27400; --warn-bg:#FDF3DF; --no:#D33A2C; --no-bg:#FCEAE8;
  font-family:'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  background:var(--bg); color:var(--ink); min-height:100vh; -webkit-font-smoothing:antialiased;
}
.ib button, .ib input, .ib select, .ib textarea { font:inherit; color:inherit; }
.ib button { cursor:pointer; border:none; background:none; }
.ib :focus-visible { outline:2px solid var(--or); outline-offset:2px; }
.mono { font-family:'JetBrains Mono', ui-monospace, monospace; }
.wrap { max-width:1180px; margin:0 auto; padding:0 24px; }
.ico { flex:none; }
.scroll-x { overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.scroll-x::-webkit-scrollbar { display:none; }

/* ---- en-tête ---- */
.top { background:#fff; border-bottom:1px solid var(--line); position:sticky; top:0; z-index:40; }
.top-in { display:flex; align-items:center; gap:18px; height:70px; }
.logo { display:flex; align-items:center; gap:8px; font-weight:800; font-size:25px; letter-spacing:-.035em; flex:none; }
.logo-m { width:32px; height:32px; border-radius:9px; background:var(--or); display:grid; place-items:center; color:#fff; }
.bar { flex:1; display:flex; align-items:center; gap:10px; border:1.5px solid var(--line);
       border-radius:10px; padding:0 14px; height:44px; min-width:0; transition:border-color .15s, box-shadow .15s; background:#fff; }
.bar:focus-within { border-color:var(--or); box-shadow:0 0 0 3px var(--or-lt); }
.bar input { flex:1; border:none; font-size:15px; min-width:0; background:none; }
.bar input::placeholder { color:var(--muted); }
.bar .sep { width:1px; height:24px; background:var(--line); flex:none; }
.bar select { border:none; background:none; font-size:14px; color:var(--ink-2); font-weight:600; cursor:pointer; max-width:150px; }
.nav { display:flex; align-items:center; gap:4px; }
.nb { display:flex; flex-direction:column; align-items:center; gap:3px; padding:7px 12px; border-radius:9px;
      font-size:11.5px; font-weight:600; color:var(--ink-2); position:relative; transition:background .15s, color .15s; }
.nb:hover { background:var(--bg); color:var(--ink); }
.nb.on { color:var(--or); }
.pip { position:absolute; top:2px; right:6px; min-width:17px; height:17px; padding:0 4px; border-radius:9px;
       background:var(--or); color:#fff; font-size:10.5px; font-weight:700; display:grid; place-items:center; }
.cta { display:flex; align-items:center; gap:7px; background:var(--or); color:#fff; font-weight:700; font-size:14px;
       padding:11px 17px; border-radius:10px; white-space:nowrap; transition:background .15s, transform .1s; }
.cta:hover { background:var(--or-dk); } .cta:active { transform:scale(.97); }

/* ---- barre d'onglets mobile ---- */
.tabs { display:none; position:fixed; left:0; right:0; bottom:0; z-index:50; background:#fff;
        border-top:1px solid var(--line); padding:6px 4px calc(6px + env(safe-area-inset-bottom));
        box-shadow:0 -2px 14px rgba(0,0,0,.06); }
.tabs-in { display:flex; align-items:flex-end; justify-content:space-around; max-width:560px; margin:0 auto; }
.tab { display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; padding:7px 2px;
       font-size:10.5px; font-weight:600; color:var(--muted); position:relative; min-height:52px; }
.tab.on { color:var(--or); }
.tab .pip { top:0; right:calc(50% - 20px); }
.tab-add { flex:none; margin:0 4px; }
.tab-add .bubble { width:52px; height:52px; border-radius:50%; background:var(--or); color:#fff;
                   display:grid; place-items:center; box-shadow:0 5px 14px rgba(255,110,20,.42); transform:translateY(-10px); }
.tab-add span { display:block; margin-top:-6px; font-size:10.5px; font-weight:600; color:var(--muted); }

/* ---- rubans catégories ---- */
.cats { background:#fff; border-bottom:1px solid var(--line); }
.cats-in { display:flex; gap:6px; padding:10px 24px; max-width:1180px; margin:0 auto; }
.cat { display:flex; align-items:center; gap:7px; font-size:13.5px; font-weight:600; color:var(--ink-2);
       padding:8px 14px; border-radius:22px; white-space:nowrap; border:1px solid transparent; transition:.15s; }
.cat:hover { background:var(--bg); }
.cat.on { background:var(--or-lt); color:var(--or-dk); border-color:#FFD9BF; }

/* ---- accueil ---- */
.hero { padding:40px 0 30px; display:grid; grid-template-columns:1.4fr 1fr; gap:44px; align-items:center; }
.hero h1 { font-size:46px; line-height:1.05; font-weight:800; letter-spacing:-.035em; }
.hero h1 em { font-style:normal; color:var(--or); }
.hero p { margin-top:16px; color:var(--ink-2); font-size:16.5px; max-width:46ch; line-height:1.55; }
.trust { display:flex; gap:10px; margin-top:24px; flex-wrap:wrap; }
.pill { display:flex; align-items:center; gap:8px; background:#fff; border:1px solid var(--line);
        border-radius:24px; padding:9px 15px; font-size:13.5px; font-weight:600; white-space:nowrap; }
.pill svg { color:var(--or); }
.heroart { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px; }
.heroart h4 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:14px; }
.hr-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid var(--line-2); }
.hr-row:last-child { border-bottom:none; }
.hr-ic { width:38px; height:38px; border-radius:10px; background:var(--or-lt); color:var(--or-dk); display:grid; place-items:center; flex:none; }
.hr-row b { font-size:14px; display:block; } .hr-row span { font-size:12.5px; color:var(--muted); }
.hr-n { margin-left:auto; font-family:'JetBrains Mono',monospace; font-weight:700; font-size:16px; color:var(--or); }

/* ---- filtres ---- */
.filters { display:flex; gap:10px; align-items:center; padding:16px 0 20px; border-top:1px solid var(--line); flex-wrap:wrap; }
.field { display:flex; align-items:center; gap:8px; background:#fff; border:1.5px solid var(--line);
         border-radius:9px; padding:9px 13px; font-size:14px; font-weight:600; transition:border-color .15s; white-space:nowrap; }
.field:hover { border-color:#CFD1D4; }
.field select, .field input { border:none; background:none; font-weight:600; width:auto; }
.field input { width:120px; }
.count { margin-left:auto; font-size:14px; color:var(--muted); font-weight:600; white-space:nowrap; }

/* ---- grille ---- */
.grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; padding-bottom:52px; }
.ad { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden;
      text-align:left; display:flex; flex-direction:column; transition:transform .16s ease, box-shadow .16s ease; }
.ad:hover { transform:translateY(-4px); box-shadow:0 12px 28px rgba(23,26,31,.10); }
.thumb { aspect-ratio:4/3; position:relative; display:grid; place-items:center; background:var(--line-2);
         background-image:repeating-linear-gradient(135deg,rgba(0,0,0,.02) 0 12px,transparent 12px 24px); }
.thumb > svg { color:#B9BDC2; }
.tag { position:absolute; top:10px; left:10px; background:rgba(23,26,31,.78); color:#fff;
       font-size:11px; font-weight:700; padding:4px 9px; border-radius:6px; }
.badge { position:absolute; top:10px; right:10px; display:flex; align-items:center; gap:4px; background:var(--or);
         color:#fff; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; }
.fav { position:absolute; bottom:10px; right:10px; width:34px; height:34px; border-radius:50%; background:#fff;
       display:grid; place-items:center; color:var(--ink-2); box-shadow:0 2px 8px rgba(0,0,0,.14); }
.fav:hover { color:var(--or); }
.ad-b { padding:13px 14px 15px; flex:1; display:flex; flex-direction:column; gap:6px; }
.ad-t { font-size:14.5px; font-weight:600; line-height:1.35; }
.price { font-family:'JetBrains Mono',monospace; font-weight:700; font-size:17px; }
.price small { font-size:11px; font-weight:500; color:var(--muted); }
.meta { margin-top:auto; padding-top:8px; font-size:12.5px; color:var(--muted); display:flex; gap:14px; font-weight:500; flex-wrap:wrap; }
.meta span { display:flex; align-items:center; gap:4px; }

/* ---- pages ---- */
.page { padding:28px 0 68px; animation:fade .22s ease; }
@keyframes fade { from { opacity:0; transform:translateY(6px); } }
.back { display:flex; align-items:center; gap:5px; font-size:14px; font-weight:600; color:var(--ink-2); margin-bottom:18px; }
.back:hover { color:var(--or); }
h2.hd { font-size:31px; font-weight:800; letter-spacing:-.03em; }
.sub { color:var(--ink-2); font-size:15px; margin-top:6px; }
.panel { background:#fff; border:1px solid var(--line); border-radius:12px; }
.pad { padding:22px; }

/* ---- fiche annonce ---- */
.detail { display:grid; grid-template-columns:1.6fr 1fr; gap:26px; align-items:start; }
.d-left { display:grid; gap:20px; align-content:start; }
.d-right { display:grid; gap:16px; align-content:start; }
.gal { aspect-ratio:16/10; border-radius:12px; display:grid; place-items:center; background:var(--line-2);
       background-image:repeating-linear-gradient(135deg,rgba(0,0,0,.02) 0 14px,transparent 14px 28px); }
.gal > svg { color:#B9BDC2; }
.gal-row { display:flex; gap:9px; margin-top:9px; }
.gal-row div { flex:1; aspect-ratio:16/10; max-height:70px; border-radius:9px; display:grid; place-items:center;
               background:var(--line-2); color:#C3C7CC; cursor:pointer; border:1.5px solid transparent; }
.gal-row div:hover, .gal-row div.on { border-color:var(--or); }
.kv { display:flex; justify-content:space-between; gap:16px; padding:11px 0; border-bottom:1px solid var(--line-2); font-size:14px; }
.kv span:first-child { color:var(--muted); font-weight:500; }
.kv span:last-child { font-weight:600; text-align:right; }
.d-price { font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--or); font-size:30px; margin:10px 0 18px; }
.d-price small { font-size:13px; font-weight:500; color:var(--muted); }

.seller { display:flex; align-items:center; gap:12px; }
.av { border-radius:50%; background:var(--or-lt); color:var(--or-dk); display:grid; place-items:center;
      font-weight:700; flex:none; width:46px; height:46px; font-size:17px; }
.btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:13px;
       border-radius:10px; font-weight:700; font-size:14.5px; transition:.15s; min-height:48px; }
.btn-p { background:var(--or); color:#fff; } .btn-p:hover { background:var(--or-dk); }
.btn-s { background:#fff; border:1.5px solid var(--line); } .btn-s:hover { border-color:var(--ink); }
.note { display:flex; gap:9px; align-items:flex-start; font-size:12.5px; color:var(--ok); background:var(--ok-bg);
        border:1px solid #CFEADD; padding:11px 12px; border-radius:9px; line-height:1.45; }

/* ---- messagerie ---- */
.chat { display:grid; grid-template-columns:310px 1fr; height:540px; overflow:hidden; }
.convs { border-right:1px solid var(--line); overflow-y:auto; }
.conv { display:flex; gap:11px; padding:14px; border-bottom:1px solid var(--line-2); width:100%; text-align:left; align-items:center; }
.conv:hover { background:var(--bg); }
.conv.on { background:var(--or-lt); box-shadow:inset 3px 0 0 var(--or); }
.conv b { font-size:14px; } .conv p { font-size:12.5px; color:var(--muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.thread { display:flex; flex-direction:column; min-width:0; }
.thead { padding:13px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:12px; }
.thead-back { display:none; }
.msgs { flex:1; overflow-y:auto; padding:20px 18px; display:flex; flex-direction:column; gap:10px; background:var(--bg); }
.bub { max-width:64%; padding:10px 14px; border-radius:14px; font-size:14px; line-height:1.45; animation:pop .2s ease; }
@keyframes pop { from { opacity:0; transform:translateY(6px); } }
.bub.me { align-self:flex-end; background:var(--or); color:#fff; border-bottom-right-radius:4px; }
.bub.them { align-self:flex-start; background:#fff; border:1px solid var(--line); border-bottom-left-radius:4px; }
.bub time { display:block; font-size:10.5px; opacity:.65; margin-top:4px; }
.compose { display:flex; gap:10px; padding:13px; border-top:1px solid var(--line); }
.compose input { flex:1; border:1.5px solid var(--line); border-radius:22px; padding:11px 16px; font-size:16px; min-width:0; }
.compose input:focus { border-color:var(--or); }
.send { width:46px; height:46px; border-radius:50%; background:var(--or); color:#fff; display:grid; place-items:center; flex:none; }
.send:hover { background:var(--or-dk); }

/* ---- formulaire ---- */
.form { display:grid; gap:17px; max-width:660px; }
.lab { display:block; font-size:13px; font-weight:700; margin-bottom:6px; }
.inp { width:100%; border:1.5px solid var(--line); border-radius:9px; padding:11px 13px; font-size:15px; background:#fff; }
.inp:focus { border-color:var(--or); box-shadow:0 0 0 3px var(--or-lt); }
.two { display:grid; grid-template-columns:1fr 1fr; gap:17px; }
.hint { font-size:12.5px; color:var(--muted); margin-top:5px; }
.drop { display:flex; align-items:center; justify-content:center; gap:9px; width:100%; border:1.5px dashed var(--line);
        border-radius:9px; padding:22px; color:var(--muted); font-weight:600; font-size:14px; background:#fff; }
.drop:hover { border-color:var(--or); color:var(--or-dk); background:var(--or-lt); }

/* ---- compte / modération ---- */
.cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
.kpi { background:#fff; border:1px solid var(--line); border-radius:12px; padding:17px; }
.kpi .ki { width:34px; height:34px; border-radius:9px; background:var(--or-lt); color:var(--or-dk); display:grid; place-items:center; margin-bottom:11px; }
.kpi b { font-family:'JetBrains Mono',monospace; font-size:26px; display:block; line-height:1.1; }
.kpi span { font-size:12.5px; color:var(--muted); font-weight:600; }
.row { display:flex; align-items:center; gap:15px; padding:15px 18px; border-bottom:1px solid var(--line-2); flex-wrap:wrap; }
.row:last-child { border-bottom:none; }
.rt { font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); background:var(--bg); }
.tn { width:46px; height:46px; border-radius:9px; background:var(--line-2); color:#B9BDC2; display:grid; place-items:center; flex:none; }
.chip { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:20px; white-space:nowrap; }
.chip.ok { background:var(--ok-bg); color:var(--ok); }
.chip.wait { background:var(--warn-bg); color:var(--warn); }
.chip.no { background:var(--no-bg); color:var(--no); }
.mini { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:13px; font-weight:700;
        padding:10px 14px; border-radius:9px; border:1.5px solid var(--line); background:#fff; white-space:nowrap; transition:.15s; }
.mini:hover { border-color:var(--ink); }
.mini.go { background:var(--or); color:#fff; border-color:var(--or); } .mini.go:hover { background:var(--or-dk); }
.mini.ko { color:var(--no); border-color:#F3D3CF; } .mini.ko:hover { border-color:var(--no); }
.mod-act { display:grid; gap:8px; flex:none; }

/* ---- offres ---- */
.plans { display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:800px; }
.plan { background:#fff; border:1px solid var(--line); border-radius:14px; padding:26px; }
.plan.hi { border:2px solid var(--or); position:relative; }
.plan.hi:after { content:'LE PLUS CHOISI'; position:absolute; top:-11px; left:26px; background:var(--or); color:#fff;
   font-size:10.5px; font-weight:800; letter-spacing:.1em; padding:4px 11px; border-radius:6px; }
.plan h3 { font-size:21px; font-weight:800; }
.plan .p { font-family:'JetBrains Mono',monospace; font-size:31px; margin:10px 0 4px; font-weight:700; }
.plan ul { list-style:none; margin:18px 0 22px; display:grid; gap:11px; }
.plan li { font-size:14px; display:flex; gap:9px; align-items:flex-start; font-weight:500; }
.plan li svg { color:var(--or); flex:none; margin-top:2px; }
.pays { display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
.pay { display:flex; align-items:center; gap:7px; border:1.5px solid var(--line); border-radius:9px;
       padding:11px 13px; font-size:13px; font-weight:600; }
.pay:hover { border-color:var(--or); }
.pay.on { border-color:var(--or); background:var(--or-lt); color:var(--or-dk); }

/* ---- toast ---- */
.toast { position:fixed; bottom:26px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:10px;
  background:var(--ink); color:#fff; padding:14px 22px; border-radius:11px; font-size:14px; font-weight:600;
  z-index:90; box-shadow:0 12px 34px rgba(0,0,0,.28); animation:up .26s cubic-bezier(.2,.9,.3,1);
  max-width:calc(100vw - 32px); }
.toast svg { color:#6FE0A6; flex:none; }
@keyframes up { from { opacity:0; transform:translate(-50%,16px); } }
.empty { display:grid; justify-items:center; gap:10px; text-align:center; padding:60px 20px; color:var(--muted); font-size:14.5px; font-weight:500; }
.empty svg { color:#C9CDD2; }

/* ================= RESPONSIVE ================= */
@media (max-width:1180px) { .grid { grid-template-columns:repeat(3,1fr); } }

@media (max-width:1080px) {
  .nb span { display:none; }
  .nb { padding:9px 10px; } .nb .pip { top:0; right:0; }
}

@media (max-width:940px) {
  .wrap { padding:0 18px; }
  .hero { grid-template-columns:1fr; gap:26px; padding:30px 0 24px; }
  .hero h1 { font-size:36px; }
  .hero p { font-size:15.5px; }
  .detail { grid-template-columns:1fr; gap:18px; }
  .d-left, .d-right { display:contents; }
  .d-gal { order:1; } .d-seller { order:2; } .d-info { order:3; } .d-tips { order:4; }
  .plans { grid-template-columns:1fr; }
  .cards { grid-template-columns:repeat(2,1fr); }
  h2.hd { font-size:26px; }
}

@media (max-width:760px) {
  .grid { grid-template-columns:repeat(2,1fr); gap:12px; }
  .top-in { height:auto; flex-wrap:wrap; gap:10px; padding:10px 0; }
  .logo { font-size:22px; }
  .bar { order:3; width:100%; flex-basis:100%; }
  .bar .sep, .bar select { display:none; }
  .nav { margin-left:auto; gap:2px; }
  .nav .nb, .nav .cta { display:none; }
  .nav .nb.mob { display:flex; }
  .tabs { display:block; }
  .page, .grid { padding-bottom:96px; }
  main.wrap { padding-bottom:20px; }
  .cats-in { padding:10px 18px; }
  .filters { gap:8px; padding:14px 0 16px; }
  .count { width:100%; margin-left:0; order:9; }
  .pad { padding:18px; }
  .two { grid-template-columns:1fr; gap:14px; }
  .chat { grid-template-columns:1fr; height:auto; }
  .convs { border-right:none; max-height:none; }
  .msgs { height:52vh; min-height:300px; }
  .thead-back { display:grid; place-items:center; width:36px; height:36px; border-radius:9px; background:var(--bg); flex:none; }
  .bub { max-width:82%; }
  .hero h1 { font-size:30px; }
  .trust { gap:8px; } .pill { font-size:12.5px; padding:8px 12px; }
  .toast { bottom:88px; }
  .row { padding:14px; gap:12px; }
  .mod-act { grid-template-columns:1fr 1fr; width:100%; }
  .kv { font-size:13.5px; }
  .d-price { font-size:26px; }
}

@media (max-width:430px) {
  .wrap { padding:0 14px; }
  .grid { grid-template-columns:1fr; }
  .thumb { aspect-ratio:16/9; }
  .hero h1 { font-size:26px; }
  .hero p { font-size:15px; }
  .cards { grid-template-columns:1fr 1fr; gap:10px; }
  .kpi { padding:14px; } .kpi b { font-size:22px; }
  .heroart { padding:16px; }
  .plan { padding:20px; }
  .field input { width:100%; min-width:110px; }
  .row .price { font-size:15px; }
}

@media (prefers-reduced-motion:reduce) { .ib * { animation:none !important; transition:none !important; } }
`;

const CATS = [
  { id: "phones", l: "Téléphones", I: Smartphone },
  { id: "electro", l: "Électronique", I: Laptop },
  { id: "vehicules", l: "Véhicules", I: Car },
  { id: "immo", l: "Immobilier", I: Home },
  { id: "mode", l: "Mode", I: Shirt },
  { id: "maison", l: "Maison", I: Sofa },
  { id: "services", l: "Services", I: Wrench },
  { id: "loisirs", l: "Loisirs", I: Gamepad2 },
];
const VILLES = ["Douala", "Yaoundé", "Bafoussam", "Bamenda", "Garoua", "Kribi", "Buea", "Ngaoundéré", "Maroua"];
const cat = (id) => CATS.find((c) => c.id === id) || CATS[0];
const fcfa = (n) => new Intl.NumberFormat("fr-FR").format(n);
const ago = (h) => (h < 1 ? "à l'instant" : h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`);

const SEED = [
  { id: 1, t: "iPhone 13 Pro 256 Go — état neuf", p: 385000, c: "phones", v: "Douala", q: "Akwa", h: 2, s: "Ariane N.", pro: true, ver: true, d: "Acheté en février, sous garantie Orange jusqu'en décembre. Batterie à 96 %. Boîte, câble et facture fournis. Aucun choc, film posé dès le premier jour." },
  { id: 2, t: "Toyota RAV4 2016 essence — 98 000 km", p: 8900000, c: "vehicules", v: "Yaoundé", q: "Bastos", h: 5, s: "Garage Etoa", pro: true, ver: true, d: "Importée du Japon, dédouanée, carte grise à jour. Entretien suivi au garage, vidange faite à 96 000 km. Visite possible sur place du lundi au samedi." },
  { id: 3, t: "Studio meublé Bonapriso — charges comprises", p: 150000, c: "immo", v: "Douala", q: "Bonapriso", h: 8, s: "Marlyse T.", u: "/mois", d: "28 m², climatisé, eau et courant inclus, groupe électrogène de l'immeuble. Deux mois de caution. Quartier calme, à 5 min du carrefour." },
  { id: 4, t: "MacBook Air M1 8/256 Go", p: 520000, c: "electro", v: "Yaoundé", q: "Mvan", h: 11, s: "Cédric K.", d: "Clavier AZERTY, 112 cycles de charge. Housse et chargeur d'origine inclus. Je vends pour passer sur une machine plus puissante." },
  { id: 5, t: "Groupe électrogène 5 kVA insonorisé", p: 275000, c: "maison", v: "Bafoussam", q: "Marché A", h: 14, s: "Élec Ouest", pro: true, d: "Démarrage électrique, réservoir 15 L, environ 8 h d'autonomie. Révisé, livré avec les câbles de raccordement." },
  { id: 6, t: "Toghu sur mesure — broderie main", p: 45000, c: "mode", v: "Bamenda", q: "Nkwen", h: 20, s: "Atelier Njoya", ver: true, d: "Confection en 6 jours à partir de vos mesures. Velours de bonne tenue, broderie entièrement faite main. Livraison partout au Cameroun." },
  { id: 7, t: "Cours particuliers maths & physique (Tle C/D)", p: 15000, c: "services", v: "Douala", q: "Bonamoussadi", h: 26, s: "Fabrice M.", u: "/séance", d: "Ingénieur, 4 ans d'accompagnement au baccalauréat. Séances de 2 h à domicile ou en visio, suivi hebdomadaire des exercices." },
  { id: 8, t: "Congélateur horizontal 300 L", p: 190000, c: "maison", v: "Garoua", q: "Poumpoumré", h: 32, s: "Aminatou B.", d: "Trois ans d'usage, joint changé l'an dernier, refroidit très vite. Vendu parce que je déménage." },
  { id: 9, t: "Yamaha DT 125 — papiers en règle", p: 750000, c: "vehicules", v: "Maroua", q: "Domayo", h: 38, s: "Ousmane D.", d: "Moteur revu en janvier, pneu arrière neuf. Carte grise et assurance valides jusqu'en mars." },
  { id: 10, t: "Terrain titré 500 m² — bord de route", p: 12000000, c: "immo", v: "Kribi", q: "Mpangou", h: 44, s: "Cabinet Ebolo", pro: true, ver: true, d: "Titre foncier disponible, bornage effectué. À 900 m de la plage, eau et électricité en bordure de parcelle." },
  { id: 11, t: "Samsung Galaxy A54 128 Go", p: 165000, c: "phones", v: "Buea", q: "Molyko", h: 51, s: "Blaise F.", d: "Double SIM, écran sans rayure, coque et protection posées. Facture d'achat conservée." },
  { id: 12, t: "PS5 Slim + 2 manettes + 3 jeux", p: 340000, c: "loisirs", v: "Douala", q: "Deïdo", h: 58, s: "Yann O.", d: "Achetée en juin, très peu servi. Jeux inclus : EA FC 25, GTA V, Spider-Man 2. Emballage d'origine." },
  { id: 13, t: "Robe wax cousue main — taille 38/40", p: 28000, c: "mode", v: "Yaoundé", q: "Mokolo", h: 66, s: "Chez Mama Grace", d: "Pagne Vlisco, doublure coton. Retouches offertes sous 7 jours après l'essayage." },
  { id: 14, t: "Kit solaire 450 W + batterie 200 Ah", p: 410000, c: "electro", v: "Ngaoundéré", q: "Baladji", h: 74, s: "SolarNord", pro: true, d: "Panneau monocristallin, régulateur MPPT 40 A, batterie gel. Installation possible en supplément dans l'Adamaoua." },
].map((x) => ({ ...x, st: "ok" }));

const PENDING = [
  { id: 90, t: "Lot de 12 téléphones — prix de gros", p: 900000, c: "phones", v: "Douala", q: "Marché Congo", h: 1, s: "Import Express", st: "wait", d: "Lot complet, provenance Dubaï. Pas de facture, vente en l'état, paiement à la livraison uniquement." },
  { id: 91, t: "Appartement 3 chambres Bonanjo", p: 350000, c: "immo", v: "Douala", q: "Bonanjo", h: 3, s: "Nadège P.", u: "/mois", st: "wait", d: "3 chambres, 2 salles d'eau, parking privé. Libre au 1er du mois prochain, visites en soirée." },
  { id: 92, t: "Placement rapide — argent doublé en 7 jours", p: 50000, c: "services", v: "Yaoundé", q: "Centre", h: 4, s: "Invest Plus", st: "wait", d: "Versez et récupérez le double la semaine suivante. Places limitées, réponse par message privé uniquement." },
];

const CONVS = [
  { id: 1, who: "Ariane N.", ad: "iPhone 13 Pro 256 Go", unread: 2, m: [
    { me: false, x: "Bonjour, l'iPhone est toujours disponible ?", t: "09:12" },
    { me: true, x: "Bonjour ! Oui, toujours disponible.", t: "09:20" },
    { me: false, x: "Vous pouvez faire 360 000 ? Je prends aujourd'hui.", t: "09:21" },
    { me: false, x: "Je suis à Akwa, je peux passer avant 17 h.", t: "09:21" },
  ]},
  { id: 2, who: "Garage Etoa", ad: "Toyota RAV4 2016", unread: 0, m: [
    { me: true, x: "Bonsoir, le RAV4 est visible ce samedi ?", t: "Hier 18:40" },
    { me: false, x: "Bonsoir, oui de 9 h à 15 h au garage à Bastos.", t: "Hier 19:02" },
    { me: true, x: "Parfait, je passe vers 10 h.", t: "Hier 19:05" },
  ]},
  { id: 3, who: "Atelier Njoya", ad: "Toghu sur mesure", unread: 0, m: [
    { me: false, x: "Merci pour la commande, on démarre la broderie demain.", t: "Lun 14:22" },
  ]},
];

/* ------------------------------------------------------------------ */

export default function Inbox() {
  const [view, setView] = useState("home");
  const [ads, setAds] = useState([...SEED, ...PENDING]);
  const [sel, setSel] = useState(null);
  const [shot, setShot] = useState(0);
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("all");
  const [fv, setFv] = useState("all");
  const [fp, setFp] = useState("");
  const [sort, setSort] = useState("recent");
  const [convs, setConvs] = useState(CONVS);
  const [cid, setCid] = useState(1);
  const [openThread, setOpenThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [pro, setPro] = useState(false);
  const [used, setUsed] = useState(3);
  const [pay, setPay] = useState("momo");
  const [toast, setToast] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [form, setForm] = useState({ t: "", p: "", c: "phones", v: "Douala", q: "", d: "" });

  /* détection de la largeur pour la messagerie en deux écrans */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = (e) => setNarrow(e.matches);
    on(mq);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);

  const say = (m) => setToast(m);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);
  const go = (v) => { setView(v); window.scrollTo?.({ top: 0, behavior: "smooth" }); };

  const unread = convs.reduce((a, c) => a + c.unread, 0);
  const pend = ads.filter((a) => a.st === "wait");
  const mine = ads.filter((a) => a.mine);

  const list = useMemo(() => {
    let r = ads.filter((a) => a.st === "ok");
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((a) => (a.t + a.d + a.v).toLowerCase().includes(s)); }
    if (fc !== "all") r = r.filter((a) => a.c === fc);
    if (fv !== "all") r = r.filter((a) => a.v === fv);
    if (fp) r = r.filter((a) => a.p <= Number(fp));
    if (sort === "asc") r = [...r].sort((a, b) => a.p - b.p);
    else if (sort === "desc") r = [...r].sort((a, b) => b.p - a.p);
    else r = [...r].sort((a, b) => a.h - b.h);
    return r;
  }, [ads, q, fc, fv, fp, sort]);

  const open = (a) => { setSel(a); setShot(0); go("ad"); };

  const pickConv = (id) => {
    setCid(id);
    setConvs(convs.map((x) => x.id === id ? { ...x, unread: 0 } : x));
    setOpenThread(true);
  };

  const contact = (a) => {
    const ex = convs.find((c) => c.who === a.s);
    if (ex) { setCid(ex.id); setConvs(convs.map((x) => x.id === ex.id ? { ...x, unread: 0 } : x)); }
    else { const nid = Date.now(); setConvs([{ id: nid, who: a.s, ad: a.t, unread: 0, m: [] }, ...convs]); setCid(nid); }
    setOpenThread(true);
    go("msg");
    say("Conversation chiffrée ouverte avec " + a.s);
  };

  const send = () => {
    if (!draft.trim()) return;
    setConvs(convs.map((c) => c.id === cid ? { ...c, unread: 0, m: [...c.m, { me: true, x: draft.trim(), t: "maintenant" }] } : c));
    setDraft("");
  };

  const publish = () => {
    if (!form.t.trim() || !form.p) return say("Ajoutez un titre et un prix pour continuer.");
    if (!pro && used >= 10) return say("Quota gratuit atteint. Passez en Pro pour publier sans limite.");
    setAds([{ id: Date.now(), ...form, p: Number(form.p), h: 0, s: "Loïs-Jérémie", st: "wait", mine: true, pro }, ...ads]);
    setUsed(used + 1);
    setForm({ t: "", p: "", c: "phones", v: "Douala", q: "", d: "" });
    go("dash");
    say("Annonce envoyée à la modération — réponse sous 2 h.");
  };

  const moderate = (id, ok) => {
    setAds(ads.map((a) => a.id === id ? { ...a, st: ok ? "ok" : "no" } : a));
    say(ok ? "Annonce publiée." : "Annonce refusée, l'auteur est prévenu.");
  };

  const conv = convs.find((c) => c.id === cid) || convs[0];
  const SelIcon = sel ? cat(sel.c).I : Smartphone;
  const showList = !narrow || !openThread;
  const showThread = !narrow || openThread;

  return (
    <div className="ib">
      <style>{CSS}</style>

      <header className="top">
        <div className="wrap top-in">
          <button className="logo" onClick={() => go("home")}>
            <span className="logo-m"><Store size={18} strokeWidth={2.4} /></span>inbox
          </button>
          <div className="bar">
            <Search size={19} className="ico" color="#7C848D" />
            <input value={q} placeholder="Que recherchez-vous ?" aria-label="Rechercher une annonce"
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go("home")} />
            <span className="sep" />
            <MapPin size={17} className="ico" color="#7C848D" />
            <select value={fv} onChange={(e) => { setFv(e.target.value); go("home"); }} aria-label="Ville">
              <option value="all">Tout le Cameroun</option>
              {VILLES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <nav className="nav">
            <button className={"nb mob" + (view === "msg" ? " on" : "")} onClick={() => go("msg")} aria-label="Messages">
              <MessageSquare size={21} /><span>Messages</span>
              {unread > 0 && <i className="pip">{unread}</i>}
            </button>
            <button className={"nb" + (view === "dash" ? " on" : "")} onClick={() => go("dash")}>
              <User size={21} /><span>Mon compte</span>
            </button>
            <button className={"nb" + (view === "admin" ? " on" : "")} onClick={() => go("admin")}>
              <ShieldCheck size={21} /><span>Modération</span>
              {pend.length > 0 && <i className="pip">{pend.length}</i>}
            </button>
            <button className="cta" onClick={() => go("new")}>
              <Plus size={18} strokeWidth={2.6} />Déposer une annonce
            </button>
          </nav>
        </div>
      </header>

      {view === "home" && (
        <div className="cats scroll-x">
          <div className="cats-in">
            <button className={"cat" + (fc === "all" ? " on" : "")} onClick={() => setFc("all")}>
              <LayoutGrid size={16} />Toutes
            </button>
            {CATS.map(({ id, l, I }) => (
              <button key={id} className={"cat" + (fc === id ? " on" : "")} onClick={() => setFc(id)}>
                <I size={16} />{l}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="wrap">
        {/* ---------------- ACCUEIL ---------------- */}
        {view === "home" && (
          <>
            <section className="hero">
              <div>
                <h1>Achetez et vendez<br />partout au Cameroun,<br /><em>en toute confiance.</em></h1>
                <p>Déposez votre annonce en deux minutes. Les échanges entre acheteur et vendeur sont chiffrés de bout en bout — personne d'autre ne les lit, pas même nous.</p>
                <div className="trust">
                  <span className="pill"><Lock size={16} />Messagerie chiffrée</span>
                  <span className="pill"><BadgeCheck size={16} />Annonces modérées</span>
                  <span className="pill"><CreditCard size={16} />Mobile Money</span>
                </div>
              </div>
              <div className="heroart">
                <h4>Cette semaine sur Inbox</h4>
                <div className="hr-row">
                  <span className="hr-ic"><Smartphone size={19} /></span>
                  <div><b>Téléphones</b><span>La catégorie la plus consultée</span></div>
                  <span className="hr-n">412</span>
                </div>
                <div className="hr-row">
                  <span className="hr-ic"><Home size={19} /></span>
                  <div><b>Immobilier</b><span>Douala et Yaoundé en tête</span></div>
                  <span className="hr-n">188</span>
                </div>
                <div className="hr-row">
                  <span className="hr-ic"><Store size={19} /></span>
                  <div><b>Vendeurs pro</b><span>Boutiques vérifiées</span></div>
                  <span className="hr-n">57</span>
                </div>
              </div>
            </section>

            <div className="filters">
              <span className="field" style={{ borderColor: "transparent", background: "none", padding: "9px 0" }}>
                <SlidersHorizontal size={17} color="#7C848D" />Filtrer
              </span>
              <label className="field">
                <MapPin size={16} color="#7C848D" />
                <select value={fv} onChange={(e) => setFv(e.target.value)} aria-label="Ville">
                  <option value="all">Toutes les villes</option>
                  {VILLES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="field">
                <input type="number" placeholder="Prix max" value={fp}
                  onChange={(e) => setFp(e.target.value)} aria-label="Prix maximum en FCFA" />
              </label>
              <label className="field">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
                  <option value="recent">Plus récentes</option>
                  <option value="asc">Prix croissant</option>
                  <option value="desc">Prix décroissant</option>
                </select>
              </label>
              {(fc !== "all" || fv !== "all" || fp || q) && (
                <button className="mini" onClick={() => { setFc("all"); setFv("all"); setFp(""); setQ(""); }}>
                  <X size={15} />Effacer
                </button>
              )}
              <span className="count">{list.length} annonce{list.length > 1 ? "s" : ""}</span>
            </div>

            {list.length === 0 ? (
              <div className="empty"><Search size={40} strokeWidth={1.5} />Aucune annonce ne correspond. Élargissez la ville ou le prix maximum.</div>
            ) : (
              <div className="grid">{list.map((a) => <Card key={a.id} a={a} onClick={() => open(a)} onFav={() => say("Ajoutée à vos favoris.")} />)}</div>
            )}
          </>
        )}

        {/* ---------------- FICHE ANNONCE ---------------- */}
        {view === "ad" && sel && (
          <div className="page">
            <button className="back" onClick={() => go("home")}><ChevronLeft size={18} />Retour aux annonces</button>
            <div className="detail">
              <div className="d-left">
                <div className="d-gal">
                  <div className="gal"><SelIcon size={86} strokeWidth={1.1} /></div>
                  <div className="gal-row">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={i === shot ? "on" : ""} onClick={() => setShot(i)}>
                        <SelIcon size={22} strokeWidth={1.4} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel pad d-info">
                  <h2 className="hd" style={{ fontSize: 24 }}>{sel.t}</h2>
                  <div className="d-price">{fcfa(sel.p)} <small>FCFA{sel.u || ""}</small></div>
                  <p style={{ fontSize: 15, lineHeight: 1.68, color: "var(--ink-2)" }}>{sel.d}</p>
                  <div style={{ marginTop: 20 }}>
                    <div className="kv"><span>Catégorie</span><span>{cat(sel.c).l}</span></div>
                    <div className="kv"><span>Localisation</span><span>{sel.q ? sel.q + ", " : ""}{sel.v}</span></div>
                    <div className="kv"><span>Publiée</span><span>{ago(sel.h)}</span></div>
                    <div className="kv"><span>Référence</span><span className="mono">IB-{String(sel.id).padStart(5, "0")}</span></div>
                  </div>
                </div>
              </div>

              <aside className="d-right">
                <div className="panel pad d-seller">
                  <div className="seller">
                    <div className="av">{sel.s[0]}</div>
                    <div>
                      <b style={{ fontSize: 16 }}>{sel.s}</b>
                      <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        {sel.pro ? "Vendeur pro" : "Particulier"}
                        {sel.ver && <><BadgeCheck size={14} color="var(--or)" />vérifié</>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                    <button className="btn btn-p" onClick={() => contact(sel)}><MessageSquare size={18} />Écrire au vendeur</button>
                    <button className="btn btn-s" onClick={() => say("Numéro affiché : 6 7• •• •• 42")}><Phone size={18} />Afficher le numéro</button>
                    <button className="btn btn-s" onClick={() => say("Ajoutée à vos favoris.")}><Heart size={18} />Mettre en favori</button>
                  </div>
                  <div className="note" style={{ marginTop: 16 }}>
                    <Lock size={16} className="ico" />
                    <span>Vos messages sont chiffrés sur votre appareil avant l'envoi.</span>
                  </div>
                </div>
                <div className="panel pad d-tips">
                  <b style={{ fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={17} color="var(--or)" />Acheter sans se faire avoir
                  </b>
                  <ul style={{ listStyle: "none", marginTop: 12, display: "grid", gap: 9, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    <li style={{ display: "flex", gap: 8 }}><Check size={15} color="var(--or)" style={{ flex: "none", marginTop: 2 }} />Voyez l'objet avant de payer.</li>
                    <li style={{ display: "flex", gap: 8 }}><Check size={15} color="var(--or)" style={{ flex: "none", marginTop: 2 }} />Ne versez jamais d'acompte à un inconnu.</li>
                    <li style={{ display: "flex", gap: 8 }}><Check size={15} color="var(--or)" style={{ flex: "none", marginTop: 2 }} />Restez sur la messagerie Inbox : c'est votre preuve en cas de litige.</li>
                  </ul>
                  <button className="mini ko" style={{ marginTop: 15 }} onClick={() => say("Signalement transmis à la modération.")}>
                    <Flag size={15} />Signaler cette annonce
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ---------------- MESSAGERIE ---------------- */}
        {view === "msg" && (
          <div className="page">
            <h2 className="hd">Messages</h2>
            <p className="sub">Chiffrement de bout en bout — les clés restent sur les appareils des deux interlocuteurs.</p>
            <div className="panel chat" style={{ marginTop: 20 }}>
              {showList && (
                <div className="convs">
                  {convs.map((c) => (
                    <button key={c.id} className={"conv" + (!narrow && c.id === conv?.id ? " on" : "")} onClick={() => pickConv(c.id)}>
                      <div className="av" style={{ width: 40, height: 40, fontSize: 15 }}>{c.who[0]}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <b>{c.who}</b>
                        <p>{c.m.length ? c.m[c.m.length - 1].x : "Nouvelle conversation"}</p>
                        <p style={{ opacity: .8 }}>{c.ad}</p>
                      </div>
                      {c.unread > 0 && <span className="chip" style={{ background: "var(--or)", color: "#fff" }}>{c.unread}</span>}
                    </button>
                  ))}
                </div>
              )}
              {showThread && (
                <div className="thread">
                  <div className="thead">
                    {narrow && (
                      <button className="thead-back" onClick={() => setOpenThread(false)} aria-label="Retour aux conversations">
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    <div className="av" style={{ width: 38, height: 38, fontSize: 15 }}>{conv?.who[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 15 }}>{conv?.who}</b>
                      <div style={{ fontSize: 12.5, color: "var(--ok)", display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                        <Lock size={13} className="ico" /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Chiffré · {conv?.ad}</span>
                      </div>
                    </div>
                  </div>
                  <div className="msgs">
                    {conv?.m.length === 0 && (
                      <div className="empty"><MessageSquare size={36} strokeWidth={1.5} />Écrivez le premier message pour lancer la discussion.</div>
                    )}
                    {conv?.m.map((m, i) => (
                      <div key={i} className={"bub " + (m.me ? "me" : "them")}>{m.x}<time>{m.t}</time></div>
                    ))}
                  </div>
                  <div className="compose">
                    <input value={draft} placeholder="Votre message" aria-label="Votre message"
                      onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                    <button className="send" onClick={send} aria-label="Envoyer"><Send size={19} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- DÉPÔT ---------------- */}
        {view === "new" && (
          <div className="page">
            <h2 className="hd">Déposer une annonce</h2>
            <p className="sub">
              {pro ? "Compte Pro : dépôts illimités." : `Il vous reste ${10 - used} dépôt${10 - used > 1 ? "s" : ""} gratuit${10 - used > 1 ? "s" : ""} ce mois-ci.`}
            </p>
            <div className="panel pad" style={{ marginTop: 20 }}>
              <div className="form">
                <div>
                  <label className="lab" htmlFor="f-t">Titre de l'annonce</label>
                  <input id="f-t" className="inp" value={form.t} placeholder="Ex. Réfrigérateur 250 L très bon état"
                    onChange={(e) => setForm({ ...form, t: e.target.value })} />
                  <div className="hint">Décrivez l'objet, pas votre urgence. Les titres précis reçoivent trois fois plus de messages.</div>
                </div>
                <div className="two">
                  <div>
                    <label className="lab" htmlFor="f-p">Prix (FCFA)</label>
                    <input id="f-p" className="inp mono" type="number" inputMode="numeric" value={form.p} placeholder="150000"
                      onChange={(e) => setForm({ ...form, p: e.target.value })} />
                  </div>
                  <div>
                    <label className="lab" htmlFor="f-c">Catégorie</label>
                    <select id="f-c" className="inp" value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })}>
                      {CATS.map((c) => <option key={c.id} value={c.id}>{c.l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="two">
                  <div>
                    <label className="lab" htmlFor="f-v">Ville</label>
                    <select id="f-v" className="inp" value={form.v} onChange={(e) => setForm({ ...form, v: e.target.value })}>
                      {VILLES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lab" htmlFor="f-q">Quartier</label>
                    <input id="f-q" className="inp" value={form.q} placeholder="Ex. Bonamoussadi"
                      onChange={(e) => setForm({ ...form, q: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="lab" htmlFor="f-d">Description</label>
                  <textarea id="f-d" className="inp" rows={5} value={form.d}
                    placeholder="État, âge, défauts éventuels, ce qui est fourni avec, conditions de remise…"
                    onChange={(e) => setForm({ ...form, d: e.target.value })} />
                </div>
                <div>
                  <span className="lab">Photos</span>
                  <button className="drop" onClick={() => say("Téléversement simulé : 3 photos ajoutées.")}>
                    <ImagePlus size={20} />Ajouter jusqu'à 8 photos
                  </button>
                </div>
                <button className="btn btn-p" onClick={publish}><Check size={18} strokeWidth={2.6} />Publier l'annonce</button>
                <div className="hint">Chaque annonce passe en modération avant sa mise en ligne.</div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MON COMPTE ---------------- */}
        {view === "dash" && (
          <div className="page">
            <h2 className="hd">Mon compte</h2>
            <p className="sub">Loïs-Jérémie · {pro ? "abonnement Pro actif" : "compte gratuit"}</p>
            <div className="cards" style={{ marginTop: 20 }}>
              <Kpi I={LayoutGrid} n={mine.length} l="mes annonces" />
              <Kpi I={Plus} n={pro ? "∞" : `${used}/10`} l="dépôts ce mois" />
              <Kpi I={MessageSquare} n={unread} l="messages non lus" />
              <Kpi I={Eye} n="1 240" l="vues cumulées" />
            </div>

            {!pro && (
              <div className="panel pad" style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <span className="hr-ic" style={{ width: 44, height: 44 }}><Sparkles size={21} /></span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <b style={{ fontSize: 17 }}>Vous vendez régulièrement ?</b>
                  <div className="sub" style={{ fontSize: 14 }}>Dépôts illimités, badge vérifié et remontée dans les résultats.</div>
                </div>
                <button className="mini go" onClick={() => go("pro")}>Voir les offres Pro</button>
              </div>
            )}

            <div className="panel">
              <div className="row rt">Mes annonces</div>
              {mine.length === 0 ? (
                <div className="empty"><LayoutGrid size={38} strokeWidth={1.5} />Rien pour l'instant. Déposez votre première annonce, elle apparaîtra ici.</div>
              ) : mine.map((a) => {
                const I = cat(a.c).I;
                return (
                  <div className="row" key={a.id}>
                    <span className="tn"><I size={21} strokeWidth={1.5} /></span>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <b style={{ fontSize: 14.5 }}>{a.t}</b>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{a.v} · {ago(a.h)}</div>
                    </div>
                    <span className="price">{fcfa(a.p)} <small>FCFA</small></span>
                    <Status st={a.st} />
                    <button className="mini" onClick={() => say("Édition de l'annonce (démo).")}>Modifier</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- MODÉRATION ---------------- */}
        {view === "admin" && (
          <div className="page">
            <h2 className="hd">Modération</h2>
            <p className="sub">File d'attente des annonces avant mise en ligne.</p>
            <div className="cards" style={{ marginTop: 20 }}>
              <Kpi I={Clock} n={pend.length} l="en attente" />
              <Kpi I={Check} n={ads.filter((a) => a.st === "ok").length} l="publiées" />
              <Kpi I={X} n={ads.filter((a) => a.st === "no").length} l="refusées" />
              <Kpi I={Flag} n="1" l="signalement" />
            </div>
            <div className="panel">
              <div className="row rt">File d'attente</div>
              {pend.length === 0 ? (
                <div className="empty"><ShieldCheck size={38} strokeWidth={1.5} />File vide. Toutes les annonces ont été traitées.</div>
              ) : pend.map((a) => {
                const I = cat(a.c).I;
                return (
                  <div className="row" key={a.id} style={{ alignItems: "flex-start" }}>
                    <span className="tn" style={{ width: 50, height: 50 }}><I size={22} strokeWidth={1.5} /></span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <b style={{ fontSize: 15 }}>{a.t}</b>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 7px" }}>
                        {a.s} · {a.v} · {cat(a.c).l} · <span className="mono">{fcfa(a.p)} FCFA</span>
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>{a.d}</div>
                    </div>
                    <div className="mod-act">
                      <button className="mini go" onClick={() => moderate(a.id, true)}><Check size={15} />Publier</button>
                      <button className="mini ko" onClick={() => moderate(a.id, false)}><X size={15} />Refuser</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- OFFRES PRO ---------------- */}
        {view === "pro" && (
          <div className="page">
            <h2 className="hd">Passer en Pro</h2>
            <p className="sub">Payez comme vous voulez : MTN Mobile Money, Orange Money ou carte bancaire.</p>
            <div className="plans" style={{ marginTop: 26 }}>
              <div className="plan">
                <h3>Gratuit</h3>
                <div className="p">0 <span style={{ fontSize: 14 }}>FCFA</span></div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Pour vendre de temps en temps</div>
                <ul>
                  <li><Check size={17} />10 annonces par mois</li>
                  <li><Check size={17} />Messagerie chiffrée</li>
                  <li><Check size={17} />Tableau de bord</li>
                </ul>
                <button className="btn btn-s" disabled={!pro} onClick={() => { setPro(false); say("Retour au compte gratuit."); }}>
                  {pro ? "Revenir au gratuit" : "Votre offre actuelle"}
                </button>
              </div>
              <div className="plan hi">
                <h3>Pro</h3>
                <div className="p">5 000 <span style={{ fontSize: 14 }}>FCFA/mois</span></div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Pour les commerces et vendeurs réguliers</div>
                <ul>
                  <li><Check size={17} />Annonces illimitées</li>
                  <li><Check size={17} />Badge vérifié sur la boutique</li>
                  <li><Check size={17} />Remontée dans les résultats</li>
                  <li><Check size={17} />Statistiques de vues et de contacts</li>
                </ul>
                <div className="pays">
                  {[["momo", "MTN MoMo", Phone], ["om", "Orange Money", Phone], ["card", "Carte bancaire", CreditCard]].map(([k, l, I]) => (
                    <button key={k} className={"pay" + (pay === k ? " on" : "")} onClick={() => setPay(k)}>
                      <I size={16} />{l}
                    </button>
                  ))}
                </div>
                <button className="btn btn-p" style={{ marginTop: 16 }}
                  onClick={() => { setPro(true); go("dash"); say("Paiement confirmé — votre compte est Pro."); }}>
                  {pro ? "Abonnement actif" : "Payer 5 000 FCFA"}
                </button>
                <div className="hint">Démonstration : aucun paiement réel n'est déclenché.</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ---------------- BARRE D'ONGLETS MOBILE ---------------- */}
      <nav className="tabs">
        <div className="tabs-in">
          <button className={"tab" + (view === "home" ? " on" : "")} onClick={() => go("home")}>
            <Search size={21} />Rechercher
          </button>
          <button className={"tab" + (view === "msg" ? " on" : "")} onClick={() => { setOpenThread(false); go("msg"); }}>
            <MessageSquare size={21} />Messages
            {unread > 0 && <i className="pip">{unread}</i>}
          </button>
          <button className="tab tab-add" onClick={() => go("new")} aria-label="Déposer une annonce">
            <span className="bubble"><Plus size={26} strokeWidth={2.6} /></span>
            <span>Déposer</span>
          </button>
          <button className={"tab" + (view === "admin" ? " on" : "")} onClick={() => go("admin")}>
            <ShieldCheck size={21} />Modération
            {pend.length > 0 && <i className="pip">{pend.length}</i>}
          </button>
          <button className={"tab" + (view === "dash" ? " on" : "")} onClick={() => go("dash")}>
            <User size={21} />Compte
          </button>
        </div>
      </nav>

      {toast && <div className="toast"><Check size={18} strokeWidth={3} />{toast}</div>}
    </div>
  );
}

function Kpi({ I, n, l }) {
  return (
    <div className="kpi">
      <span className="ki"><I size={18} /></span>
      <b>{n}</b><span>{l}</span>
    </div>
  );
}

function Status({ st }) {
  if (st === "ok") return <span className="chip ok"><Check size={13} />En ligne</span>;
  if (st === "wait") return <span className="chip wait"><Clock size={13} />En modération</span>;
  return <span className="chip no"><X size={13} />Refusée</span>;
}

function Card({ a, onClick, onFav }) {
  const { l, I } = cat(a.c);
  return (
    <div className="ad" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>
      <div className="thumb">
        <I size={46} strokeWidth={1.2} />
        <span className="tag">{l}</span>
        {a.ver && <span className="badge"><BadgeCheck size={12} />Vérifiée</span>}
        <button className="fav" aria-label="Mettre en favori"
          onClick={(e) => { e.stopPropagation(); onFav(); }}><Heart size={16} /></button>
      </div>
      <div className="ad-b">
        <div className="ad-t">{a.t}</div>
        <div className="price">{fcfa(a.p)} <small>FCFA{a.u || ""}</small></div>
        <div className="meta">
          <span><MapPin size={13} />{a.v}</span>
          <span><Clock size={13} />{ago(a.h)}</span>
        </div>
      </div>
    </div>
  );
}
