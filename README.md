# IoTizer — IoT Device Manager

Aplicación frontend **Angular 22** para la gestión de dispositivos IoT. Proporciona autenticación OAuth2 con PKCE, consola de comunicación Bluetooth/Serial, flasheo de firmware ESP32, y gestión de suscripciones.

---

## Tecnologías

| Tecnología | Versión | Propósito |
|---|---|---|
| **Angular** | 22 | Framework standalone con signals |
| **TypeScript** | 6.0 | Tipado estático |
| **Bootstrap 5** | 5.3 | Layout responsivo y utilidades CSS |
| **SCSS** | — | Preprocesador CSS con tema oscuro |
| **Capacitor** | 8 | Entorno nativo Android/iOS |
| **Angular HTTP Client** | 22 | Cliente HTTP con interceptores funcionales |
| **Vitest** | 4 | Tests unitarios |
| **RxJS** | 7.8 | Programación reactiva |
| **OpenAPI Generator** | 7.23.0 | Generación automática de clientes TypeScript |
| **esptool-js** | 0.6.0 | Flasheo de firmware ESP32 desde el navegador |
| **Prettier** | 3.8 | Formateo de código |

---

## Arquitectura

```
src/
├── index.html                          # Entry point HTML con overlay scanlines
├── main.ts                             # Bootstrap Angular (bootstrapApplication)
├── styles.scss                         # Estilos globales (fondos animados, keyframes)
├── environments/
│   ├── environment.model.ts            # Interface AppEnvironment
│   ├── environment.ts                  # Config producción
│   └── environment.development.ts      # Config desarrollo (file replacement)
├── app/
│   ├── app.ts                          # Componente raíz — captura code OAuth del callback
│   ├── app.html                        # Template raíz (menu + router-outlet + fondos)
│   ├── app.scss                        # Layout raíz
│   ├── app.config.ts                   # Providers globales (BASE_PATH, interceptors)
│   ├── app.routes.ts                   # Rutas: /, /devices, /device-console, /subscription
│   ├── core/
│   │   ├── pkce.ts                     # PKCE: code verifier, challenge, sessionStorage
│   │   ├── auth.interceptor.ts         # Interceptor que añade Bearer token
│   │   ├── app-config.token.ts         # InjectionToken APP_CONFIG
│   │   └── platform.service.ts         # Detección de plataforma (native, bluetooth, serial)
│   ├── services/
│   │   ├── auth.service.ts             # Autenticación: signals, JWT, claims, initSubscription
│   │   ├── api.service.ts              # Token exchange + refresh vía oauth2/token
│   │   ├── user-controller.service.ts          # OpenAPI: CRUD usuarios
│   │   ├── role-controller.service.ts          # OpenAPI: CRUD roles
│   │   ├── permission-controller.service.ts    # OpenAPI: CRUD permisos
│   │   ├── client-controller.service.ts        # OpenAPI: CRUD clientes OAuth2
│   │   ├── subscription-controller.service.ts  # OpenAPI: CRUD suscripciones
│   │   ├── subscription-users-controller.service.ts  # OpenAPI: usuarios de suscripción
│   │   └── dtos/                                # DTOs copiados desde generated/
│   │       ├── app-user-response-dto.ts
│   │       ├── subscription.ts
│   │       ├── subscription-users.ts
│   │       └── ... (22 DTOs en total)
│   ├── components/
│   │   ├── menu/                        # Navbar con Login/Logout + logo IoTizer
│   │   ├── home/                        # Dashboard principal con profile-bar y dash-grid
│   │   ├── devices/                     # Página de acciones: Flash device + Register device
│   │   ├── device-console/              # Consola de comunicación con el dispositivo
│   │   │   ├── device-console.ts        # Lógica Bluetooth + Serial + Terminal
│   │   │   └── components/
│   │   │       ├── flasher-component/   # Flasheo de firmware ESP32 (esptool-js)
│   │   │       └── add-device-component/# Placeholder para registro de dispositivo
│   │   └── subscription/               # Página de detalle de suscripción
│   └── generated/
│       ├── auth-api/                    # Cliente OpenAPI del auth-server
│       └── subscription-api/            # Cliente OpenAPI del subscription-server
```

---

## Autenticación (OAuth2 + PKCE)

### Flujo

