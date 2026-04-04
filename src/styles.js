// ── styles.js — global CSS string injected via <style> ──

/* ═══════════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════════ */
export const CSS =`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&family=Lora:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#f0f3f8;--ink2:#ffffff;--ink3:#e8edf5;--gold:#1e5ab0;--gold2:#3399ff;--cream:#000039;--txt:#2d3f5e;--dim:#7a8fa8;--red:#d94f3a;--grn:#3a8c5c;--blu:#1e5ab0;--pur:#23a29e;--ls-blue:#3399ff;--ls-navy:#000039;--ls-mid:#1e5ab0}
html,body{background:var(--ink)}
.app{min-height:100vh;background:var(--ink);color:var(--txt);font-family:'Lora',Georgia,serif}
.hdr{background:#ffffff;border-bottom:1px solid rgba(30,90,176,.15);padding:0 26px;display:flex;align-items:center;position:sticky;top:0;z-index:300;box-shadow:0 2px 12px rgba(30,90,176,.08)}
.brand{padding:12px 0;margin-right:auto}
.brand h1{font-family:'Playfair Display',serif;font-size:15.5px;color:var(--ls-navy);letter-spacing:.03em}
.brand p{font-size:8.5px;color:var(--dim);letter-spacing:.14em;text-transform:uppercase;margin-top:2px}
.nav{display:flex}.nav[role="tablist"]{gap:0}
.ntab{padding:0 14px;height:56px;display:flex;align-items:center;font-size:9.5px;letter-spacing:.07em;color:var(--dim);cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;transition:all .15s;gap:5px;white-space:nowrap}
.ntab:hover{color:var(--txt)}.ntab.on{color:var(--gold);border-bottom-color:var(--gold);background:rgba(30,90,176,.04)}
.body{padding:24px 26px;max-width:1700px;margin:0 auto}
.pg-h{font-family:'Playfair Display',serif;font-size:21px;color:var(--cream);margin-bottom:3px}
.pg-s{color:var(--dim);font-size:13px;margin-bottom:20px}
.card{background:#ffffff;border:1px solid rgba(30,90,176,.12);border-radius:8px;padding:17px 21px;margin-bottom:13px;box-shadow:0 1px 4px rgba(30,90,176,.06)}
.card-t{font-family:'Playfair Display',serif;font-size:13px;color:var(--gold);margin-bottom:11px;display:flex;align-items:center;gap:7px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px}
.inp{background:#f4f7fc;border:1px solid rgba(30,90,176,.18);border-radius:6px;padding:7px 11px;color:var(--txt);font-size:12.5px;width:100%;font-family:'Lora',serif;transition:border-color .15s}
.inp:focus{outline:none;border-color:var(--gold)}
.sel{background:#f4f7fc;border:1px solid rgba(30,90,176,.18);border-radius:6px;padding:7px 11px;color:var(--txt);font-size:12.5px;width:100%;font-family:'Lora',serif;cursor:pointer}
.btn{padding:7px 15px;border-radius:6px;font-size:10.5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;transition:all .15s;border:none;display:inline-flex;align-items:center;gap:5px}
.bg{background:var(--gold);color:var(--ink);font-weight:700}.bg:hover{background:var(--gold2)}
.bo{background:transparent;color:var(--gold);border:1px solid rgba(30,90,176,.25)}.bo:hover{border-color:var(--gold);background:rgba(30,90,176,.06)}
.bd{background:rgba(214,68,68,.1);color:var(--red);border:1px solid rgba(214,68,68,.24)}.bd:hover{background:rgba(214,68,68,.2)}
.bs{padding:4px 10px;font-size:10px}
.tbl{width:100%;border-collapse:collapse}
.tbl th{background:rgba(30,90,176,.06);color:var(--gold);font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;text-align:left;font-family:'IBM Plex Mono',monospace;border-bottom:1px solid rgba(30,90,176,.1)}
.tbl td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;vertical-align:middle}
.tbl tr:hover td{background:rgba(30,90,176,.03)}
.bdg{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-family:'IBM Plex Mono',monospace}
.bg-g{background:rgba(30,90,176,.1);color:var(--gold)}.bg-r{background:rgba(214,68,68,.12);color:var(--red)}.bg-b{background:rgba(74,143,212,.12);color:var(--blu)}.bg-grn{background:rgba(74,175,122,.12);color:var(--grn)}
.stats{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.stat{background:#ffffff;border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:11px 15px;flex:1;min-width:90px}
.sv{font-family:'Playfair Display',serif;font-size:26px;color:var(--gold);line-height:1}
.sl{font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.09em;margin-top:3px;font-family:'IBM Plex Mono',monospace}
.upz{border:2px dashed rgba(30,90,176,.15);border-radius:8px;padding:38px 20px;text-align:center;cursor:pointer;transition:all .2s}
.upz:hover{border-color:var(--gold);background:rgba(30,90,176,.03)}
.alert{padding:9px 12px;border-radius:6px;font-size:12px;margin-bottom:10px}
.aw{background:rgba(214,68,68,.07);border:1px solid rgba(214,68,68,.2);color:#e8a0a0}
.ai{background:rgba(74,143,212,.07);border:1px solid rgba(74,143,212,.2);color:#a0c4e8}
.ag{background:rgba(74,175,122,.07);border:1px solid rgba(74,175,122,.2);color:#96d4b4}
.tag{display:inline-flex;padding:2px 6px;border-radius:12px;font-size:10px;background:rgba(30,90,176,.07);color:var(--gold2);border:1px solid rgba(30,90,176,.1);margin:2px 2px 0 0}
.flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lbl{font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;font-family:'IBM Plex Mono',monospace;margin-bottom:3px}
.ent-row{background:#ffffff;border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:11px 14px;margin-bottom:5px;display:flex;align-items:flex-start;gap:10px;cursor:pointer;transition:all .15s}
.ent-row:hover{border-color:rgba(30,90,176,.28);background:#f0f5ff}
.slot-cell{padding:3px 2px;text-align:center;border-radius:3px;cursor:pointer;font-size:9px;font-family:'IBM Plex Mono',monospace;transition:all .12s;user-select:none}
.slot-avail{background:rgba(74,175,122,.13);color:var(--grn);border:1px solid rgba(74,175,122,.2)}
.slot-avail:hover{background:rgba(74,175,122,.22)}
.slot-blocked{background:rgba(214,68,68,.13);color:var(--red);border:1px solid rgba(214,68,68,.2);text-decoration:line-through}
.slot-blocked:hover{background:rgba(214,68,68,.22)}
.slot-na{background:rgba(255,255,255,.03);color:rgba(255,255,255,.12);border:1px solid transparent;cursor:default}
.grid-wrap{overflow-x:auto}
.grid-tbl{border-collapse:collapse;table-layout:fixed}
.grid-tbl .th-time{width:72px;background:rgba(30,90,176,.07);font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--gold);padding:7px 8px;border-bottom:1px solid rgba(30,90,176,.1);text-align:right;text-transform:uppercase;position:sticky;left:0;z-index:10}
.grid-tbl .th-sect{font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;text-align:center}
.grid-tbl .th-co{background:var(--ink2);font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--txt);padding:5px 7px;border-bottom:2px solid;text-align:center;min-width:110px;white-space:nowrap}
.grid-tbl .td-time{background:rgba(30,90,176,.06);font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--gold);padding:4px 8px;border-right:2px solid rgba(30,90,176,.12);border-bottom:1px solid rgba(255,255,255,.04);text-align:right;white-space:nowrap;font-weight:600;position:sticky;left:0;z-index:9;vertical-align:middle}
.grid-tbl .td-c{padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.04);border-right:1px solid rgba(255,255,255,.04);vertical-align:top;min-height:50px;cursor:pointer;transition:background .1s}
.grid-tbl .td-c:hover{background:rgba(30,90,176,.07)}
.m-pill{border-radius:4px;padding:4px 5px;min-height:44px;display:flex;flex-direction:column;justify-content:flex-start;border-left:2px solid;overflow:hidden}
.mp-n{font-size:10px;color:var(--cream);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
.mp-f{font-size:8.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-r{font-size:8px;font-family:'IBM Plex Mono',monospace;color:var(--gold);margin-top:1px}
.add-ic{color:rgba(255,255,255,.09);font-size:13px;text-align:center;line-height:50px;width:100%;display:block}
.overlay{position:fixed;inset:0;background:rgba(10,20,60,.45);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:30px 16px;backdrop-filter:blur(5px);overflow-y:auto}
.modal{background:#ffffff;border:1px solid rgba(30,90,176,.15);border-radius:10px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6)}
.modal-hdr{padding:22px 24px 16px;border-bottom:1px solid rgba(30,90,176,.1)}
.modal-title{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold)}
.modal-sub{font-size:12px;color:var(--dim);margin-top:3px}
.modal-body{padding:20px 24px}
.modal-footer{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,.05)}
.modal-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:18px}
.mtab{padding:8px 16px;font-size:10px;cursor:pointer;color:var(--dim);border:none;background:none;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid transparent;transition:all .15s}
.mtab.on{color:var(--gold);border-bottom-color:var(--gold)}
.ex-card{background:var(--ink3);border:1px solid rgba(30,90,176,.1);border-radius:8px;padding:16px 18px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:8px}
.ex-card:hover{border-color:rgba(30,90,176,.28);background:rgba(30,90,176,.04)}
.ex-card-ico{font-size:26px}.ex-card-t{font-family:'Playfair Display',serif;font-size:13px;color:var(--cream)}
.ex-card-s{font-size:11px;color:var(--dim);line-height:1.6}
.day-btn{padding:6px 14px;border-radius:6px;font-size:10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;transition:all .15s;border:1px solid}
.doff{background:transparent;color:var(--dim);border-color:rgba(255,255,255,.07)}.doff:hover{color:var(--txt)}
.d14on{background:rgba(74,143,212,.13);color:var(--blu);border-color:rgba(74,143,212,.28)}
.d15on{background:rgba(74,175,122,.13);color:var(--grn);border-color:rgba(74,175,122,.28)}
.fund-group{background:var(--ink3);border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.toggle{position:relative;display:inline-block;width:38px;height:20px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0;position:absolute}
.toggle-track{position:absolute;inset:0;border-radius:20px;background:rgba(255,255,255,.1);transition:.2s;cursor:pointer}
.toggle input:checked+.toggle-track{background:var(--gold)}
.toggle-thumb{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:2px;left:2px;transition:.2s;pointer-events:none}
.toggle input:checked~.toggle-thumb{left:20px}
.attendee-row{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.srch{position:relative}
.srch-ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--dim);pointer-events:none;font-size:12px}
.srch .inp{padding-left:28px}
.dbar{height:2px;border-radius:2px;margin-top:3px;background:rgba(255,255,255,.05)}
.dfill{height:2px;border-radius:2px}
.sec-hdr{font-family:'IBM Plex Mono',monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding:10px 0 5px;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:6px}
/* events list */
.ev-card{background:var(--ink2);border:1px solid rgba(30,90,176,.1);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:12px;transition:border-color .15s}
.ev-card:hover{border-color:rgba(30,90,176,.22)}.ev-card.active-ev{border-color:var(--gold);background:rgba(30,90,176,.05)}

/* ── Mobile Responsive ─────────────────────────────────────── */
@media(max-width:768px){
  .hdr{padding:0 12px;flex-wrap:wrap;gap:4px}
  .hdr-ev{gap:5px!important;margin-right:0!important;padding:4px 0!important;border-right:none!important;order:2;flex:1;min-width:0}
  .hdr-ev .sel{max-width:140px;font-size:10px!important}
  .hdr-ev-label{display:none!important}
  .brand h1{font-size:13px}.brand p{font-size:7px}
  .nav{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-shrink:0;width:100%;order:3;border-top:1px solid rgba(30,90,176,.08)}
  .nav::-webkit-scrollbar{display:none}
  .ntab{padding:0 10px;height:42px;font-size:8.5px;flex-shrink:0}
  .body{padding:12px 10px}
  .pg-h{font-size:17px}.pg-s{font-size:11px;margin-bottom:12px}
  .g2,.g3{grid-template-columns:1fr}
  .card{padding:12px 14px;margin-bottom:10px}
  .stats{gap:6px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;padding-bottom:4px}
  .stat{min-width:80px;padding:8px 10px;flex-shrink:0}
  .sv{font-size:20px}.sl{font-size:7.5px}
  .modal{border-radius:8px;max-height:90vh;overflow-y:auto}
  .modal-hdr{padding:14px 16px 10px}.modal-title{font-size:15px}
  .modal-body{padding:12px 16px}.modal-footer{padding:10px 16px}
  .overlay{padding:12px 8px;align-items:center}
  .tbl th,.tbl td{padding:5px 7px;font-size:10.5px}
  .ex-card{padding:12px 14px}.ex-card-ico{font-size:20px}.ex-card-t{font-size:12px}
  .inp{font-size:14px;padding:9px 11px}
  .btn{font-size:10px;padding:6px 12px}.bs{padding:5px 10px;font-size:9px}
  .ent-row{flex-direction:column;gap:6px}
  .sec-hdr{font-size:8px}
  .grid-wrap{-webkit-overflow-scrolling:touch}
  .grid-tbl .th-co{min-width:80px;font-size:8px}
  .rs-subtabs{scrollbar-width:none;-ms-overflow-style:none}.rs-subtabs::-webkit-scrollbar{display:none}
  .rs-subtabs-stats{display:none!important}
  .day-hdr-bar{padding:10px 14px!important;border-radius:8px!important}
  .mtg-day-card{padding:10px 12px!important;border-radius:8px!important}
  .dash-hero{padding:32px 16px 52px!important}
  .dash-title{font-size:26px!important}
  .dash-content{padding:0 14px 40px!important;margin-top:-16px!important}
  .dash-stats{flex-wrap:wrap!important;border-radius:10px!important;margin-bottom:20px!important}
  .dash-stats>div{flex:0 0 33.33%!important;padding:12px 8px!important;border-bottom:1px solid #f0f3f8}
  .dash-stats>div>div:first-child{font-size:20px!important}
  .dash-ev-grid{grid-template-columns:1fr!important;gap:10px!important}
}
@media(max-width:480px){
  .hdr{padding:0 8px}
  .brand h1{font-size:12px}.brand p{display:none}
  .ntab{padding:0 8px;height:38px;font-size:7.5px}
  .body{padding:8px 6px}
  .g2,.g3{gap:8px}
  .stats{gap:4px}.stat{min-width:70px;padding:6px 8px}
  .sv{font-size:18px}
  .overlay{padding:6px 4px}
  .modal{border-radius:6px}
  .dash-hero{padding:24px 12px 40px!important}
  .dash-title{font-size:22px!important}
  .dash-content{padding:0 10px 30px!important}
  .dash-stats>div{flex:0 0 50%!important;padding:10px 6px!important}
  .dash-stats>div>div:first-child{font-size:18px!important}
}
`;

