export function makeDb(tables){
  let idc=1
  return { tables, from(t){ const rows=tables[t]||(tables[t]=[]); let rng=null, filt=[], mode='select', payload=null, single=false
    const q={ select(){return q}, eq(k,v){filt.push(r=>r[k]===v);return q}, in(k,vs){filt.push(r=>vs.includes(r[k]));return q}, gte(k,v){filt.push(r=>r[k]!=null&&r[k]>=v);return q}, lte(k,v){filt.push(r=>r[k]!=null&&r[k]<=v);return q}, lt(k,v){filt.push(r=>r[k]!=null&&r[k]<v);return q}, is(k,v){filt.push(r=>(r[k]??null)===v);return q}, range(a,b){rng=[a,b];return q}, single(){single=true;return q},
      insert(p){mode='insert';payload=p;return q}, update(p){mode='update';payload=p;return q}, delete(){mode='delete';return q},
      then(res,rej){ try{ let out
        if(mode==='insert'){ if(t==='push_runs' && rows.some(r=>r.execution_id===payload.execution_id)) return res({data:null,error:{code:'23505'}}); const r={id:idc++,...payload}; rows.push(r); out=single?r:[r] }
        else { const m=rows.filter(r=>filt.every(f=>f(r)))
          if(mode==='update'){ m.forEach(r=>Object.assign(r,payload)); out=m }
          else if(mode==='delete'){ m.forEach(r=>rows.splice(rows.indexOf(r),1)); out=m }
          else { const mm=rng?m.slice(rng[0],rng[1]+1):m; out=single?mm[0]:mm } }
        res({data:out,error:null}) }catch(e){rej(e)} } }
    return q } }
}
