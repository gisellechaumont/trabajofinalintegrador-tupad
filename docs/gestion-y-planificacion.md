# Gestión y planificación

## Organización del trabajo, metodología y comunicación

### Metodología de trabajo y gestión de tareas

El equipo implementará un flujo de trabajo ágil basado en la metodología Kanban a través de Trello y/o GitHub Projects.

* **Backlog / Por hacer:** Requerimientos, diseño de interfaces, endpoints de la API y tareas técnicas pendientes.
* **En progreso:** Tareas que se encuentran en desarrollo activo por cada integrante.
* **En revisión / Testing:** Funcionalidades listas para validación cruzada y pruebas de integración.
* **Completado:** Tareas finalizadas, testeadas e integradas a la rama principal.

### Flujo de trabajo con control de versiones

* **Rama principal (`main`):** Código estable y versiones entregables o desplegadas.
* **Ramas por funcionalidad (`feature branches`):** Cada integrante desarrollará módulos específicos de forma aislada, integrando el código mediante Pull Requests con revisión previa.

### Documentación y estandarización

Toda la documentación técnica, funcional y de entregas residirá dentro de la carpeta `/docs` del repositorio único. También se mantendrá un archivo `README.md` con instrucciones de configuración local, variables de entorno de ejemplo, scripts SQL de inicialización y credenciales de prueba.

### Canales de comunicación y seguimiento

* **Seguimiento con el tutor:** Mensajería del campus virtual o Discord y reuniones sincrónicas cada 15 días por Google Meet.
* **Coordinación interna del equipo:** Comunicación diaria y reuniones virtuales cortas para sincronización de tareas y resolución de bloqueos.

## Plan de trabajo y cronograma de entregas

| Período / Hito | Actividades comprometidas                                                                                                        | Entregable asociado    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 10/08 al 30/08 | Definición del problema, alcance y tecnologías (React + Node.js). Creación y estructura del repositorio en GitHub.               | 1.ª Entrega Formal     |
| 31/08 al 07/09 | Relevamiento detallado de requerimientos, historias de usuario y diseño de prototipos de interfaz en React.                      | Avance de diseño       |
| 08/09 al 27/09 | Diseño del esquema de base de datos relacional (PostgreSQL / Prisma) y definición de módulos de la API. Aprobación con el tutor. | 2.ª Entrega Formal     |
| 28/09 al 19/10 | Configuración de entornos, autenticación JWT, desarrollo de pantallas y endpoints para usuarios, profesores, planes y clases.    | Sprint de desarrollo 1 |
| 20/10 al 02/11 | Implementación del circuito de inscripciones, control de cupos en tiempo real, cancelaciones y módulo de asistencia.             | Sprint de desarrollo 2 |
| 03/11 al 09/11 | Pruebas integrales de integración Frontend-Backend, corrección de bugs y despliegue final en la nube (Vercel / Render).          | Despliegue Cloud       |
| 10/11 al 14/11 | Elaboración del informe técnico final, actualización del README y grabación del video explicativo.                               | Entrega Final          |

## Cronograma detallado

El período comprendido entre el 10/08 y el 30/08 correspondió a la definición inicial del problema, el alcance, el stack tecnológico y la creación del repositorio. La planificación siguiente abarca desde el 31/08 hasta la entrega final del 14/11.

Se estima una dedicación promedio de seis horas semanales por integrante. Las horas indicadas incluyen análisis, implementación, pruebas, revisión y corrección.

### Dependencias generales

Los módulos de usuarios, actividades y paquetes podrán desarrollarse parcialmente en paralelo después de implementar la autenticación. Las inscripciones requieren que usuarios, clases y paquetes estén disponibles. Las asistencias dependen de las clases y de las inscripciones. El despliegue final se realizará después de completar las pruebas integrales.

### Cronograma de tareas

En la distribución se utiliza:

* **R:** responsable principal.
* **C:** colaboración o revisión.
* **Conjunta:** responsabilidad compartida.

