window.NCApi={};
NCApi.request=async function(path,options){var base=(window.NC_CONFIG&&NC_CONFIG.apiBase)||"";var token=localStorage.getItem("nc_token")||"";var cfg=options||{};cfg.headers=Object.assign({"Content-Type":"application/json"},cfg.headers||{});if(token)cfg.headers.Authorization="Bearer "+token;var res=await fetch(base+path,cfg);var data=await res.json().catch(function(){return null});if(!res.ok)throw new Error((data&&data.error)||"Erro na API");return data;};
NCApi.get=function(path){return NCApi.request(path,{method:"GET"});};
NCApi.post=function(path,body){return NCApi.request(path,{method:"POST",body:JSON.stringify(body||{})});};
