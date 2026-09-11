# CRM Estudio — Monteclaro

CRM interno para un estudio de tatuajes y perforaciones: cuadre diario de ingresos/egresos
con múltiples medios de pago, control de inventario con descuento automático al registrar
una perforación, catálogo de servicios, gestión de usuarios con roles, y calendario de
Google integrado para consultar/crear citas desde cualquier parte.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** (Postgres + Auth + Row Level Security) como base de datos
- **Google Calendar API** (OAuth2) para las citas
- **Vercel** para el despliegue
- **GitHub** para el código fuente

## Estructura relevante

```
supabase/schema.sql        → todo el esquema de base de datos (tablas, triggers, RLS)
src/app/(dashboard)/       → páginas del panel (resumen, cuadre, inventario, servicios, calendario, usuarios)
src/app/api/               → endpoints del backend (transacciones, cierres, productos, servicios, usuarios, Google)
src/lib/supabase/          → clientes de Supabase (browser, server, admin, middleware)
src/lib/google/calendar.ts → integración con Google Calendar (OAuth, eventos)
src/proxy.ts               → protección de rutas por sesión (antes "middleware.ts" en Next 15)
```

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** → pega el contenido de `supabase/schema.sql` → **Run**.
   Esto crea todas las tablas, los triggers (incluido el que descuenta inventario
   automáticamente cuando se registra una perforación) y las políticas de seguridad (RLS).
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡mantenla secreta, solo se usa en el servidor!)
4. En **Authentication → Providers**, deja habilitado "Email" (usuario/contraseña).
   Desactiva "Confirm email" si quieres poder crear usuarios y que inicien sesión de inmediato
   (los usuarios creados desde el panel de **Usuarios** ya se crean con el correo confirmado).
5. **Primer usuario administrador:** regístrate una vez desde `/login` con "Forgot password"
   no aplica aquí — en su lugar, ve a **Authentication → Users** en Supabase, crea el primer
   usuario manualmente (o usa el signup si lo habilitas), y luego en el **SQL Editor** ejecuta:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
   ```
   Desde ahí, ese usuario puede crear a los demás desde la sección **Usuarios** del panel.

## 2. Configurar Google Calendar

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto (o usa uno existente).
2. **APIs & Services → Library** → busca "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - Tipo: External (o Internal si usan Google Workspace).
   - Agrega el scope `https://www.googleapis.com/auth/calendar`.
   - Agrega como "Test user" el correo de Google/Gmail cuyo calendario quieres usar
     (mientras la app no esté "publicada" en modo producción).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Tipo: "Web application".
   - **Authorized redirect URIs**, agrega ambas:
     - `http://localhost:3000/api/google/oauth/callback` (para probar en local)
     - `https://TU-DOMINIO-DE-VERCEL.vercel.app/api/google/oauth/callback` (producción)
   - Copia el **Client ID** y **Client Secret** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Una vez desplegado, entra al CRM como administrador → **Calendario** → **Conectar Google
   Calendar**, inicia sesión con la cuenta de Google del estudio y acepta los permisos.

> Si alguna vez necesitas reconectar y Google no te vuelve a pedir permiso (por lo que no
> llega un nuevo `refresh_token`), ve a [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
> revoca el acceso de la app, y vuelve a conectar desde el CRM.

## 3. Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa las variables
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 4. Subir el código a GitHub

```bash
git init                     # si aún no es un repo
git add .
git commit -m "CRM inicial del estudio"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

`.env.local` nunca se sube (está en `.gitignore`) — las variables de entorno se configuran
directamente en Vercel (paso siguiente).

## 5. Desplegar en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio de GitHub.
2. Framework: Next.js (se detecta automáticamente).
3. En **Environment Variables**, agrega las mismas variables del `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, y `GOOGLE_REDIRECT_URI` (usando tu dominio
   real de Vercel, terminado en `/api/google/oauth/callback`).
4. **Deploy**.
5. Si cambiaste de dominio o es la primera vez, actualiza también el "Authorized redirect
   URI" en Google Cloud Console con el dominio final, y vuelve a desplegar si cambiaste
   `GOOGLE_REDIRECT_URI`.

## Notas de diseño / decisiones tomadas

- **Roles:** `admin` y `empleado`. Ambos pueden registrar movimientos del cuadre diario y
  gestionar inventario/servicios; solo `admin` puede editar o eliminar movimientos ya
  registrados, cerrar/reabrir el cuadre del día libremente, gestionar usuarios y
  conectar/desconectar Google Calendar. Ajustable en `supabase/schema.sql` (sección RLS)
  si el estudio necesita otro reparto de permisos.
- **Descuento de inventario:** al registrar un movimiento de tipo "ingreso" asociado a un
  servicio de tipo "Perforación", se eligen manualmente los productos usados (por ejemplo,
  la joya) y se descuentan automáticamente del stock mediante un trigger en la base de
  datos — queda registrado en `inventory_movements` como auditoría, y se revierte si se
  elimina el movimiento.
- **Medios de pago** incluidos de entrada: Efectivo, Tarjeta débito/crédito, Transferencia
  bancaria, Nequi/Daviplata. Se pueden agregar o desactivar otros desde la tabla
  `payment_methods` en Supabase.
- **Calendario:** se conecta **una sola cuenta de Google** para todo el estudio (no una por
  empleado), para que cualquier usuario del CRM vea y agende las mismas citas.

## Próximos pasos sugeridos (no incluidos)

- Reportes/exportables (PDF o Excel) del cuadre mensual.
- Notificaciones (WhatsApp/correo) de citas próximas o stock bajo.
- Fotos de referencia por cliente/servicio.

## Qué necesito de ti para dejarlo desplegado

1. **Supabase:** URL del proyecto + `anon key` + `service_role key` (o acceso para crear
   el proyecto yo mismo si me compartes un token de la API de gestión de Supabase).
2. **GitHub:** un repositorio vacío (puedes crearlo tú) + un token de acceso personal con
   permiso de escritura, o acceso de colaborador al repo.
3. **Vercel:** un token de API (Account Settings → Tokens) para crear el proyecto y
   configurar las variables de entorno, o acceso de colaborador si prefieres crear el
   proyecto tú mismo desde el dashboard.
4. **Google Cloud:** Client ID y Client Secret de un cliente OAuth "Web application" con
   la Google Calendar API habilitada (pasos en la sección 2 de arriba) — y decirme qué
   cuenta de Gmail/Google Workspace es la del calendario del estudio.
