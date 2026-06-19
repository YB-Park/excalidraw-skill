import {baseElement,makeText} from './sequence-base.mjs';
export function makeMessageElements(m,y,l){
 const a=l.get(m.from),b=l.get(m.to);if(!a||!b)return null;
 const k=m.kind??'sync',d=k!=='sync';
 const e=baseElement('arrow',m.semanticId,'sequence-message');
 Object.assign(e,{x:a.centerX,y,width:b.centerX-a.centerX,height:0,points:[[0,0],[b.centerX-a.centerX,0]],startBinding:null,endBinding:null,startArrowhead:null,endArrowhead:'arrow',strokeColor:k==='return'?'#64748b':d?'#7c3aed':'#2563eb',strokeStyle:d?'dashed':'solid'});
 Object.assign(e.customData.excalidrawSkill,{from:m.from,to:m.to,kind:k,order:m.order??0});
 const t=makeText(`${m.semanticId}_label`,'sequence-message-label',String(m.label??''),(a.centerX+b.centerX)/2-110,y-29,220,24,{fontSize:16,fontRole:'mono'});
 t.customData.excalidrawSkill.message=m.semanticId;
 return {arrow:e,label:t};
}
