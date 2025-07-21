import{s as o,w as u,x as y}from"./index-ea234c37.js";class b{static async getOrders(e,s=1,t=20){var a,d;try{let r=o.from("orders").select(`
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
        `,{count:"exact"}).order("created_at",{ascending:!1});(a=e==null?void 0:e.status)!=null&&a.length&&(r=r.in("status",e.status)),(d=e==null?void 0:e.payment_status)!=null&&d.length&&(r=r.in("payment_status",e.payment_status)),e!=null&&e.date_from&&(r=r.gte("scheduled_date",e.date_from)),e!=null&&e.date_to&&(r=r.lte("scheduled_date",e.date_to)),e!=null&&e.customer_id&&(r=r.eq("customer_id",e.customer_id)),e!=null&&e.team_id&&(r=r.eq("team_id",e.team_id)),e!=null&&e.search&&(r=r.or(`order_number.ilike.%${e.search}%`));const c=(s-1)*t,i=c+t-1;r=r.range(c,i);const{data:g,error:m,count:_}=await r;if(m)throw m;return{data:g||[],total:_||0,page:s,limit:t,total_pages:Math.ceil((_||0)/t)}}catch(r){throw new Error(u(r))}}static async getOrderById(e){try{const{data:s,error:t}=await o.from("orders").select(`
          *,
          customer:customers(*),
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              worker:workers(*)
            )
          ),
          items:order_items(
            *,
            service:services(*)
          ),
          status_logs:order_status_logs(
            *,
            created_by_user:users(full_name)
          )
        `).eq("id",e).single();if(t)throw t;if(!s)throw new Error("الطلب غير موجود");return s}catch(s){throw new Error(u(s))}}static async createOrder(e,s){try{const t=await y(),a=s.reduce((m,_)=>m+_.total_price,0),{data:d,error:r}=await o.from("orders").insert({...e,order_number:t,total_amount:a}).select().single();if(r)throw r;const c=s.map(m=>({...m,order_id:d.id})),{error:i}=await o.from("order_items").insert(c);if(i)throw i;return await o.from("order_status_logs").insert({order_id:d.id,status:"pending",notes:"تم إنشاء الطلب",created_by:e.created_by}),{success:!0,data:await this.getOrderById(d.id),message:"تم إنشاء الطلب بنجاح"}}catch(t){return{success:!1,error:u(t)}}}static async updateOrder(e,s){try{const{data:t,error:a}=await o.from("orders").update({...s,updated_at:new Date().toISOString()}).eq("id",e).select().single();if(a)throw a;return{success:!0,data:t,message:"تم تحديث الطلب بنجاح"}}catch(t){return{success:!1,error:u(t)}}}static async updateOrderStatus(e,s,t,a,d){try{const{error:r}=await o.from("orders").update({status:s,updated_at:new Date().toISOString()}).eq("id",e);if(r)throw r;const{error:c}=await o.from("order_status_logs").insert({order_id:e,status:s,notes:t,images:d||[],created_by:a});if(c)throw c;return{success:!0,message:"تم تحديث حالة الطلب بنجاح"}}catch(r){return{success:!1,error:u(r)}}}static async assignTeamToOrder(e,s,t){try{const{error:a}=await o.from("orders").update({team_id:s,status:"scheduled",updated_at:new Date().toISOString()}).eq("id",e);if(a)throw a;return await o.from("order_status_logs").insert({order_id:e,status:"scheduled",notes:"تم تعيين فريق للطلب",created_by:t}),{success:!0,message:"تم تعيين الفريق للطلب بنجاح"}}catch(a){return{success:!1,error:u(a)}}}static async getTodayOrders(){try{const e=new Date().toISOString().split("T")[0],{data:s,error:t}=await o.from("orders").select(`
          *,
          customer:customers(*),
          team:teams(*),
          items:order_items(
            *,
            service:services(*)
          )
        `).eq("scheduled_date",e).order("scheduled_time");if(t)throw t;return s||[]}catch(e){throw new Error(u(e))}}static async getPendingOrders(){try{const{data:e,error:s}=await o.from("orders").select(`
          *,
          customer:customers(*),
          items:order_items(
            *,
            service:services(*)
          )
        `).eq("status","pending").order("created_at");if(s)throw s;return e||[]}catch(e){throw new Error(u(e))}}static async cancelOrder(e,s,t){try{const{error:a}=await o.from("orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",e);if(a)throw a;return await o.from("order_status_logs").insert({order_id:e,status:"cancelled",notes:`تم إلغاء الطلب: ${s}`,created_by:t}),{success:!0,message:"تم إلغاء الطلب بنجاح"}}catch(a){return{success:!1,error:u(a)}}}static async completeOrder(e,s,t,a,d,r){try{const{error:c}=await o.from("orders").update({status:"completed",payment_status:s,payment_method:t,customer_rating:a,customer_feedback:d,updated_at:new Date().toISOString()}).eq("id",e);if(c)throw c;return await o.from("order_status_logs").insert({order_id:e,status:"completed",notes:"تم إنهاء الطلب بنجاح",created_by:r}),{success:!0,message:"تم إنهاء الطلب بنجاح"}}catch(c){return{success:!1,error:u(c)}}}static async getOrderStats(e,s){try{let t=o.from("orders").select("status, total_amount, customer_rating");e&&(t=t.gte("scheduled_date",e)),s&&(t=t.lte("scheduled_date",s));const{data:a,error:d}=await t;if(d)throw d;const r=a||[],c=r.length,i=r.filter(n=>n.status==="completed").length,g=r.filter(n=>n.status==="cancelled").length,m=r.filter(n=>n.status==="pending").length,_=r.filter(n=>n.status==="completed").reduce((n,w)=>n+(w.total_amount||0),0),h=r.filter(n=>n.customer_rating).reduce((n,w,O,l)=>n+(w.customer_rating||0)/l.length,0);return{total_orders:c,completed_orders:i,cancelled_orders:g,pending_orders:m,total_revenue:_,average_rating:h,completion_rate:c>0?i/c*100:0}}catch(t){throw new Error(u(t))}}}export{b as O};