1. El usuario hace clic en **Login** en el `Menu` o `Home`
2. `core/pkce.ts` genera un **code verifier** (32 bytes → hex) y su **code challenge** (SHA-256 base64url)
3. El code verifier se guarda en `sessionStorage`; el navegador redirige al auth-server con los parámetros OAuth2
4. Tras autenticarse, el servidor redirige con un `code` en la URL
5. El componente raíz `App` captura el código en `ngOnInit` y llama a `AuthService.handleOAuthCallback()`
6. `ApiService.exchangeToken()` canjea el código por tokens usando Basic Auth + PKCE
7. El JWT se parsea, se extraen claims (userId, scope, authorities, roles, permissions), y se persisten los tokens en `localStorage`
8. Un `effect()` en `Home` reacciona a `isAuthenticatedSignal()` y carga los datos del usuario
9. `AuthService.initSubscription()` crea automáticamente una suscripción para el usuario si no tiene una

### Claims extraídos del JWT

| Claim | Descripción |
|---|---|
| `user_id` / `sub` | Identificador del usuario |
| `scope` | Scopes (string o array) |
| `authorities` | Autoridades concedidas |
| `realm_access.roles` | Roles (formato Keycloak) |
| `resource_access.*.roles` | Permisos por cliente |

---

## Componentes

| Componente | Ruta | Descripción |
|---|---|---|
| `App` | `/` (raíz) | Captura code OAuth, renderiza Menu + RouterOutlet |
| `Menu` | — | Navbar con Login/Logout y logo IoTizer |
| `Home` | `/` | Dashboard: profile-bar con datos del usuario, dash-grid con tarjetas de navegación |
| `Devices` | `/devices` | Acciones: Flash device y Register device |
| `DeviceConsole` | `/device-console` | Consola interactiva con Bluetooth y Serial |
| `FlasherComponent` | (anidado) | Flasheo de firmware ESP32 vía Web Serial |
| `AddDeviceComponent` | (anidado) | Placeholder para registro de dispositivos |
| `SubscriptionComponent` | `/subscription` | Detalle de suscripción: nombre, código, tipo, estado, usuarios |

---

## Device Console

La consola permite comunicarse con dispositivos IoT a través de dos métodos:

### Bluetooth (Web Bluetooth API)
- Conexión inalámbrica con dispositivos BLE
- Utiliza el servicio UUID `0000ffe0-0000-1000-8000-00805f9b34fb`
- Característica TX/RX: `0000ffe1-0000-1000-8000-00805f9b34fb`
- Terminal con temática azul

### Serial (Web Serial API)
- Conexión por cable vía USB/UART a 115200 baudios
- Terminal con temática naranja
- Compatible con flasheo de firmware ESP32

### Terminal interactiva
- Entrada de comandos con envío por Enter o botón
- Auto-scroll configurable
- Codificación por colores: comandos (enviados), errores, info, conexión/desconexión

### Flasheo de firmware (ESP32)
- Usa la librería `esptool-js` para flashear firmware .bin directamente desde el navegador
- Soporta firmware por defecto (`/firmware-iotizzer.bin`) o archivo personalizado
- Address de flasheo configurable (default: `0x10000`)
- Opciones: compresión, borrado completo de flash, reset automático
- Detección de modo download (GPIO0 a GND + RESET)
- Barra de progreso con porcentaje
- Manejo cooperativo del puerto serie (libera/restaura el stream para la terminal)

---

## Servicios

| Servicio | Descripción |
|---|---|
| `AuthService` | Signals de autenticación, gestión de tokens (localStorage), parseo JWT, claims, initSubscription |
| `ApiService` | Canje y refresh de tokens vía `/oauth2/token` con Basic Auth |
| `PlatformService` | Detección de plataforma: native (Capacitor), web, bluetooth, serial |
| `UserControllerService` | CRUD usuarios (generado OpenAPI) |
| `RoleControllerService` | CRUD roles |
| `PermissionControllerService` | CRUD permisos |
| `ClientControllerService` | CRUD clientes OAuth2 |
| `SubscriptionControllerService` | CRUD suscripciones |
| `SubscriptionUsersControllerService` | CRUD usuarios de suscripción |

---

## Clientes generados (OpenAPI)

Se generan dos clientes TypeScript desde specs OpenAPI:

| Cliente | Spec | Servicios generados |
|---|---|---|
| `auth-api` | `http://localhost:9000/api-docs` | User, Role, Permission, Client |
| `subscription-api` | `http://localhost:8082/api-docs` | Subscription, SubscriptionUsers |

### Post-generación

El script `scripts/post-generate.mjs` procesa cada cliente:
1. Copia `api/*.service.ts` → `src/app/services/`
2. Copia `model/*.ts` → `src/app/services/dtos/`
3. Ajusta imports: `../model/X` → `./dtos/X`
4. Limpia `index.ts` (elimina re-exports de api/ y model/)
5. Borra `api/` y `model/` del directorio generado

### Uso

```typescript
// Importar desde services/, NO desde generated/
import { UserControllerService } from '../services/user-controller.service';
import { GetByIdRequestParams } from '../services/user-controller.serviceInterface';
import { AppUserResponseDto } from '../services/dtos/app-user-response-dto';
```

