import{s as n,w as u}from"./index-ea234c37.js";class y{static async getCustomers(r,t=1,a=20){var s;try{let e=n.from("customers").select(`
          *,
          orders:orders(count)
        `,{count:"exact"});(s=r==null?void 0:r.area)!=null&&s.length&&(e=e.in("area",r.area)),r!=null&&r.search&&(e=e.or(`name.ilike.%${r.search}%,phone.ilike.%${r.search}%`)),(r==null?void 0:r.is_active)!==void 0&&(e=e.eq("is_active",r.is_active));const o=(t-1)*a,w=o+a-1;e=e.range(o,w);const{data:i,error:d,count:c}=await e;if(d)throw d;return{data:(i==null?void 0:i.map(_=>{var h,l;return{..._,total_orders:((l=(h=_.orders)==null?void 0:h[0])==null?void 0:l.count)||0}}))||[],total:c||0,page:t,limit:a,total_pages:Math.ceil((c||0)/a)}}catch(e){throw new Error(u(e))}}static async getCustomerById(r){var t,a,s;try{const{data:e,error:o}=await n.from("customers").select(`
          *,
          orders:orders(
            *,
            team:teams(name),
            items:order_items(
              *,
              service:services(name, name_ar)
            )
          )
        `).eq("id",r).single();if(o)throw o;if(!e)throw new Error("العميل غير موجود");return{...e,total_orders:((t=e.orders)==null?void 0:t.length)||0,last_order_date:(s=(a=e.orders)==null?void 0:a[0])==null?void 0:s.created_at}}catch(e){throw new Error(u(e))}}static async createCustomer(r){try{const{data:t,error:a}=await n.from("customers").insert(r).select().single();if(a)throw a;return{success:!0,data:t,message:"تم إضافة العميل بنجاح"}}catch(t){return{success:!1,error:u(t)}}}static async updateCustomer(r,t){try{const{data:a,error:s}=await n.from("customers").update({...t,updated_at:new Date().toISOString()}).eq("id",r).select().single();if(s)throw s;return{success:!0,data:a,message:"تم تحديث بيانات العميل بنجاح"}}catch(a){return{success:!1,error:u(a)}}}static async deleteCustomer(r){try{const{error:t}=await n.from("customers").update({is_active:!1,updated_at:new Date().toISOString()}).eq("id",r);if(t)throw t;return{success:!0,message:"تم حذف العميل بنجاح"}}catch(t){return{success:!1,error:u(t)}}}static async searchCustomers(r){try{const{data:t,error:a}=await n.from("customers").select("*").eq("is_active",!0).or(`name.ilike.%${r}%,phone.ilike.%${r}%`).limit(10);if(a)throw a;return t||[]}catch(t){throw new Error(u(t))}}static async getCustomerStats(r){var t;try{const{data:a,error:s}=await n.from("orders").select(`
          id,
          total_amount,
          status,
          customer_rating,
          created_at
        `).eq("customer_id",r);if(s)throw s;const e=a||[],o=e.length,w=e.filter(c=>c.status==="completed").length,i=e.reduce((c,m)=>c+(m.total_amount||0),0),d=e.filter(c=>c.customer_rating).reduce((c,m,_,h)=>c+(m.customer_rating||0)/h.length,0);return{total_orders:o,completed_orders:w,total_spent:i,average_rating:d,last_order_date:(t=e[0])==null?void 0:t.created_at}}catch(a){throw new Error(u(a))}}static async getCustomersByArea(){try{const{data:r,error:t}=await n.from("customers").select("area").eq("is_active",!0).not("area","is",null);if(t)throw t;const a=(r||[]).reduce((s,e)=>{const o=e.area||"غير محدد";return s[o]=(s[o]||0)+1,s},{});return Object.entries(a).map(([s,e])=>({area:s,count:e}))}catch(r){throw new Error(u(r))}}}export{y as C};
