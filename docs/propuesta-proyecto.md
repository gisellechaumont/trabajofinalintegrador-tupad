# Propuesta del proyecto

## Planteamiento del problema y justificación

En establecimientos deportivos pequeños, la falta de un sistema centralizado genera diversos inconvenientes operativos:

* Dificultad para mantener actualizada la información de socios y profesores.
* Inscripciones duplicadas o realizadas cuando una clase ya alcanzó su cupo máximo.
* Falta de control riguroso sobre los cupos disponibles en tiempo real.
* Poca visibilidad sobre los planes o paquetes contratados y sus respectivos vencimientos.
* Registros de asistencia incompletos o de difícil consulta para el profesorado y administración.
* Dependencia de una persona específica para responder consultas sobre disponibilidad.
* Pérdida de tiempo en tareas administrativas manuales y repetitivas.

| Actor afectado                                                    | Impacto del problema                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Administración del gimnasio** *(dueño y personal de recepción)* | Dificultad para obtener una visión consolidada del negocio, sobrecarga en la atención manual de consultas y riesgo recurrente de registrar datos inconsistentes o cupos duplicados por falta de un sistema centralizado. |
| **Profesor**                                                      | Posibilidad de recibir listados de inscriptos desactualizados, falta de visibilidad en tiempo real sobre los cupos de su clase y ausencia de un mecanismo ágil para registrar asistencias.                               |
| **Socio**                                                         | Demoras para consultar horarios, dependencia constante de la respuesta por mensajería para confirmar turnos e incertidumbre sobre la vigencia de sus paquetes o el estado de sus reservas.                               |

### Evaluación competitiva preliminar

Para determinar el posicionamiento de GymFlow se realizó una comparación preliminar con dos tipos de alternativas: las herramientas manuales utilizadas por establecimientos pequeños y los sistemas comerciales especializados en gestión de gimnasios.

La comparación no busca demostrar que GymFlow supera a las soluciones existentes, sino identificar qué necesidad cubre, cuáles son sus diferencias y qué limitaciones presenta.

| Alternativa                 | Funcionalidades principales                                                                                   | Ventajas                                                                                                  | Limitaciones respecto del público objetivo                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Planillas, papel y WhatsApp | Registro manual de socios, clases, cupos, pagos y asistencias                                                 | Bajo costo inicial, herramientas conocidas y alta flexibilidad informal                                   | Información distribuida, controles manuales, menor trazabilidad y dependencia del personal administrativo                       |
| Midu                        | Reservas, membresías, pagos, facturación ARCA, control de acceso y aplicación para socios                     | Solución adaptada al mercado argentino e integración de procesos administrativos y comerciales            | Incluye funcionalidades que exceden el MVP y requiere contratar e implementar un servicio externo                               |
| Fitco                       | Reservas, membresías, pagos, clases, gestión de equipo, check-in y acceso mediante web o aplicación           | Plataforma integral orientada a estudios y centros deportivos                                             | Su alcance comercial es mayor que el requerido por establecimientos que solo necesitan gestionar clases, paquetes y asistencias |
| Trainingym                  | Reservas, control de capacidad, listas de espera, cancelaciones, notificaciones, informes y control de acceso | Alto nivel de automatización y herramientas para analizar la actividad del establecimiento                | Mayor amplitud funcional, configuración y dependencia de un proveedor comercial                                                 |
| GymFlow                     | Usuarios y roles, paquetes, clases, cupos, inscripciones, cancelaciones y asistencias                         | Alcance acotado, adaptación a las reglas del establecimiento y centralización de los procesos principales | No incluye pagos, facturación, aplicación móvil, notificaciones, listas de espera ni soporte comercial                          |

Midu se presenta como una solución desarrollada para Argentina e incorpora reservas, paquetes, cobros, facturación ARCA, control de acceso y una aplicación para socios ([Midu, s. f.](https://midu.app/)). Fitco permite gestionar reservas, membresías, pagos, clases y equipos, además de ofrecer acceso mediante web y aplicación ([Fitco, s. f.](https://www.fitcolatam.com/)). Trainingym agrega funciones como control de capacidad, listas de espera, notificaciones, cancelaciones e informes de ocupación ([Trainingym, s. f.](https://trainingym.com/reservas)).

Estas plataformas poseen mayor madurez y cobertura funcional que GymFlow. Sin embargo, también incorporan procesos comerciales, administrativos y de infraestructura que quedan fuera del alcance definido para el proyecto, como pagos, facturación, comunicaciones automáticas y controles físicos de acceso.

#### Posicionamiento de GymFlow

El competidor más directo de GymFlow es el proceso manual basado en planillas, registros en papel y mensajería. Frente a esta modalidad, la propuesta centraliza la información, automatiza el control de cupos e inscripciones, valida la vigencia y disponibilidad de los paquetes y brinda acceso diferenciado a administradores, profesores y socios.

Su diferenciación se encuentra en un alcance reducido y adaptable, centrado en la gestión de clases con cupos y sin funcionalidades comerciales que aumentarían la complejidad del MVP. Sin embargo, GymFlow todavía no es un producto comercial ni cuenta con evidencia de adopción, soporte operativo o validación en un establecimiento real. Por ello, su valor frente al proceso manual deberá comprobarse mediante relevamiento y pruebas con usuarios potenciales.

## Objetivos del proyecto

### Objetivo general

Desarrollar una aplicación web (Frontend React + Backend Node.js) que permita administrar las actividades principales de un gimnasio, centralizando la información de usuarios, profesores, planes, clases, inscripciones, cupos y asistencias.

### Objetivos específicos

* **OE-01 (Integridad operativa):** Reducir a 0% los casos de sobrecupo e inscripciones duplicadas mediante validaciones concurrentes y atómicas en el backend.
* **OE-02 (Eficiencia administrativa):** Disminuir en un estimado del 70% el tiempo invertido por la administración en la coordinación manual de reservas, consultas de disponibilidad y asignación de turnos.
* **OE-03 (Autonomía del usuario):** Lograr que al menos el 80% de las reservas y cancelaciones de clases sean autogestionadas directamente por los socios a través de la interfaz web.
* **OE-04 (Trazabilidad y control):** Garantizar el 100% de visibilidad y control sobre el estado, vencimiento y consumo de clases de los paquetes contratados por cada socio activo.
* **OE-05 (Confiabilidad en presentismo):** Asegurar el registro digital y centralizado del presentismo al finalizar cada clase, eliminando discrepancias originadas por planillas desconectadas o registros en papel.
* **OE-06 (Calidad y entrega):** Desarrollar, desplegar en la nube (Vercel / Render) y validar un MVP funcional cubriendo el ciclo operativo completo dentro del plazo estipulado por la cátedra.

## Usuarios y roles del sistema

| Rol           | Responsabilidad                        | Funciones principales                                                                                                                               |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador | Gestión general del gimnasio.          | Administrar socios, profesores y planes; crear clases; asignar profesores; supervisar cupos, inscripciones y asistencias; acceder al panel general. |
| Profesor      | Gestión operativa de sus clases.       | Consultar clases asignadas, visualizar lista de inscriptos y registrar presencia o ausencia.                                                        |
| Socio         | Autogestión de su actividad deportiva. | Consultar estado de su plan, ver clases y cupos disponibles en tiempo real, reservar/cancelar clases y consultar historial.                         |