| ID  | Período     | Tarea concreta                                                                |                     Emilia |                        Giselle | Complejidad | Depende de              |
| --- | ----------- | ----------------------------------------------------------------------------- | -------------------------: | -----------------------------: | ----------- | ----------------------- |
| T01 | 31/08–07/09 | Refinar historias de usuario y criterios de aceptación                        |              3 h, conjunta |                  3 h, conjunta | Media       | —                       |
| T02 | 31/08–07/09 | Diseñar flujos y wireframes por rol                                           | 2 h, R socio/autenticación | 2 h, R administración/profesor | Media       | T01                     |
| T03 | 31/08–07/09 | Priorizar el backlog y definir entregables del MVP                            |              1 h, conjunta |                  1 h, conjunta | Baja        | T01                     |
| T04 | 08/09–14/09 | Definir entidades, relaciones y modelo de datos                               |              3 h, conjunta |                  3 h, conjunta | Alta        | T01                     |
| T05 | 08/09–14/09 | Crear esquema inicial de PostgreSQL y Prisma                                  |                     1 h, C |                         2 h, R | Alta        | T04                     |
| T06 | 08/09–14/09 | Definir endpoints, respuestas y errores de la API                             |                     2 h, R |                         1 h, C | Alta        | T01, T04                |
| T07 | 15/09–21/09 | Crear proyectos base y configurar entornos locales                            |            3 h, R frontend |                 3 h, R backend | Alta        | T04, T06                |
| T08 | 15/09–21/09 | Implementar inicio de sesión y generación de JWT                              |                     2 h, R |                         1 h, C | Alta        | T05, T07                |
| T09 | 15/09–21/09 | Crear pantalla de acceso y gestión del token                                  |                     1 h, C |                         2 h, R | Alta        | T07, T08                |
| T10 | 22/09–27/09 | Implementar permisos backend y rutas protegidas por rol                       |                     3 h, R |                         1 h, C | Alta        | T08, T09                |
| T11 | 22/09–27/09 | Crear API para altas, consultas, modificaciones y desactivaciones de usuarios |                     2 h, R |                         2 h, C | Alta        | T05, T10                |
| T12 | 22/09–27/09 | Crear interfaces de administración de socios y profesores                     |                     1 h, C |                         3 h, R | Media       | T11                     |
| T13 | 28/09–04/10 | Crear API para administrar actividades                                        |                     1 h, C |                         2 h, R | Media       | T05, T10                |
| T14 | 28/09–04/10 | Crear interfaz para administrar actividades                                   |                     1 h, R |                         1 h, C | Media       | T13                     |
| T15 | 28/09–04/10 | Crear API para programar, modificar y cancelar clases                         |                     2 h, C |                         2 h, R | Alta        | T11, T13                |
| T16 | 28/09–04/10 | Crear interfaz y calendario básico de clases                                  |                     2 h, R |                         1 h, C | Media       | T15                     |
| T17 | 05/10–11/10 | Crear API para tipos de paquetes, asignación, vigencia y saldo                |                     1 h, C |                         3 h, R | Alta        | T05, T10                |
| T18 | 05/10–11/10 | Crear interfaces para administrar y consultar paquetes                        |                     2 h, R |                         1 h, C | Media       | T17                     |
| T19 | 05/10–11/10 | Validar profesor asignado y cupo máximo de cada clase                         |                     2 h, R |                         1 h, C | Alta        | T11, T15                |
| T20 | 05/10–11/10 | Probar la integración entre clases y paquetes                                 |              1 h, conjunta |                  1 h, conjunta | Alta        | T16, T17, T18, T19      |
| T21 | 12/10–19/10 | Implementar inscripción con validación de cupo, duplicación y paquete         |                     2 h, C |                         3 h, R | Alta        | T11, T17, T19           |
| T22 | 12/10–19/10 | Crear interfaz de disponibilidad e inscripción del socio                      |                     2 h, R |                         1 h, C | Alta        | T21                     |
| T23 | 12/10–19/10 | Implementar cancelación y liberación del cupo                                 |                     1 h, C |                         1 h, R | Alta        | T21, T22                |
| T24 | 12/10–19/10 | Probar inscripciones, rechazos y cancelaciones                                |              1 h, conjunta |                  1 h, conjunta | Alta        | T21, T23                |
| T25 | 20/10–26/10 | Crear API para registrar asistencias e inasistencias                          |                     3 h, R |                         1 h, C | Alta        | T15, T21                |
| T26 | 20/10–26/10 | Crear lista de inscriptos e interfaz de asistencia del profesor               |                     2 h, R |                         2 h, C | Alta        | T12, T25                |
| T27 | 20/10–26/10 | Probar permisos y registros de asistencia                                     |                     1 h, C |                         3 h, R | Alta        | T10, T25, T26           |
| T28 | 27/10–02/11 | Implementar historiales básicos por socio y clase                             |                     2 h, R |                         1 h, C | Media-alta  | T21, T25                |
| T29 | 27/10–02/11 | Implementar consultas básicas del panel administrativo                        |                     1 h, C |                         2 h, R | Media       | T12, T16, T18, T28      |
| T30 | 27/10–02/11 | Integrar y probar el circuito completo del sistema                            |              3 h, conjunta |                  3 h, conjunta | Alta        | T20, T24, T27, T28, T29 |
| T31 | 03/11–09/11 | Ejecutar pruebas críticas y corregir errores                                  |                     3 h, R |                         2 h, C | Alta        | T30                     |
| T32 | 03/11–09/11 | Configurar y desplegar el frontend                                            |                     2 h, R |                              — | Media       | T31                     |
| T33 | 03/11–09/11 | Configurar y desplegar el backend y la base de datos                          |                          — |                         3 h, R | Alta        | T31                     |
| T34 | 03/11–09/11 | Ejecutar pruebas de humo y documentar ejecución local alternativa             |              1 h, conjunta |                  1 h, conjunta | Alta        | T32, T33                |
| T35 | 10/11–14/11 | Actualizar README y documentación de la API                                   |                     3 h, R |                         1 h, C | Media       | T31, T34                |
| T36 | 10/11–14/11 | Documentar arquitectura, base de datos y despliegue                           |                     1 h, C |                         3 h, R | Media       | T34                     |
| T37 | 10/11–14/11 | Preparar datos de prueba y guion de demostración                              |              1 h, conjunta |                  1 h, conjunta | Media       | T34                     |
| T38 | 10/11–14/11 | Grabar el video y realizar la revisión final                                  |              1 h, conjunta |                  1 h, conjunta | Media       | T35, T36, T37           |

