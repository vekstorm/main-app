# Main App — IoT Devices Manager

Aplicación frontend Angular que implementa el flujo **Authorization Code + PKCE + client_secret_basic** contra un servidor OAuth2 / OpenID Connect. Una vez autenticado, obtiene los datos del usuario desde la API REST del servidor de autorización usando el cliente generado con OpenAPI.

---

## Tecnologías

| Tecnología | Versión | Propósito |
|---|---|---|
| **Angular** | 22 | Framework de componentes standalone con signals |
| **TypeScript** | 6.0 | Tipado estático |
| **Bootstrap 5** | 5.3 | Layout responsivo y utilidades CSS |
| **SCSS** | — | Preprocesador CSS con tema oscuro |
| **Capacitor** | 8 | Entorno nativo Android/iOS |
| **Angular HTTP Client** | 22 | Cliente HTTP con interceptores funcionales |
| **Vitest** | 4 | Tests unitarios |
| **RxJS** | 7.8 | Programación reactiva |
| **OpenAPI Generator** | 7.23.0 | Generación automática de clientes TypeScript desde la spec |

---

## Arquitectura

```
src/
├── index.html                         # Entry point HTML
├── main.ts                            # Bootstrap Angular (bootstrapApplication)
├── styles.scss                        # Estilos globales (tema oscuro)
├── app/
│   ├── app.ts                         # Componente raíz (captura código OAuth del callback)
│   ├── app.html                       # Template raíz con router-outlet
│   ├── app.routes.ts                  # Rutas (lazy load Home)
│   ├── app.config.ts                  # Providers globales (BASE_PATH, interceptors)
│   ├── core/
│   │   ├── pkce.ts                    # PKCE: code verifier, challenge, sessionStorage
│   │   ├── auth.interceptor.ts        # Interceptor que añade Bearer token
│   │   └── app-config.token.ts        # InjectionToken APP_CONFIG
│   ├── services/
│   │   ├── auth.service.ts            # Autenticación: login, logout, JWT parse, userId
│   │   ├── api.service.ts             # Solo token exchange + refresh (oauth2/token)
│   │   ├── user-controller.service.ts       # Cliente OpenAPI (copiado en post-generate)
│   │   ├── user-controller.serviceInterface.ts
│   │   ├── role-controller.service.ts
│   │   ├── role-controller.serviceInterface.ts
│   │   ├── permission-controller.service.ts
│   │   ├── permission-controller.serviceInterface.ts
│   │   ├── client-controller.service.ts
│   │   ├── client-controller.serviceInterface.ts
│   │   └── dtos/                      # DTOs tipados (copiados en post-generate)
│   │       ├── app-user-response-dto.ts
│   │       ├── app-user-create-dto.ts
│   │       ├── role-response-dto.ts
│   │       ├── permission-response-dto.ts
│   │       └── ...
│   ├── components/
│   │   ├── menu/                      # Navbar login/logout
│   │   └── home/                      # Dashboard con tarjeta de datos del usuario
│   └── generated/
│       └── auth-api/                  # Generado por OpenAPI (post-generate borra api/ y model/)
│           ├── index.ts               # Barrel export (solo infraestructura)
│           ├── variables.ts           # BASE_PATH injection token
│           ├── configuration.ts       # Configuración del cliente
│           ├── api.base.service.ts    # Clase base de los servicios
│           ├── encoder.ts             # Codificador de parámetros
│           └── query.params.ts        # Parámetros de consulta OpenAPI
└── environments/
    ├── environment.model.ts           # Interfaz AppEnvironment
    ├── environment.ts                 # Config producción
    └── environment.development.ts     # Config desarrollo (file replacement)
```

### Flujo de autenticación

1. El usuario hace clic en **Login** en el `Menu`
2. Se genera un **code verifier** (32 bytes → hex) y su **code challenge** (SHA-256 base64url) en `core/pkce.ts`
3. El code verifier se guarda en `sessionStorage`; el navegador redirige al auth-server con los parámetros OAuth2
4. Tras autenticarse, el servidor redirige con un `code` en la URL
5. El componente raíz `App` captura el código en `ngOnInit` y llama a `AuthService.handleOAuthCallback()`
6. `AuthService` canjea el código por tokens vía `ApiService.exchangeToken()` usando Basic Auth + PKCE
7. El JWT se parsea, se extrae el `userId`, y se persisten los tokens en `localStorage`
8. Un `effect()` en el constructor de `Home` reacciona a `AuthService.isAuthenticatedSignal()`. Cuando es `true`, obtiene el `userId` vía `AuthService.getUserId()` y llama a `UserControllerService.getById()` con el cliente generado. Los datos se muestran en una tarjeta con signals.

