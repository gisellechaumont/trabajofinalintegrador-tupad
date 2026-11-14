# GymFlow 🏋️‍♂️

> **Trabajo Final Integrador (TFI)**
> Tecnicatura Universitaria en Programación a Distancia (TUPaD)

---

## 👥 Integrantes

- **Giselle Chaumont Mohr**
- **Emilia Gómez Juárez**
- **Tutor:** Santiago Fonzo

---

## Resumen del proyecto

GymFlow es una aplicación web tipo SPA (_Single Page Application_) con API REST desacoplada. El sistema permitirá centralizar la administración de usuarios, profesores, paquetes o planes, clases, horarios, inscripciones, cupos y registros de asistencia.

La propuesta ofrece una solución ágil y moderna, accesible desde cualquier navegador web, desarrollada como una aplicación académica sustentada en una necesidad concreta del medio local.

## Stack tecnológico

| Componente                 | Tecnología seleccionada                           |
| -------------------------- | ------------------------------------------------- |
| Frontend (SPA)             | React (JavaScript / CSS / Tailwind o Bootstrap)   |
| Backend (API REST)         | Node.js                                           |
| Base de datos              | Base de datos relacional SQL (MySQL / PostgreSQL) |
| Plataforma Cloud (Hosting) | Vercel (Frontend) / Render (Backend y DB)         |
| Control de versiones       | Git y GitHub                                      |

## Documentación

La documentación completa del proyecto se encuentra en la carpeta [`docs`](docs/).

- [Propuesta del proyecto](docs/propuesta-proyecto.md)
  Planteamiento del problema, justificación, evaluación competitiva, objetivos y roles del sistema.

- [Alcance, arquitectura y viabilidad](docs/alcance-arquitectura-y-viabilidad.md)
  Alcance del MVP, exclusiones, reglas de negocio, stack tecnológico, arquitectura, estructura del repositorio y análisis de viabilidad.

- [Gestión y planificación](docs/gestion-y-planificacion.md)
  Metodología, flujo de trabajo, cronograma, dependencias, distribución de tareas, Trello, riesgos y mitigaciones.

- [Módulos del sistema](docs/modulos.md)
  Catálogo de módulos, responsabilidades, permisos, dependencias y criterios de aceptación.

- [Diseño de base de datos](docs/der_gymflow.png)
  DER con el diseño de base de datos completo.

## Enlaces del proyecto

- [Repositorio oficial](https://github.com/gisellechaumont/trabajofinalintegrador-tupad)
- [Tablero de Trello](https://trello.com/invite/b/6a9b1e2cb8b6fb77d8bf0aa1/ATTId5260eccc0b730825c9f66583a051fa9B8418573/gymflow-tfi)

---

## Estado del Proyecto e Instrucciones de Ejecución

GymFlow es un trabajo integrador desarrollado de forma modular en equipo. El repositorio organiza el alcance funcional en dos bloques de trabajo:

- **Módulo de Administración, Seguridad y Base Compartida:** Arquitectura base del sistema, persistencia relacional con PostgreSQL y Prisma, autenticación JWT/Argon2id, control de acceso por roles, gestión integral de socios, profesores y catálogo de actividades (ARQ-03/04, TEC-03 a TEC-08 y HU-01 a HU-12).
- **Módulo Operativo:** Programación y gestión de clases, cupos, tipos de paquetes y asignaciones, inscripciones y cancelaciones con control de concurrencia, toma de asistencia, historiales y panel de control (HU-13 a HU-32, a cargo de Emilia). Dispone de sus puntos de montaje listos en `operational.routes` tanto en backend como en frontend para su integración desacoplada.

---

### Requisitos previos

- Node.js **22.12 o posterior**
- Docker con Compose (o PostgreSQL instalado localmente)

### Puesta en marcha del entorno local

1. **Instalar dependencias del workspace:**

   ```bash
   npm ci
   ```

2. **Generar configuración de entorno y cliente Prisma:**

   ```bash
   npm run setup
   ```

   _(Genera los archivos `.env` locales con credenciales seguras y compila el cliente tipado de base de datos)._

3. **Iniciar el servicio de base de datos:**

   ```bash
   docker compose up -d db
   ```

   _(Queda mapeado al puerto `55432` local para no generar conflictos con otras instancias de PostgreSQL)._

4. **Aplicar migraciones y datos de prueba (Seed):**

   ```bash
   npm run db:migrate && npm run db:seed
   ```

   _Cuentas de prueba iniciales (la contraseña corresponde al valor `SEED_PASSWORD` en `backend/.env`):_
   - Administrador: `admin@gymflow.test`
   - Profesores: `ana.professor@gymflow.test`, `bruno.professor@gymflow.test`
   - Socios: `juan.member@gymflow.test`, `laura.member@gymflow.test`

5. **Iniciar los servidores de desarrollo:**
   ```bash
   npm run dev
   ```

   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:3000/api/v1 (Chequeo de estado en `/health`)

---

### Verificación y Calidad de Código

Para ejecutar la suite de comprobación completa (análisis de tipos estáticos, compilación de ambos proyectos y ejecución de pruebas):

```bash
npm run verify
```

Comandos individuales:

- Comprobación de tipos TypeScript: `npm run typecheck`
- Pruebas unitarias y de componentes (Vitest): `npm test`
- Pruebas de integración HTTP contra base PostgreSQL real (`gymflow_test`): `npm run test:integration`

