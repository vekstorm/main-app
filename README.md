# Identity App — OAuth2 Client Frontend

Aplicación frontend Angular que implementa el flujo **Authorization Code + PKCE + client_secret_basic** contra un servidor OAuth2 / OpenID Connect. Incluye un panel de administración CRUD para gestionar usuarios, roles y permisos del servidor de autorización. Soporta ejecución web y móvil mediante Capacitor.

---

## Tecnologías

| Tecnología | Versión | Propósito |
|---|---|---|
| **Angular** | 22 | Framework de componentes standalone con signals, reactivo y moderno. Se elige por su madurez, ecosistema y soporte corporativo. |
| **TypeScript** | 6.0 | Tipado estático para mayor robustez y productividad en el desarrollo. |
| **Bootstrap 5** | 5.3 | Librería CSS para layout responsivo, tabs, navbar, formularios y utilidades. Se integra via `angular.json` (css + js bundle). |
| **SCSS** | — | Preprocesador CSS con anidamiento, variables y animaciones. Tema oscuro personalizado. |
| **Capacitor** | 8 | Entorno nativo multiplataforma (Android/iOS). Permite empaquetar la app web como aplicación móvil con acceso a APIs nativas. |
| **Angular Router** | 22 | Enrutamiento lazy-loaded para carga bajo demanda del componente Home. |
| **Angular Reactive Forms** | 22 | Formularios reactivos con validación tipada para los modales CRUD. |
| **Angular HTTP Client** | 22 | Cliente HTTP con interceptors funcionales para inyectar el token JWT Bearer automáticamente. |
| **Vitest** | 4 | Ejecutor de tests unitarios integrado con Angular CLI (`ng test`). |
| **RxJS** | 7.8 | Programación reactiva para conversión de Observables a Promesas (`firstValueFrom`). |

---

## Arquitectura

```
src/
├── index.html                  # Entry point HTML
├── main.ts                     # Bootstrap de Angular (bootstrapApplication)
├── styles.scss                 # Estilos globales (tema oscuro, animaciones, scanlines)
├── app/
│   ├── app.ts                  # Componente raíz (captura code OAuth del callback)
│   ├── app.html                # Template raíz con router-outlet
│   ├── app.routes.ts           # Definición de rutas (lazy load Home)
│   ├── app.config.ts           # Configuración global (providers, interceptors)
│   ├── core/
│   │   ├── pkce.ts             # Utilidades PKCE: code verifier, challenge, storage
│   │   ├── auth.interceptor.ts # Interceptor funcional que añade Bearer token
│   │   └── app-config.token.ts # InjectionToken para la configuración
│   ├── services/
│   │   ├── auth.service.ts     # Gestión de autenticación (login, logout, refresh, JWT parse)
│   │   └── api.service.ts      # Llamadas HTTP a la API REST del authorization server
│   └── components/
│       ├── menu/               # Barra de navegación superior con login/logout
│       ├── home/               # Página principal (dashboard + tabs CRUD)
│       ├── users/              # CRUD de usuarios
│       │   └── user-form-modal/# Modal formulario reactivo para crear/editar usuario
│       ├── roles/              # CRUD de roles
│       │   └── role-form-modal/ # Modal formulario reactivo para crear/editar rol
│       └── permissions/        # CRUD de permisos (con batch delete)
│           └── permission-form-modal/ # Modal formulario reactivo para crear/editar permiso
└── environments/
    ├── environment.model.ts    # Interfaz AppEnvironment
    ├── environment.ts          # Configuración de producción
    └── environment.development.ts # Configuración de desarrollo (file replacement)
```

### Flujo de autenticación

1. El usuario hace clic en **Login** en el componente `Menu`
2. Se genera un **code verifier** criptográficamente aleatorio (32 bytes → hex) y su **code challenge** (SHA-256 base64url) mediante utilidades en `core/pkce.ts`
3. El code verifier se almacena en `sessionStorage`; el navegador redirige al authorization server con los parámetros OAuth2 estándar
4. Tras autenticarse, el servidor redirige de vuelta con un `code` en la URL
5. El componente raíz `App` captura el código en `ngOnInit` y delega en `AuthService.handleOAuthCallback()`
6. `AuthService` canjea el código por tokens mediante `ApiService.exchangeToken()` usando **Basic Auth** (`client_id:client_secret`) y el code verifier
7. El JWT se parsea para extraer claims (roles, autoridades) y se persiste en `localStorage`
8. El estado de autenticación se expone como signal (`_isAuthenticated`) para reactividad en la UI

### Componentes