### Componentes

| Componente | Ruta | Descripción |
|---|---|---|
| `App` | raíz | Captura el code OAuth del callback, renderiza Menu + RouterOutlet |
| `Menu` | — | Navbar con Login/Logout |
| `Home` | `/` | Dashboard: tarjeta con datos del usuario autenticado (signals) |

### Servicios

| Servicio | Descripción |
|---|---|
| `AuthService` | Signals de autenticación, gestión de tokens, parseo JWT, extracción de userId |
| `ApiService` | Solo canje y refresh de tokens vía `/oauth2/token` |

### Cliente generado (OpenAPI)

| Servicio generado | Endpoint | Uso |
|---|---|---|
| `UserControllerService` | `GET /api/v1/user/{id}` | Obtener datos del usuario autenticado |
| `RoleControllerService` | `/api/v1/role/*` | CRUD de roles |
| `PermissionControllerService` | `/api/v1/permission/*` | CRUD de permisos |
| `ClientControllerService` | `/api/v1/client/*` | CRUD de clientes OAuth2 |

Los servicios se inyectan directamente con `inject()` gracias a `providedIn: 'root'`. Se importan desde `services/` (no desde `generated/`):

```ts
import { UserControllerService } from '../services/user-controller.service';
import { GetByIdRequestParams } from '../services/user-controller.serviceInterface';
import { AppUserResponseDto } from '../services/dtos/app-user-response-dto';
```

El `BASE_PATH` se provee desde `environment.apiUrl` en `app.config.ts`.

---

## Generación del cliente OpenAPI

### Requisitos

- Authorization server corriendo en `localhost:9000`
- Java 21+ (para el generador)

### Flujo de generación

```
npm run generate:client
        ↓
openapi-generator-cli genera todo a src/app/generated/auth-api/
        ↓
npm run postgenerate:client  ← automático (post hook)
        ↓
scripts/post-generate.mjs:
  1. Copia api/*.service.ts y api/*.serviceInterface.ts → src/app/services/
  2. Copia model/*.ts → src/app/services/dtos/
  3. Ajusta imports: ../model/X → ./dtos/X, ../X → ../generated/auth-api/X
  4. Limpia index.ts (elimina re-exports de api/ y model/)
  5. Borra api/ y model/ del generado
```

### Paso a paso

```bash
# 1. Arranca el auth-server en localhost:9000
# 2. Genera el cliente (descarga spec + genera + post-process):
npm run generate:client

# Alternativa: descargar spec y generar offline:
npm run download:spec          # → spec/openapi.json
npm run generate:client:local  # genera + post-process automático
```

### Qué se genera y dónde acaba

