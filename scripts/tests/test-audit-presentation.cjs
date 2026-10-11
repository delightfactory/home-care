const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();
function load(file,externals={}) {
 file=path.resolve(file); if(cache.has(file))return cache.get(file);
 const exports={}; const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const requireModule=name=>externals[name]||load(path.resolve(path.dirname(file),name+'.ts'),externals);
 new Function('require','exports',compiled)(requireModule,exports);cache.set(file,exports);return exports;
}
const ui=load('src/pages/Audit/auditPresentation.ts');
const event={id:'event',table_schema:'public',table_name:'routes',entity_id:'route',operation:'UPDATE',event_kind:'committed_change',actor_name:'QA',actor_id:'actor',actor_kind:'authenticated',changed_fields:['team_id'],before_values:{name:'الشروق',team_id:'old'},after_values:{name:'الشروق',team_id:'new'},redacted_fields:[],change_markers:{},payload_redacted:false,display_context:{labels:{'teams:old':{label:'فريق عبدالرحمن',found:true},'teams:new':{label:'فريق محمد عصام',found:true}},entities:{}}};
const original=JSON.stringify(event);
assert.equal(ui.eventTitle(event),'الشروق');
assert.match(ui.changeSummary(event),/من فريق عبدالرحمن.*إلى فريق محمد عصام/);
assert.equal(ui.eventRelations(event).length,2);
assert.equal(JSON.stringify(event),original,'presentation must preserve evidence');
const removed={...event,operation:'DELETE',table_name:'order_items',entity_id:'gone',before_values:{order_id:'order',service_id:'service'},after_values:null,changed_fields:['order_id'],display_context:{labels:{'orders:order':{label:'ORD-123',found:true}},entities:{}}};
assert.match(ui.changeSummary(removed),/ORD-123/);
assert.equal(ui.eventRelations(removed)[0].id,'order');
assert.match(ui.searchableEventText(removed),/ord-123/);
const changedParent={...removed,operation:'UPDATE',after_values:{order_id:'neworder'},display_context:{...removed.display_context,entities:{'order_items:gone':{order_id:'unrelated'}}}};
assert.deepEqual(ui.eventRelations(changedParent).filter(x=>x.table==='orders').map(x=>x.id),['order','neworder']);
assert.match(ui.displayValue({...event,display_context:undefined},'team_id','old'),/غير متاح/);
assert.equal(ui.displayValue(event,'team_id',null),'غير معيّن');
assert.equal(ui.eventTitle({...event,after_values:{name:'الاسم المحفوظ'},display_context:{labels:{'routes:route':{label:'الاسم الحالي المختلف',found:true}},entities:{}}}),'الاسم المحفوظ');
assert.equal(ui.changeSummary({...event,redacted_fields:['team_id']}),'الفريق: تغيّر');
assert.equal(ui.eventRelations({...event,payload_redacted:true}).length,0);
assert.equal(ui.eventTitle({...event,payload_redacted:true}),'خطوط السير');
async function networkCases() {
 for(const [code,expected] of [['PGRST202','fallback'],['42501','denied']]) {
  cache.clear();
  const supabase={rpc:async(name)=> name==='admin_audit_list'?{data:{events:[event],next_cursor:null},error:null}:{data:null,error:{code,message:'lookup failure'}}};
  const {AuditAPI,AuditReadError}=load('src/api/audit.ts',{'../lib/supabase':{supabase}});
  const filters={from:'',to:'',table:'',actor:'',entity:'',kind:'',transaction:'',generation:''};
  if(expected==='denied') await assert.rejects(AuditAPI.list(filters),error=>error instanceof AuditReadError && error.denied);
  else {const page=await AuditAPI.list(filters);assert.equal(page.events[0].context_unavailable,true);assert.deepEqual(page.events[0].before_values,event.before_values);}
 }
 console.log('PASS human summaries, saved names, old/new parent links, deleted items, search, missing labels, redaction, lookup failure and permission revocation');
}
networkCases().catch(error=>{console.error(error);process.exitCode=1});

