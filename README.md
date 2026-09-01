# GymFlow 🏋️‍♂️

> **Trabajo Final Integrador (TFI)**  
> Tecnicatura Universitaria en Programación a Distancia (TUPaD)

---

## 👥 Integrantes
- **Giselle Chaumont Mohr**
- **Emilia Gómez Juárez**

- **Tutor asignado:** Santiago Fonzo
- **Fecha de entrega propuesta:** 30/08/2026

---

## Repositorio oficial

<https://github.com/gisellechaumont/trabajofinalintegrador-tupad>

## 1. Resumen del proyecto e introducción

GymFlow es una aplicación web tipo SPA (*Single Page Application*) con API REST desacoplada. El sistema permitirá centralizar la administración de usuarios, profesores, paquetes o planes, clases, horarios, inscripciones, cupos y registros de asistencia.

La propuesta ofrece una solución ágil y moderna, accesible desde cualquier navegador web, desarrollada como una aplicación académica sustentada en una necesidad concreta del medio local.

## 2. Planteamiento del problema y justificación

En establecimientos deportivos pequeños, la falta de un sistema centralizado genera diversos inconvenientes operativos:

- Dificultad para mantener actualizada la información de socios y profesores.
- Inscripciones duplicadas o realizadas cuando una clase ya alcanzó su cupo máximo.
- Falta de control riguroso sobre los cupos disponibles en tiempo real.
- Poca visibilidad sobre los planes o paquetes contratados y sus respectivos vencimientos.
- Registros de asistencia incompletos o de difícil consulta para el profesorado y administración.
- Dependencia de una persona específica para responder consultas sobre disponibilidad.
- Pérdida de tiempo en tareas administrativas manuales y repetitivas.

| Actor afectado | Impacto del problema |
| --- | --- |
| Responsable o propietario | Dificultad para obtener una visión general y actualizada sobre clases, cupos, paquetes y asistencias, limitando la toma de decisiones informada. |
| Personal administrativo | Sobrecarga de tareas manuales repetitivas, necesidad de consultar múltiples fuentes y riesgo de registrar datos inconsistentes. |
| Profesor | Posibilidad de recibir listados de inscriptos desactualizados y falta de un registro ágil de asistencia. |
| Socio | Demoras para consultar horarios, dependencia de canales de atención y riesgo de inconsistencia sobre sus créditos o reservas. |

## 3. Objetivos del proyecto

### 3.1. Objetivo general

Desarrollar una aplicación web (Frontend React + Backend Node.js) que permita administrar las actividades principales de un gimnasio, centralizando la información de usuarios, profesores, planes, clases, inscripciones, cupos y asistencias.

### 3.2. Objetivos específicos

- Permitir el acceso al sistema mediante usuarios debidamente autenticados con tokens JWT.
- Diferenciar las funcionalidades disponibles según los roles: Administrador, Profesor y Socio.
- Registrar, modificar, consultar y desactivar socios y profesores.
- Administrar los planes o paquetes de clases ofrecidos por el establecimiento.
- Programar clases indicando actividad, profesor, fecha, horario y cupo máximo permitido.
- Permitir a los socios consultar la disponibilidad de clases e inscribirse o cancelar de forma autónoma desde una interfaz React intuitiva.
- Evitar reservas duplicadas o por encima del cupo asignado a través de validaciones backend robustas.
- Proveer un módulo interactivo para que los profesores registren la presencia o ausencia en sus clases.
- Implementar un panel informativo para la consulta operativa de la administración.
- Desplegar el Frontend y Backend en entornos online accesibles en la nube (Vercel y Render).
- Documentar la arquitectura, API REST, base de datos y funcionamiento general en el repositorio único.

## 4. Usuarios y roles del sistema

| Rol | Responsabilidad | Funciones principales |
| --- | --- | --- |
| Administrador | Gestión general del gimnasio. | Administrar socios, profesores y planes; crear clases; asignar profesores; supervisar cupos, inscripciones y asistencias; acceder al panel general. |
| Profesor | Gestión operativa de sus clases. | Consultar clases asignadas, visualizar lista de inscriptos y registrar presencia o ausencia. |
| Socio | Autogestión de su actividad deportiva. | Consultar estado de su plan, ver clases y cupos disponibles en tiempo real, reservar/cancelar clases y consultar historial. |

## 5. Alcance funcional (MVP) y exclusiones

### 5.1. Módulos incluidos

- **Autenticación y roles:** Inicio/cierre de sesión seguro con tokens JWT y control de rutas privadas en React.
- **Gestión de usuarios:** Altas, modificaciones, activación/desactivación de socios y profesores.
- **Gestión de planes/paquetes:** Creación y asignación manual de paquetes, con fecha de inicio, vencimiento y clases disponibles.
- **Gestión de clases y cupos:** Programación de actividades con fechas, horarios, profesores y límites de cupo con validaciones estrictas en la API backend.
- **Inscripciones y cancelaciones:** Reserva autónoma, liberación automática de cupo ante cancelación y bloqueo por cupo lleno.
- **Control de asistencia:** Registro ágil de presencia/ausencia e historial por socio y clase.
- **Panel informativo administrativo:** Métricas operativas básicas: socios activos, clases llenas y vencimientos próximos.

### 5.2. Exclusiones explícitas del MVP

Para garantizar la viabilidad y calidad en los plazos estipulados, quedan fuera del alcance:

- Procesamiento de pagos online o pasarelas.
- Facturación electrónica.
- Aplicación móvil nativa.
- Integración con molinetes o biometría.
- Rutinas de entrenamiento o planes nutricionales.
- Listas de espera automáticas.
- Reportes contables complejos.