| Origen (generated/auth-api/) | Destino | Descripción |
|---|---|---|
| `api/*.service.ts` | `services/` | Servicio inyectable con métodos tipados |
| `api/*.serviceInterface.ts` | `services/` | Interfaz con tipos de los métodos |
| `model/*.ts` | `services/dtos/` | DTOs como interfaces TypeScript |
| `configuration.ts` | _se queda_ | Configuración HTTP del cliente |
| `api.base.service.ts` | _se queda_ | Clase base de los servicios |
| `variables.ts` | _se queda_ | `BASE_PATH` injection token |
| `index.ts` | _se queda_ | Barrel (sin api/model) |
| `api/`, `model/` | _borrados_ | No se suben a git |

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run generate:client` | Genera + post-process desde `openapitools.json` |
| `npm run generate:client:local` | Genera + post-process desde `spec/openapi.json` |
| `npm run download:spec` | Descarga spec a `spec/openapi.json` |
| `npm run build` | Build Angular |
| `npm start` | Servidor de desarrollo (`:4201`) |
| `npm test` | Tests unitarios |

### .gitignore

```gitignore
/src/app/generated/auth-api/api/
/src/app/generated/auth-api/model/
```

Solo `api/` y `model/` están ignorados. El resto (`configuration.ts`, `api.base.service.ts`, `variables.ts`, `index.ts`, etc.) se sube a git para que el proyecto compile al clonar sin necesidad de regenerar.

### En auth-server (alternativa con Maven)

```bash
cd authorization-server
mvn verify -Pgenerate-openapi-spec
# → genera target/openapi.json
```

---

## Cómo añadir un nuevo cliente para otro microservicio

Para consumir la API de cualquier otro microservicio que exponga una spec OpenAPI:

### 1. Asegurar que el controlador Spring especifica `produces`

En el microservicio, los `@RestController` deben tener `produces = "application/json"` en el `@RequestMapping` de clase. Sin esto, la spec OpenAPI genera `*/*` y el cliente TypeScript no parsea la respuesta como JSON (la recibe como `Blob`).

```java
@RestController
@RequestMapping(value = "/api/v1/device", produces = "application/json")
public class DeviceController { ... }
```

### 2. Configurar el generador

Añade una nueva entrada en `generator-cli.generators` dentro de `openapitools.json`:

```json
{
  "generator-cli": {
    "version": "7.23.0",
    "generators": {
      "auth-api": {
        "generatorName": "typescript-angular",
        "inputSpec": "http://localhost:9000/api-docs",
        "output": "src/app/generated/auth-api",
        "additionalProperties": {
          "providedInRoot": "true",
          "fileNaming": "kebab-case",
          "withInterfaces": "true",
          "useSingleRequestParameter": "true",
          "supportsES6": "true"
        }
      },
      "iot-api": {
        "generatorName": "typescript-angular",
        "inputSpec": "http://localhost:8000/api-docs",
        "output": "src/app/generated/iot-api",
        "additionalProperties": {
          "providedInRoot": "true",
          "fileNaming": "kebab-case",
          "withInterfaces": "true",
          "useSingleRequestParameter": "true",
          "supportsES6": "true"
        }
      }
    }
  }
}
```

### 3. Añadir post-generate para el nuevo cliente

Edita `scripts/post-generate.mjs` para que también procese el nuevo directorio:

```javascript
const clients = [
  { name: 'auth-api', generatorKey: 'auth-api' },
  { name: 'iot-api',  generatorKey: 'iot-api' },
];

for (const client of clients) {
  const generated = path.join(root, 'src', 'app', 'generated', client.name);
  const services = path.join(root, 'src', 'app', 'services');
  const dtos = path.join(root, 'src', 'app', 'services', 'dtos');

  // copiar api/* → services/, model/* → services/dtos/
  // ajustar imports, limpiar index.ts, borrar api/ y model/
}
```

### 4. Proveer BASE_PATH

En `app.config.ts`:

```ts
import { BASE_PATH as IOT_BASE_PATH } from './generated/iot-api';

providers: [
  { provide: IOT_BASE_PATH, useValue: 'http://localhost:8000' },
]
```

### 5. Usar en componentes

```ts
import { Component, inject } from '@angular/core';
import { DeviceControllerService } from '../services/device-controller.service';
import { DeviceResponseDto } from '../services/dtos/device-response-dto';

@Component({ ... })
export class DevicesComponent {
  private deviceService = inject(DeviceControllerService);

  loadDevices() {
    this.deviceService.getAll().subscribe(devices => ...);
  }
}
```

Nota: los servicios se importan desde `services/`, NO desde `generated/`.

### 6. Actualizar .gitignore

```gitignore
/src/app/generated/iot-api/api/
/src/app/generated/iot-api/model/
```

### 7. Generar

```bash
openapi-generator-cli generate --generator-key iot-api
# post-generate.mjs procesa automáticamente el nuevo cliente
```

El `auth.interceptor` añadirá automáticamente el Bearer token a todas las peticiones contra URLs que coincidan con `environment.apiUrl`. Para otros dominios, crea interceptores adicionales o configura el token manualmente.

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

---

## Puesta en marcha

### Requisitos

- Node.js 22+
- npm 11+
- Authorization server en ejecución
- Cliente OAuth2 registrado en auth-server con redirect URIs correctos

### Instalación

```bash
cd apps/main-app
npm install
```

### Desarrollo

```bash
ng serve --port 4201
```

### Build

```bash
ng build
```

### Mobile (Capacitor Android)

```bash
npm run build
npx cap sync
npx cap open android
```

---

## Notas técnicas

- El interceptor salta el Bearer para `/oauth2/token` porque ese endpoint usa Basic Auth
- `AuthService.getUserId()` extrae el `user_id` o `sub` del JWT para consultar el perfil
- Los servicios generados se copian a `services/` con `providedIn: 'root'` — no requieren módulos ni providers adicionales
- Se importan desde `services/` y los DTOs desde `services/dtos/` — nunca desde `generated/`
- La carga del usuario en `Home` usa un `effect()` que reacciona a `isAuthenticatedSignal()` — no hace falta recargar la página cuando el token llega tras el callback OAuth
- Las animaciones globales (reveal, bar-sweep, glow-pulse) están en `styles.scss`
- El `basePath` por defecto del generado es `http://localhost:9000`; se sobreescribe vía `BASE_PATH` injection token
- Los controladores del auth-server deben usar `produces = "application/json"` para que el generador TypeScript devuelva JSON parseado en vez de `Blob`
