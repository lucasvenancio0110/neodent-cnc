window.NCUtils={};
NCUtils.pad2=function(n){return String(n).padStart(2,"0");};
NCUtils.normalizeTnl=function(v){var n=String(v||"").replace(/\D/g,"");return n?n.padStart(3,"0").slice(-3):"";};
NCUtils.nowText=function(){var d=new Date();return NCUtils.pad2(d.getHours())+":"+NCUtils.pad2(d.getMinutes());};
NCUtils.parseCycleSeconds=function(input){var s=String(input||"").trim().replace(/\s+/g,"");if(!s)return NaN;var m=s.match(/^(\d+)[,:](\d{1,2})$/);if(m){var min=Number(m[1]),sec=Number(m[2]);return sec>=60?NaN:min*60+sec;}if(/^\d+$/.test(s))return Number(s);return NaN;};
