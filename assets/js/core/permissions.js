window.NCPermissions={levels:{PREPARADOR:10,TECNICO:20,LIDER:30,GERENCIA:40,ADMIN:99}};
NCPermissions.can=function(user,required){var role=(user&&user.role)||"PREPARADOR";return (NCPermissions.levels[role]||0)>=(NCPermissions.levels[required]||0);};
