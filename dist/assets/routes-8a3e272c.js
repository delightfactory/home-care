import{c as w,s as o,w as c}from"./index-ea234c37.js";/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=w("Route",[["circle",{cx:"6",cy:"19",r:"3",key:"1kj8tv"}],["path",{d:"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15",key:"1d8sl"}],["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}]]);class f{static async getRoutes(t,e=1,r=20){var a;try{let s=o.from("routes").select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `,{count:"exact"}).order("date",{ascending:!1}).order("start_time",{ascending:!0});t!=null&&t.date&&(s=s.eq("date",t.date)),t!=null&&t.team_id&&(s=s.eq("team_id",t.team_id)),(a=t==null?void 0:t.status)!=null&&a.length&&(s=s.in("status",t.status));const n=(e-1)*r,m=n+r-1;s=s.range(n,m);const{data:d,error:u,count:i}=await s;if(u)throw u;return{data:d||[],total:i||0,page:e,limit:r,total_pages:Math.ceil((i||0)/r)}}catch(s){throw new Error(c(s))}}static async getRoute(t){try{const{data:e,error:r}=await o.from("routes").select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `).eq("id",t).single();if(r&&r.code!=="PGRST116")throw r;return e}catch(e){throw new Error(c(e))}}static async createRoute(t){try{const{data:e,error:r}=await o.from("routes").insert(t).select().single();if(r)throw r;return{success:!0,data:e,message:"تم إنشاء خط السير بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async updateRoute(t,e){try{const{data:r,error:a}=await o.from("routes").update({...e,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(a)throw a;return{success:!0,data:r,message:"تم تحديث خط السير بنجاح"}}catch(r){return{success:!1,error:c(r)}}}static async deleteRoute(t){try{const{error:e}=await o.from("routes").delete().eq("id",t);if(e)throw e;return{success:!0,message:"تم حذف خط السير بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async addOrderToRoute(t,e,r,a,s){try{const n={route_id:t,order_id:e,sequence_order:r,estimated_arrival_time:a,estimated_completion_time:s},{data:m,error:d}=await o.from("route_orders").insert(n).select().single();if(d)throw d;return await o.from("orders").update({status:"scheduled"}).eq("id",e),{success:!0,data:m,message:"تم إضافة الطلب إلى خط السير بنجاح"}}catch(n){return{success:!1,error:c(n)}}}static async removeOrderFromRoute(t,e){try{const{error:r}=await o.from("route_orders").delete().eq("route_id",t).eq("order_id",e);if(r)throw r;return await o.from("orders").update({status:"pending"}).eq("id",e),{success:!0,message:"تم إزالة الطلب من خط السير بنجاح"}}catch(r){return{success:!1,error:c(r)}}}static async reorderRouteOrders(t,e){try{const r=e.map(({order_id:a,sequence_order:s})=>o.from("route_orders").update({sequence_order:s}).eq("route_id",t).eq("order_id",a));return await Promise.all(r),{success:!0,message:"تم إعادة ترتيب الطلبات بنجاح"}}catch(r){return{success:!1,error:c(r)}}}static async startRoute(t){try{const{data:e,error:r}=await o.from("routes").update({status:"in_progress",actual_start_time:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",t).select().single();if(r)throw r;return{success:!0,data:e,message:"تم بدء خط السير بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async completeRoute(t){try{const{data:e,error:r}=await o.from("routes").update({status:"completed",actual_end_time:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",t).select().single();if(r)throw r;return{success:!0,data:e,message:"تم إكمال خط السير بنجاح"}}catch(e){return{success:!1,error:c(e)}}}static async getAvailableOrders(t){try{let e=o.from("orders").select(`
          *,
          customer:customers(*),
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*)
          ),
          items:order_items(
            *,
            service:services(*)
          )
        `).eq("status","pending").order("scheduled_date").order("scheduled_time");t&&(e=e.eq("scheduled_date",t));const{data:r,error:a}=await e;if(a)throw a;return r||[]}catch(e){throw new Error(c(e))}}static async getRoutesByDate(t){try{const{data:e,error:r}=await o.from("routes").select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `).eq("date",t).order("start_time");if(r)throw r;return e||[]}catch(e){throw new Error(c(e))}}static async getRouteStatistics(t){try{const e=await this.getRoute(t);if(!e)throw new Error("Route not found");const r=e.route_orders||[],a=r.length,s=r.filter(d=>{var u;return((u=d.order)==null?void 0:u.status)==="completed"}).length,n=r.reduce((d,u)=>{var i;return d+(((i=u.order)==null?void 0:i.total_amount)||0)},0),m=r.filter(d=>{var u;return(u=d.order)==null?void 0:u.customer_rating}).reduce((d,u,i,l)=>{var _;return d+(((_=u.order)==null?void 0:_.customer_rating)||0)/l.length},0)||0;return{total_orders:a,completed_orders:s,completion_rate:a>0?s/a*100:0,total_amount:n,average_rating:m,estimated_duration:e.total_estimated_time||0,total_distance:e.total_distance||0}}catch(e){throw new Error(c(e))}}}export{f as R,y as a};