| Componente | Ruta | Descripción |
|---|---|---|
| `App` | raíz | Captura el code OAuth del callback y renderiza Menu + RouterOutlet |
| `Menu` | — | Navbar con logo, botón Login/Logout. Login genera PKCE y redirige al servidor |
| `Home` | `/` | Dashboard con tabs (Users, Roles, Permissions) visibles solo si autenticado |
| `Users` | (tab) | Tabla paginada con búsqueda, crear/editar/desactivar/reset password/eliminar usuarios |
| `UserFormModal` | (modal) | Formulario reactivo con username, email, password, nombre, roles checkbox, estado |
| `Roles` | (tab) | Tabla paginada con búsqueda, crear/editar/eliminar roles y asignar permisos |
| `RoleFormModal` | (modal) | Formulario reactivo con nombre, descripción y multiselect de permisos con búsqueda |
| `Permissions` | (tab) | Tabla paginada con selección múltiple, batch delete, crear/editar/eliminar permisos |
| `PermissionFormModal` | (modal) | Formulario reactivo simple con nombre y descripción |

### Servicios

| Servicio | Descripción |
|---|---|
| `AuthService` | Signals de autenticación, gestión de tokens en localStorage, parseo JWT, claims, logout con limpieza de sesión |
| `ApiService` | CRUD completo contra `/api/v1/user`, `/api/v1/role`, `/api/v1/permission` más canje y refresh de tokens |

### Core utilities

| Módulo | Descripción |
|---|---|
| `pkce.ts` | Generación de code verifier (32 bytes aleatorios hex), code challenge (SHA-256 base64url), persistencia en sessionStorage |
| `auth.interceptor.ts` | Interceptor funcional que añade `Authorization: Bearer <token>` a todas las requests excepto a `/oauth2/token` |
| `app-config.token.ts` | InjectionToken `APP_CONFIG` que provee la configuración del entorno (URIs, clientId, secrets) |

---

## Configuración

Los entornos se definen en `src/environments/`. La interfaz `AppEnvironment` contiene:

```typescript
interface AppEnvironment {
  production: boolean;
  apiUrl: string;                // URL base del authorization server
  authorizeUri?: string;         // Endpoint de autorización OAuth2
  tokenUri?: string;             // Endpoint de tokens
  clientId?: string;             // Identificador del cliente OAuth2
  clientSecret?: string;         // Secreto del cliente (Basic Auth)
  redirectUri?: string;          // URI de redirección post-login
  scope?: string;                // Scopes solicitados
  responseType?: string;         // response_type (code)
  responseMode?: string;         // response_mode (form_post)
  codeChallengeMethod?: string;  // Método PKCE (S256)
}
```

En desarrollo se usa `environment.development.ts` (file replacement vía `angular.json`), en producción `environment.ts`.

---

## Estructura del proyecto

```
main-app/
├── angular.json              # Configuración de Angular CLI (build, serve, test)
├── capacitor.config.ts       # Configuración de Capacitor (appId, webDir)
├── package.json              # Dependencias y scripts npm
├── tsconfig.json             # Configuración base de TypeScript
├── tsconfig.app.json         # Configuración TS para la app (src/**/*.ts)
├── tsconfig.spec.json        # Configuración TS para tests
├── .editorconfig             # Estilo de código consistente
├── .prettierrc               # Formateo con Prettier
├── android/                  # Proyecto Android nativo (generado por Capacitor)
├── public/                   # Assets estáticos (favicon, etc.)
├── src/                      # Código fuente
└── dist/                     # Artefactos de build
```

---

## Puesta en marcha

### Requisitos

- Node.js 22+
- npm 11+
- Authorization Server en ejecución (ver `authorization-server/`)
- Cliente OAuth2 registrado en la base de datos del authorization server con los redirect URIs correctos

### Instalación

```bash
cd apps/main-app
npm install
```

### Desarrollo

```bash
ng serve --host 0.0.0.0
```

El servidor de desarrollo se levanta en el puerto 4200 por defecto. Los redirect URIs en la base de datos del authorization server deben coincidir con la URL donde se sirve esta app.

### Build

```bash
ng build
```

Los artefactos se generan en `dist/main-app/browser/`.

### Tests

```bash
ng test
```

Ejecuta los tests unitarios con Vitest.

### Mobile (Capacitor Android)

```bash
npm run build
npx cap sync
npx cap open android
```

El login en Capacitor usa `Browser.open()` con un custom scheme configurable (ej. `com.app.identity://callback`) como redirect URI, capturado mediante el listener `appUrlOpen`.

---

## Notas técnicas

- El interceptor salta el Bearer para `/oauth2/token` porque ese endpoint usa Basic Auth (`client_id:client_secret`)
- Los formularios reactivos usan `markAllAsTouched()` en submit si el formulario es inválido, sin deshabilitar el botón
- El estado de autenticación persiste entre recargas: `_isAuthenticated` se inicializa verificando la existencia de un token válido en `localStorage`
- Los modales CRUD se comunican con los padres mediante `input()` y `output()` signals
- Las animaciones globales (reveal, bar-sweep, glow-pulse) están definidas en `styles.scss` con delays escalonados
- La sesión se limpia completamente en logout: localStorage, sessionStorage y cookies expiradas