## 6. Reglas de negocio principales

- **RN-01:** Un usuario debe estar activo y autenticado para operar en el sistema.
- **RN-02:** Cada usuario opera estrictamente según los permisos asignados a su rol.
- **RN-03:** Solo el Administrador puede dar de alta usuarios, planes y programar clases.
- **RN-04:** El Profesor solo puede visualizar y registrar asistencia en las clases que tiene asignadas.
- **RN-05:** El Socio únicamente puede consultar y modificar sus propias reservas y estado del paquete.
- **RN-06:** No se permite la inscripción duplicada de un socio en una misma clase.
- **RN-07:** Una clase no puede superar su cupo máximo configurado.
- **RN-08:** Al cancelarse una inscripción válida, el cupo queda inmediatamente liberado.
- **RN-09:** Para realizar una inscripción, el socio debe contar con un paquete activo y clases disponibles.
- **RN-10:** La asistencia sólo puede registrarse para socios debidamente inscriptos en la clase.
- **RN-11:** Todas las validaciones de negocio críticas se ejecutan y resuelven en el backend.

## 7. Stack tecnológico y arquitectura propuesta

Se adopta una arquitectura desacoplada Cliente-Servidor (SPA + API REST), que permite una experiencia de usuario fluida y reactiva en el Frontend (React), mientras el Backend (Node.js) procesa la lógica de negocio y persistencia.

| Componente | Tecnología seleccionada | Descripción / Rol |
| --- | --- | --- |
| Frontend (SPA) | React (JavaScript / CSS / Tailwind o Bootstrap) | Interfaz de usuario modular, interactiva y responsive basada en componentes. |
| Backend (API REST) | Node.js  | Servicio backend para procesamiento de reglas de negocio, endpoints REST y autenticación. |
| Base de datos | Base de datos relacional SQL (MySQL / PostgreSQL) | Persistencia relacional robusta con soporte transaccional y claves foráneas. |
| Plataforma Cloud (Hosting) | Vercel (Frontend) / Render (Backend y DB) | Despliegue online continuo y desacoplado para garantizar alta disponibilidad. |
| Control de versiones | Git y GitHub | Repositorio único y gestión ágil de tareas (Issues / Projects). |

## 8. Organización del trabajo, metodología y comunicación

### 8.1. Metodología de trabajo y gestión de tareas

El equipo implementará un flujo de trabajo ágil basado en la metodología Kanban a través de Trello y/o GitHub Projects.

- **Backlog / Por hacer:** Requerimientos, diseño de interfaces, endpoints de la API y tareas técnicas pendientes.
- **En progreso:** Tareas que se encuentran en desarrollo activo por cada integrante.
- **En revisión / Testing:** Funcionalidades listas para validación cruzada y pruebas de integración.
- **Completado:** Tareas finalizadas, testeadas e integradas a la rama principal.

### 8.2. Flujo de trabajo con control de versiones

- **Rama principal (`main`):** Código estable y versiones entregables o desplegadas.
- **Ramas por funcionalidad (`feature branches`):** Cada integrante desarrollará módulos específicos de forma aislada, integrando el código mediante Pull Requests con revisión previa.

### 8.3. Documentación y estandarización

Toda la documentación técnica, funcional y de entregas residirá dentro de la carpeta `/docs` del repositorio único. También se mantendrá un archivo `README.md` con instrucciones de configuración local, variables de entorno de ejemplo, scripts SQL de inicialización y credenciales de prueba.

### 8.4. Canales de comunicación y seguimiento

- **Seguimiento con el tutor:** Mensajería del campus virtual o Discord y reuniones sincrónicas cada 15 días por Google Meet.
- **Coordinación interna del equipo:** Comunicación diaria y reuniones virtuales cortas para sincronización de tareas y resolución de bloqueos.

## 9. Estructura del repositorio único

```text
gymflow/
├── frontend/
├── backend/
├── database/
├── docs/
├── README.md
└── .gitignore
```

## 10. Plan de trabajo y cronograma de entregas

| Período / Hito | Actividades comprometidas | Entregable asociado |
| --- | --- | --- |
| 10/08 al 30/08 | Definición del problema, alcance y tecnologías (React + Node.js). Creación y estructura del repositorio en GitHub. | 1.ª Entrega Formal |
| 31/08 al 07/09 | Relevamiento detallado de requerimientos, historias de usuario y diseño de prototipos de interfaz en React. | Avance de diseño |
| 08/09 al 27/09 | Diseño del esquema de base de datos relacional (PostgreSQL / Prisma) y definición de módulos de la API. Aprobación con el tutor. | 2.ª Entrega Formal |
| 28/09 al 19/10 | Configuración de entornos, autenticación JWT, desarrollo de pantallas y endpoints para usuarios, profesores, planes y clases. | Sprint de desarrollo 1 |
| 20/10 al 02/11 | Implementación del circuito de inscripciones, control de cupos en tiempo real, cancelaciones y módulo de asistencia. | Sprint de desarrollo 2 |
| 03/11 al 09/11 | Pruebas integrales de integración Frontend-Backend, corrección de bugs y despliegue final en la nube (Vercel / Render). | Despliegue Cloud |
| 10/11 al 14/11 | Elaboración del informe técnico final, actualización del README y grabación del video explicativo. | Entrega Final |

## 11. Viabilidad y conclusión

La elección de una arquitectura desacoplada con React en el Frontend y Node.js en el Backend ofrece un estándar profesional de la industria, garantizando una excelente experiencia interactiva para socios y profesores, con validaciones firmes en el servidor.

La propuesta es completamente viable de ejecutar en los plazos académicos previstos.