### Distribución de carga

| Etapa                                    |   Emilia |  Giselle |
| ---------------------------------------- | -------: | -------: |
| Análisis y planificación                 |      6 h |      6 h |
| Diseño técnico y configuración           |     18 h |     18 h |
| Desarrollo de módulos principales        |     18 h |     18 h |
| Inscripciones, asistencias e integración |     12 h |     12 h |
| Pruebas y despliegue                     |      6 h |      6 h |
| Documentación y presentación             |      6 h |      6 h |
| **Total**                                | **66 h** | **66 h** |

Emilia tiene asignadas aproximadamente 42 horas de tareas de complejidad alta y Giselle 43 horas. La diferencia restante corresponde a tareas de complejidad media o baja. De esta manera, la carga total y la dificultad técnica se distribuyen de forma equivalente.

La mayor experiencia técnica de Giselle se aprovechará en la configuración de la base de datos, las inscripciones y el despliegue. Emilia será responsable de autenticación, permisos, usuarios y asistencias, con participación de Giselle en las revisiones. Ambas trabajarán tanto en frontend como en backend.

### Flujo de trabajo para cada tarea

1. La tarea comienza cuando sus dependencias están terminadas e integradas en `main`.
2. La responsable actualiza `main` y crea una rama con el identificador de la tarea, por ejemplo: `feature/T21-inscripciones`.
3. La implementación se divide en commits específicos.
4. La colaboradora revisa el código y ejecuta las pruebas correspondientes.
5. Se abre un pull request y se corrigen las observaciones.
6. La tarea se integra a `main`.
7. Las tareas dependientes quedan habilitadas para comenzar.

