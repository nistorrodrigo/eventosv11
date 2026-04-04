// ── Skeleton.jsx — Shimmer loading placeholders (uses design tokens) ──

export function SkeletonLine({width="100%",height=12,style={}}){
  return <div className="skel-line" style={{width,height,...style}}/>;
}

export function SkeletonCard({lines=3,style={}}){
  return(
    <div className="skel-card" style={style}>
      <SkeletonLine width="45%" height={14} style={{marginBottom:12}}/>
      {Array.from({length:lines}).map((_,i)=>(
        <SkeletonLine key={i} width={i===lines-1?"60%":"90%"} height={10}/>
      ))}
    </div>
  );
}

export function SkeletonGrid({cards=3,style={}}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"var(--sp-3)",...style}}>
      {Array.from({length:cards}).map((_,i)=><SkeletonCard key={i} lines={2}/>)}
    </div>
  );
}

export function SkeletonTable({rows=5,cols=4,style={}}){
  return(
    <div className="skel-table" style={style}>
      <div className="skel-table-hdr">
        {Array.from({length:cols}).map((_,i)=><SkeletonLine key={i} width={i===0?"30%":"20%"} height={10} style={{flex:1,marginBottom:0,marginRight:8}}/>)}
      </div>
      {Array.from({length:rows}).map((_,r)=>(
        <div key={r} className="skel-table-row">
          {Array.from({length:cols}).map((_,c)=><SkeletonLine key={c} width={c===0?"40%":"25%"} height={9} style={{flex:1,marginBottom:0,marginRight:8}}/>)}
        </div>
      ))}
    </div>
  );
}