---

## Configuración

```typescript
interface AppEnvironment {
  production: boolean;
  apiUrl: string;                // URL base del authorization server
  authorizeUri?: string;         // Endpoint de autorización OAuth2
  tokenUri?: string;             // Endpoint de tokens
  clientId?: string;             // Identificador del cliente OAuth2
  clientSecret?: string;         // Secreto del cliente
  redirectUri?: string;          // URI de redirección post-login
  scope?: string;                // Scopes solicitados
  responseType?: string;         // response_type (code)
  responseMode?: string;         // response_mode (form_post)
  codeChallengeMethod?: string;  // PKCE (S256)
}
```

| Variable | Desarrollo | Producción |
|---|---|---|
| `apiUrl` | `http://localhost:9000` | `http://192.168.1.41:9000` |
| `redirectUri` | `http://localhost:4201` | `http://192.168.1.41:4201` |

---

## Rutas

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `Home` | Dashboard principal |
| `/devices` | `Devices` | Acciones de dispositivo |
| `/device-console` | `DeviceConsole` | Consola Bluetooth/Serial + flasheo |
| `/subscription` | `SubscriptionComponent` | Detalle de suscripción |
| `**` | — | Redirección a `/` |

Todas las rutas usan **lazy loading** con `loadComponent()`.

---

## Estilos globales

### Fondo animado
- Gradiente pastel animado (`bg-move` 15s ease infinite)
- Capa de orbes radiales con deriva (`orb-drift` 20s)
- Overlay **scanlines** CRT en toda la pantalla

### Keyframes disponibles
- `reveal` — escala + blur + fade-in
- `text-reveal` — letter-spacing + blur + translateY
- `bar-sweep` — barra horizontal animada
- `glow-pulse` — pulso de sombra
- `fade-in` — opacidad + translateY
- `slide-in` — slide desde izquierda

### Clases utilitarias
- `.reveal`, `.text-reveal`, `.bar-sweep`, `.glow-pulse`
- `.delay-1` a `.delay-7` — delays escalonados para animaciones

---

## Scripts

| Script | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo en `:4201` |
| `npm run build` | Build producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run generate:client` | Genera cliente auth-api desde servidor + post-process |
| `npm run generate:client:local` | Genera cliente auth-api desde `spec/openapi.json` |
| `npm run generate:client:subscription` | Genera cliente subscription-api desde servidor + post-process |
| `npm run generate:client:subscription:local` | Genera cliente subscription-api desde `spec/subscription.json` |
| `npm run download:spec` | Descarga spec OpenAPI del auth-server a `spec/openapi.json` |
| `npm run download:spec:subscription` | Descarga spec OpenAPI del subscription-server |

---

## Puesta en marcha

### Requisitos
- Node.js 22+
- npm 11+
- Authorization server en ejecución (`localhost:9000`)
- Cliente OAuth2 registrado con redirect URIs correctos

### Instalación
```bash
npm install
```

### Desarrollo
```bash
npm start          # http://localhost:4201
```

### Mobile (Capacitor Android)
```bash
npm run build
npx cap sync
npx cap open android
```

---

## Notas técnicas

- El interceptor (`auth.interceptor.ts`) salta el Bearer para `/oauth2/token` porque ese endpoint usa Basic Auth
- `AuthService.getUserId()` extrae el `user_id` o `sub` del JWT
- La suscripción se crea automáticamente al iniciar sesión si el usuario no tiene una (BASIC_ACCESS)
- Los servicios generados se copian a `services/` con `providedIn: 'root'` — no requieren módulos adicionales
- `BASE_PATH` se provee desde `environment.apiUrl` en `app.config.ts`
- Los controladores del auth-server deben usar `produces = "application/json"` para que el generador TypeScript devuelva JSON parseado
- `esptool-js` requiere que el ESP32 esté en **download mode** (GPIO0 a GND + RESET)
- El puerto serie se maneja colaborativamente entre `DeviceConsole` y `FlasherComponent`: el flasher adquiere el puerto, libera los streams, y tras terminar emite `doneWithPort` para que la consola restaure la terminal
- `platform.service.ts` permite detectar disponibilidad de Web Bluetooth y Web Serial API
- Los DTOs de ambos clientes comparten el mismo directorio `services/dtos/`

---

## .gitignore

```gitignore
/src/app/generated/auth-api/api/
/src/app/generated/auth-api/model/
/src/app/generated/subscription-api/api/
/src/app/generated/subscription-api/model/
```

Solo `api/` y `model/` están ignorados. El resto de los archivos generados se suben a git para permitir compilar sin regenerar.