Al finalizar cada semana, ambas integrantes revisarán las horas utilizadas, las tareas completadas y los bloqueos. Si una tarea se atrasa, se actualizará su estimación antes de iniciar una funcionalidad que dependa de ella.

## Tablero de Trello

[GymFlow — TFI](https://trello.com/invite/b/6a9b1e2cb8b6fb77d8bf0aa1/ATTId5260eccc0b730825c9f66583a051fa9B8418573/gymflow-tfi)

## Riesgos y mitigaciones

Se identifican los principales eventos que podrían afectar el alcance, los plazos o la calidad de GymFlow. Para cada riesgo se establece una medida preventiva y una respuesta de contingencia.

| Código | Riesgo                                                                                      | Probabilidad | Impacto | Mitigación                                                                                        | Contingencia                                                                            |
| ------ | ------------------------------------------------------------------------------------------- | -----------: | ------: | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R-01   | Atraso del cronograma                                                                       |        Media |    Alto | Dividir el trabajo en tareas pequeñas, estimar horas y controlar semanalmente el avance           | Congelar nuevas incorporaciones y reducir funciones secundarias según el orden definido |
| R-02   | Requerimientos incorrectos por falta de conocimiento del funcionamiento real de un gimnasio |         Alta |    Alto | Realizar entrevistas y validar tempranamente paquetes, cancelaciones, cupos y asistencias         | Documentar los supuestos y aplicar reglas provisionales configurables                   |
| R-03   | Dificultades técnicas en la integración entre frontend, backend y base de datos             |        Media |    Alto | Construir anticipadamente un flujo completo mínimo y realizar pruebas de integración progresivas  | Priorizar el circuito principal y simplificar componentes no esenciales                 |
| R-04   | Conflictos o pérdida de trazabilidad en GitHub                                              |        Media |   Medio | Utilizar ramas por tarea, commits específicos, pull requests y revisión cruzada                   | Detener la integración, resolver los conflictos en una rama separada y volver a probar  |
| R-05   | Fallas en los servicios de despliegue                                                       |        Media |    Alto | Desplegar versiones preliminares y mantener documentada la ejecución local                        | Presentar la aplicación localmente o migrar al proveedor alternativo evaluado           |
| R-06   | Incorporación de funcionalidades fuera del MVP                                              |        Media |    Alto | Registrar nuevas propuestas en un backlog y evaluar su impacto antes de aprobarlas                | Rechazar o postergar toda función que comprometa las tareas prioritarias                |
| R-07   | Errores de seguridad o integridad de datos                                                  |        Media |    Alto | Aplicar autorización por roles, validaciones backend, restricciones en la base de datos y pruebas | Deshabilitar temporalmente la operación afectada y corregirla antes del despliegue      |

### Caso trabajado: atraso del cronograma

El riesgo R-01 se considerará materializado si, al finalizar el primer sprint de desarrollo, no se encuentra integrado el flujo principal o permanece pendiente más del 20 % de las tareas planificadas para esa etapa.

Ante esta situación se aplicará el siguiente plan:

1. Suspender la incorporación de nuevas funcionalidades.
2. Reestimar las tareas pendientes y redistribuirlas entre las integrantes.
3. Recortar primero el panel de métricas administrativas, manteniendo únicamente las consultas básicas.
4. Si el atraso continúa, simplificar los historiales a listados básicos, sin filtros ni indicadores adicionales.
5. Actualizar el cronograma y comunicar el ajuste al tutor.

No se recortarán las funciones necesarias para el circuito central: autenticación y roles, gestión de usuarios, clases y paquetes, control de cupos, inscripciones, cancelaciones y asistencias. Tampoco se eliminarán las validaciones backend, las medidas de seguridad, la integridad de los datos ni las pruebas de los procesos críticos.
