window.NCStorage={};
NCStorage.get=function(k,d){var v=localStorage.getItem(k);return v?JSON.parse(v):d;};
NCStorage.set=function(k,v){localStorage.setItem(k,JSON.stringify(v));};
NCStorage.remove=function(k){localStorage.removeItem(k);};
