// ── Skeleton.jsx — Shimmer loading placeholders ──────────────────

const shimmerCSS = `@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`;
let injected = false;

function injectCSS(){
  if(injected) return;
  const s=document.createElement("style");
  s.textContent=shimmerCSS;
  document.head.appendChild(s);
  injected=true;
}

const base = {
  background:"linear-gradient(90deg,#f0f3f8 25%,#e4e9f2 37%,#f0f3f8 63%)",
  backgroundSize:"800px 100%",
  animation:"shimmer 1.4s ease-in-out infinite",
  borderRadius:6,
};

export function SkeletonLine({width="100%",height=12,style={}}){
  injectCSS();
  return <div style={{...base,width,height,marginBottom:8,...style}}/>;
}

export function SkeletonCard({lines=3,style={}}){
  injectCSS();
  return(
    <div style={{background:"#fff",border:"1px solid rgba(30,90,176,.08)",borderRadius:10,padding:"16px 18px",marginBottom:10,...style}}>
      <SkeletonLine width="45%" height={14} style={{marginBottom:12}}/>
      {Array.from({length:lines}).map((_,i)=>(
        <SkeletonLine key={i} width={i===lines-1?"60%":"90%"} height={10}/>
      ))}
    </div>
  );
}

export function SkeletonGrid({cards=3,style={}}){
  injectCSS();
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10,...style}}>
      {Array.from({length:cards}).map((_,i)=><SkeletonCard key={i} lines={2}/>)}
    </div>
  );
}

export function SkeletonTable({rows=5,cols=4,style={}}){
  injectCSS();
  return(
    <div style={{background:"#fff",border:"1px solid rgba(30,90,176,.08)",borderRadius:8,overflow:"hidden",...style}}>
      <div style={{display:"flex",gap:0,background:"#f3f5f9",padding:"10px 14px"}}>
        {Array.from({length:cols}).map((_,i)=><SkeletonLine key={i} width={i===0?"30%":"20%"} height={10} style={{flex:1,marginBottom:0,marginRight:8}}/>)}
      </div>
      {Array.from({length:rows}).map((_,r)=>(
        <div key={r} style={{display:"flex",gap:0,padding:"10px 14px",borderBottom:"1px solid #f3f5f9"}}>
          {Array.from({length:cols}).map((_,c)=><SkeletonLine key={c} width={c===0?"40%":"25%"} height={9} style={{flex:1,marginBottom:0,marginRight:8}}/>)}
        </div>
      ))}
    </div>
  );
}
