import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":"https://melanysi.github.io","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(status:number,message:string,success=false)=>new Response(JSON.stringify({success,message}),{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return respond(405,"Método não permitido");
 try {
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return respond(401,"Autenticação obrigatória");
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await client.auth.getUser(token);
  if(error||!user)return respond(401,"Sessão inválida");
  const {data:profile}=await client.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
  if(profile?.role!=="admin"||profile.status!=="active")return respond(403,"Somente administradores ativos podem excluir");
  const {user_id}=await req.json();
  if(typeof user_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(user_id)||user_id===user.id)return respond(400,"Identificador inválido");
  const {data:access,error:accessError}=await client.from("partner_portal_access").select("application_id,is_active").eq("user_id",user_id).maybeSingle();
  if(accessError||!access||access.is_active)return respond(409,"Apenas cadastros suspensos podem ser excluídos");
  const {data:application,error:appError}=await client.from("applications").select("id,status").eq("id",access.application_id).maybeSingle();
  if(appError||!application||!["rejected","suspended"].includes(application.status))return respond(409,"Solicitação não elegível");
  const {data:others,error:othersError}=await client.from("applications").select("id,status").contains("details",{portal_user_id:user_id});
  if(othersError||others?.some(a=>!["rejected","suspended"].includes(a.status)))return respond(409,"Existem solicitações que precisam ser preservadas");
  const {error:e1}=await client.from("partner_signup_requests").delete().eq("user_id",user_id);if(e1)throw e1;
  const {error:e2}=await client.from("partner_portal_access").delete().eq("user_id",user_id);if(e2)throw e2;
  const ids=[...new Set([application.id,...(others||[]).map(a=>a.id)])];
  const {error:e3}=await client.from("applications").delete().in("id",ids).in("status",["rejected","suspended"]);if(e3)throw e3;
  const {error:e4}=await client.auth.admin.deleteUser(user_id);if(e4)throw e4;
  return respond(200,"Cadastro excluído",true);
 } catch {return respond(500,"Falha na exclusão. Verifique o Supabase antes de tentar novamente.");}
});