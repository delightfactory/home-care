import{s as o,w as c}from"./index-ea234c37.js";class p{static async getWorkers(r){var t;try{let e=o.from("workers").select(`
          *,
          user:users(*),
          team_members:team_members(
            team:teams(*)
          )
        `).order("name");(t=r==null?void 0:r.status)!=null&&t.length&&(e=e.in("status",r.status)),r!=null&&r.team_id&&(e=e.eq("team_members.team_id",r.team_id)),(r==null?void 0:r.can_drive)!==void 0&&(e=e.eq("can_drive",r.can_drive)),r!=null&&r.search&&(e=e.or(`name.ilike.%${r.search}%,phone.ilike.%${r.search}%`));const{data:a,error:i}=await e;if(i)throw i;return(a||[]).map(u=>{var m,n;return{...u,team:(n=(m=u.team_members)==null?void 0:m[0])==null?void 0:n.team}})}catch(e){throw new Error(c(e))}}static async getWorkerById(r){var t,e;try{const{data:a,error:i}=await o.from("workers").select(`
          *,
          user:users(*),
          team_members:team_members(
            team:teams(*)
          )
        `).eq("id",r).single();if(i)throw i;if(!a)throw new Error("العامل غير موجود");return{...a,team:(e=(t=a.team_members)==null?void 0:t[0])==null?void 0:e.team}}catch(a){throw new Error(c(a))}}static async createWorker(r){try{const{data:t,error:e}=await o.from("workers").insert(r).select().single();if(e)throw e;return{success:!0,data:t,message:"تم إضافة العامل بنجاح"}}catch(t){return{success:!1,error:c(t)}}}static async updateWorker(r,t){try{const{data:e,error:a}=await o.from("workers").update({...t,updated_at:new Date().toISOString()}).eq("id",r).select().single();if(a)throw a;return{success:!0,data:e,message:"تم تحديث بيانات العامل بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async updateWorkerStatus(r,t){try{const{data:e,error:a}=await o.from("workers").update({status:t,updated_at:new Date().toISOString()}).eq("id",r).select().single();if(a)throw a;return{success:!0,data:e,message:"تم تحديث حالة العامل بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async getAvailableWorkers(){try{const{data:r,error:t}=await o.from("workers").select(`
          *,
          team_members:team_members(team_id)
        `).eq("status","active").order("name");if(t)throw t;return(r||[]).filter(e=>!e.team_members||e.team_members.length===0)}catch(r){throw new Error(c(r))}}static async getWorkerStats(r,t,e){try{let a=o.from("orders").select(`
          id,
          status,
          total_amount,
          customer_rating,
          scheduled_date,
          team:teams!inner(
            team_members!inner(worker_id)
          )
        `).eq("team.team_members.worker_id",r);t&&(a=a.gte("scheduled_date",t)),e&&(a=a.lte("scheduled_date",e));const{data:i,error:u}=await a;if(u)throw u;const m=i||[],n=m.length,d=m.filter(s=>s.status==="completed").length,l=m.filter(s=>s.status==="completed").reduce((s,_)=>s+(_.total_amount||0),0),w=m.filter(s=>s.customer_rating).reduce((s,_,f,h)=>s+(_.customer_rating||0)/h.length,0);return{total_orders:n,completed_orders:d,total_revenue:l,average_rating:w,completion_rate:n>0?d/n*100:0}}catch(a){throw new Error(c(a))}}}class b{static async getTeams(){try{const{data:r,error:t}=await o.from("teams").select(`
          *,
          leader:workers!teams_leader_id_fkey(*),
          members:team_members(
            worker:workers(*)
          )
        `).eq("is_active",!0).order("name");if(t)throw t;return(r||[]).map(e=>{var a;return{...e,member_count:((a=e.members)==null?void 0:a.length)||0,status:e.is_active?"active":"inactive"}})}catch(r){throw new Error(c(r))}}static async getTeamById(r){var t;try{const{data:e,error:a}=await o.from("teams").select(`
          *,
          leader:workers!teams_leader_id_fkey(*),
          members:team_members(
            *,
            worker:workers(*)
          )
        `).eq("id",r).single();if(a)throw a;if(!e)throw new Error("الفريق غير موجود");return{...e,member_count:((t=e.members)==null?void 0:t.length)||0,status:e.is_active?"active":"inactive"}}catch(e){throw new Error(c(e))}}static async createTeam(r,t=[]){try{const{data:e,error:a}=await o.from("teams").insert(r).select().single();if(a)throw a;const i=Array.from(new Set(t));if(i.length>0){const m=i.map(d=>({team_id:e.id,worker_id:d})),{error:n}=await o.from("team_members").upsert(m,{ignoreDuplicates:!0});if(n)throw n}return{success:!0,data:await this.getTeamById(e.id),message:"تم إنشاء الفريق بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async updateTeam(r,t){try{const{data:e,error:a}=await o.from("teams").update({...t,updated_at:new Date().toISOString()}).eq("id",r).select().single();if(a)throw a;return{success:!0,data:e,message:"تم تحديث بيانات الفريق بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async deleteTeam(r){try{const{error:t}=await o.from("teams").update({is_active:!1,updated_at:new Date().toISOString()}).eq("id",r);if(t)throw t;return{success:!0,message:"تم حذف الفريق بنجاح"}}catch(t){return{success:!1,error:c(t)}}}static async addTeamMember(r,t){try{const{error:e}=await o.from("team_members").upsert({team_id:r,worker_id:t},{ignoreDuplicates:!0});if(e)throw e;return{success:!0,message:"تم إضافة العضو للفريق بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async removeTeamMember(r,t){try{const{error:e}=await o.from("team_members").delete().eq("team_id",r).eq("worker_id",t);if(e)throw e;return{success:!0,message:"تم إزالة العضو من الفريق بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async getTeamPerformance(r,t,e){try{let a=o.from("orders").select("status, total_amount, customer_rating, scheduled_date").eq("team_id",r);t&&(a=a.gte("scheduled_date",t)),e&&(a=a.lte("scheduled_date",e));const{data:i,error:u}=await a;if(u)throw u;const m=i||[],n=m.length,d=m.filter(s=>s.status==="completed").length,l=m.filter(s=>s.status==="completed").reduce((s,_)=>s+(_.total_amount||0),0),w=m.filter(s=>s.customer_rating).reduce((s,_,f,h)=>s+(_.customer_rating||0)/h.length,0);return{total_orders:n,completed_orders:d,total_revenue:l,average_rating:w,completion_rate:n>0?d/n*100:0}}catch(a){throw new Error(c(a))}}static async getAvailableTeams(r){try{const{data:t,error:e}=await o.from("teams").select(`
          *,
          routes:routes!left(id)
        `).eq("is_active",!0).neq("routes.date",r).order("name");if(e)throw e;return(t||[]).filter(a=>!a.routes||a.routes.length===0)}catch(t){throw new Error(c(t))}}}export{b as T,p as W};
