# Módulos del sistema

## 1. Propósito

Este documento presenta el catálogo de módulos previstos para el desarrollo de GymFlow. Para cada módulo se establecen su propósito, responsabilidades, actores, entidades relacionadas, dependencias y criterio mínimo de aceptación.

La propuesta se encuentra sujeta a la revisión y aprobación explícita del tutor y, posteriormente, del comité de trabajo final.

## 2. Catálogo general de módulos

| Código | Módulo                        | Responsabilidad principal                                                   | Actores                                        |
| ------ | ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| MOD-01 | Autenticación y autorización  | Identificar usuarios y controlar el acceso según rol y propiedad            | Administrador, profesor y socio                |
| MOD-02 | Usuarios                      | Administrar cuentas, roles, estados y perfiles                              | Administrador, profesor y socio                |
| MOD-03 | Actividades                   | Administrar el catálogo de disciplinas del gimnasio                         | Administrador; consulta de profesores y socios |
| MOD-04 | Clases y cupos                | Programar clases, asignar profesores y controlar capacidad y estado         | Administrador, profesor y socio                |
| MOD-05 | Planes y paquetes             | Administrar tipos de paquetes, asignaciones, vigencia y créditos            | Administrador y socio                          |
| MOD-06 | Inscripciones y cancelaciones | Gestionar reservas, cancelaciones, cupos y consumo o devolución de créditos | Administrador y socio                          |
| MOD-07 | Asistencias                   | Consultar inscriptos y registrar presencia o ausencia                       | Administrador y profesor                       |
| MOD-08 | Panel administrativo          | Presentar indicadores operativos básicos                                    | Administrador                                  |

Los módulos MOD-01 a MOD-07 forman parte del circuito principal del MVP. El panel administrativo es un módulo secundario y constituye el primer componente recortable si el cronograma se atrasa.

## 3. Descripción de los módulos

### MOD-01 — Autenticación y autorización

#### Propósito

Permitir que los usuarios activos ingresen de forma segura a GymFlow y garantizar que cada operación se realice de acuerdo con la identidad, el rol y la relación del usuario con el recurso solicitado.

#### Actores

* Administrador.
* Profesor.
* Socio.

#### Entidades relacionadas

* `users`.

#### Responsabilidades

* Recibir y validar las credenciales de acceso.
* Buscar al usuario por correo electrónico.
* Verificar la contraseña almacenada mediante hash.
* Impedir el acceso de usuarios inactivos.
* Generar y verificar tokens JWT.
* Identificar al usuario autenticado.
* Proteger las rutas privadas.
* Verificar los roles autorizados para cada operación.
* Proporcionar el contexto de identidad necesario para controlar la propiedad de los recursos.
* Permitir el cierre de sesión desde el frontend.
* Devolver errores sin exponer información sensible.

#### Operaciones principales

* Iniciar sesión.
* Consultar la sesión actual.
* Cerrar sesión.
* Validar la identidad del usuario.
* Validar los roles permitidos.

#### Dependencias

* Modelo de usuarios disponible.
* Datos básicos de usuarios, roles y estados definidos.

#### Criterio mínimo de aceptación

* Un usuario activo con credenciales válidas puede iniciar sesión.
* Un usuario inactivo no puede iniciar sesión.
* Ante credenciales incorrectas, el sistema informa que el correo o la contraseña no son válidos sin revelar cuál de los datos falló.
* Una ruta privada rechaza peticiones sin un token válido.
* Una operación rechaza a usuarios autenticados que no poseen el rol o la relación requerida.
* Los permisos se comprueban siempre en el backend.

#### Exclusiones

* Registro público de usuarios.
* Inicio de sesión con proveedores externos.
* Autenticación de doble factor.
* Recuperación automática de contraseña por correo.
* Administración de múltiples dispositivos.
* Revocación centralizada de tokens.

---

### MOD-02 — Usuarios

#### Propósito

Administrar las cuentas de administradores, profesores y socios, conservando su identificación, rol y estado de acceso.

#### Actores

* Administrador.
* Profesor.
* Socio.

#### Entidades relacionadas

* `users`.

#### Responsabilidades

* Registrar usuarios.
* Consultar usuarios.
* Modificar datos personales.
* Asignar el rol correspondiente.
* Activar o desactivar cuentas.
* Consultar el perfil propio.
* Restringir la gestión general de cuentas al administrador.
* Conservar el historial asociado a usuarios desactivados.

#### Operaciones principales

* Crear un usuario.
* Listar usuarios.
* Consultar un usuario.
* Actualizar sus datos.
* Activar o desactivar una cuenta.
* Consultar el perfil del usuario autenticado.

#### Dependencias

* MOD-01 — Autenticación y autorización.

#### Criterio mínimo de aceptación

* Solo el administrador puede crear, modificar, activar o desactivar usuarios.
* No pueden existir dos usuarios con el mismo correo electrónico.
* El correo electrónico se almacena normalizado.
* Cada usuario puede consultar únicamente el perfil permitido.
* Un usuario desactivado conserva sus inscripciones, paquetes y asistencias históricas.
* La contraseña nunca se almacena en texto plano.

#### Exclusiones

* Eliminación física de usuarios con historial.
* Registro autónomo de socios.
* Administración de roles personalizados.
* Fotografía de perfil.

---

### MOD-03 — Actividades

#### Propósito

Administrar el catálogo de disciplinas ofrecidas por el gimnasio, como yoga, pilates o entrenamiento funcional.

#### Actores

* Administrador.
* Profesor.
* Socio.

#### Entidades relacionadas

* `activities`.

#### Responsabilidades

* Crear actividades.
* Consultar el catálogo.
* Modificar nombre y descripción.
* Activar o desactivar actividades.
* Evitar nombres duplicados.
* Proporcionar las actividades disponibles al módulo de clases.

#### Operaciones principales

* Crear una actividad.
* Listar actividades.
* Consultar una actividad.
* Modificar una actividad.
* Activar o desactivar una actividad.

#### Dependencias

* MOD-01 — Autenticación y autorización.

#### Criterio mínimo de aceptación

* Solo el administrador puede crear, modificar o desactivar actividades.
* No pueden existir actividades con el mismo nombre.
* Una actividad inactiva no puede utilizarse para programar nuevas clases.
* Profesores y socios pueden consultar las actividades activas.

#### Exclusiones

* Categorías o subcategorías de actividades.
* Imágenes promocionales.
* Niveles de dificultad.
* Equipamiento requerido.

---

### MOD-04 — Clases y cupos

#### Propósito

Gestionar la programación de clases, la actividad dictada, el profesor asignado, el horario, la capacidad y el estado operativo.

#### Actores

* Administrador.
* Profesor.
* Socio.

#### Entidades relacionadas

* `classes`;
* `activities`;
* `users`;
* `enrollments`.

#### Responsabilidades

* Programar clases.
* Asignar una actividad.
* Asignar un profesor activo.
* Establecer fecha y horario.
* Definir la capacidad máxima.
* Modificar una clase programada.
* Cancelar una clase.
* Consultar clases disponibles.
* Mostrar los cupos ocupados y disponibles.
* Impedir inscripciones en clases canceladas.
* Devolver los créditos correspondientes cuando el gimnasio cancela una clase.

El cupo disponible será un valor derivado de la capacidad configurada y de la cantidad de inscripciones confirmadas. No se almacenará como un campo independiente.

#### Operaciones principales

* Crear una clase.
* Listar clases.
* Consultar una clase.
* Modificar una clase.
* Cancelar una clase.
* Consultar clases asignadas a un profesor.
* Consultar clases disponibles para socios.
* Calcular cupos disponibles.

#### Dependencias

* MOD-01 — Autenticación y autorización.
* MOD-02 — Usuarios.
* MOD-03 — Actividades.
* Integración con MOD-06 — Inscripciones y cancelaciones para calcular la ocupación y procesar la devolución de créditos cuando se cancela una clase.

#### Criterio mínimo de aceptación

* Solo el administrador puede programar, modificar o cancelar clases.
* La actividad seleccionada debe estar activa.
* El profesor asignado debe existir, estar activo y tener rol de profesor.
* La fecha de finalización debe ser posterior a la fecha de inicio.
* La capacidad debe ser mayor que cero.
* Una clase cancelada no admite nuevas inscripciones.
* La cantidad de inscripciones confirmadas nunca puede superar el cupo máximo.
* El profesor puede consultar únicamente las clases que tiene asignadas.
* El socio puede consultar las clases publicadas y sus cupos disponibles.
* Si el gimnasio cancela una clase, se devuelven los créditos descontados por las inscripciones confirmadas.

#### Exclusiones

* Horarios recurrentes automáticos.
* Lista de espera.
* Asignación de varios profesores a una misma clase.
* Reserva de espacios o equipamiento.

---

### MOD-05 — Planes y paquetes

#### Propósito

Administrar los tipos de paquetes ofrecidos por el gimnasio y las asignaciones concretas realizadas a cada socio, incluyendo vigencia y créditos disponibles.

#### Actores

* Administrador.
* Socio.

#### Entidades relacionadas

* `package_types`;
* `member_packages`;
* `users`.

#### Responsabilidades

* Crear tipos de paquetes.
* Definir cantidad de clases y duración.
* Modificar o desactivar tipos de paquetes.
* Asignar un paquete a un socio.
* Calcular fechas de inicio y vencimiento.
* Registrar y consultar créditos disponibles.
* Permitir que un socio posea varios paquetes activos.
* Determinar el estado del paquete.
* Identificar paquetes próximos a vencer.
* Mostrar al socio únicamente sus propios paquetes.

Se considera próximo a vencer un paquete al que le queda una semana para utilizar sus créditos o clases restantes.

#### Operaciones principales

* Crear un tipo de paquete.
* Listar tipos de paquetes.
* Modificar o desactivar un tipo.
* Asignar un paquete a un socio.
* Consultar los paquetes de un socio.
* Consultar créditos y vigencia.
* Consultar paquetes próximos a vencer.

#### Dependencias

* MOD-01 — Autenticación y autorización.
* MOD-02 — Usuarios.

#### Criterio mínimo de aceptación

* Solo el administrador puede crear tipos de paquetes o asignarlos.
* El socio al que se asigna el paquete debe existir, estar activo y tener rol de socio.
* La cantidad inicial de créditos debe ser mayor que cero.
* La fecha de vencimiento debe ser posterior a la fecha de inicio.
* El saldo nunca puede ser negativo.
* Un socio puede tener varios paquetes activos.
* Un socio puede consultar únicamente sus propios paquetes.
* Los paquetes próximos a vencer se identifican considerando el período de una semana definido.

#### Exclusiones

* Pagos en línea.
* Facturación.
* Renovación automática.
* Promociones y descuentos.
* Congelamiento temporal de paquetes.

---

### MOD-06 — Inscripciones y cancelaciones

#### Propósito

Gestionar la reserva y cancelación de clases, asegurando la integridad de los cupos y de los créditos de los paquetes.

#### Actores

* Administrador.
* Socio.

#### Entidades relacionadas

* `enrollments`;
* `classes`;
* `member_packages`;
* `users`.

#### Responsabilidades

* Registrar una inscripción.
* Comprobar que la clase está programada.
* Comprobar que existe un cupo disponible.
* Evitar inscripciones duplicadas.
* Comprobar que el socio posee un paquete activo, vigente y con créditos.
* Asociar la inscripción con el paquete utilizado.
* Descontar un crédito al confirmar la inscripción.
* Cancelar una inscripción.
* Liberar el cupo.
* Devolver el crédito cuando la cancelación se realiza con al menos dos horas de anticipación.
* Evitar la devolución del crédito cuando la cancelación es tardía o el socio se ausenta.
* Permitir la gestión administrativa de inscripciones.
* Mantener el historial de reservas y cancelaciones.

La inscripción y el descuento del crédito deben realizarse dentro de una misma transacción. Del mismo modo, una cancelación válida y la devolución del crédito deben confirmarse juntas.

#### Operaciones principales

* Consultar clases disponibles.
* Inscribirse en una clase.
* Cancelar una inscripción.
* Consultar las inscripciones propias.
* Consultar el historial.
* Gestionar una inscripción desde administración.

#### Dependencias

* MOD-01 — Autenticación y autorización.
* MOD-02 — Usuarios.
* MOD-04 — Clases y cupos.
* MOD-05 — Planes y paquetes.

#### Criterio mínimo de aceptación

* Un socio no puede inscribirse dos veces en la misma clase.
* Una clase no puede superar su capacidad máxima.
* Una clase cancelada no admite inscripciones.
* La inscripción exige un paquete activo, vigente y con al menos un crédito.
* Se descuenta exactamente un crédito cuando la inscripción queda confirmada.
* La inscripción registra qué paquete fue utilizado.
* Si la operación falla, no se conserva la inscripción ni se descuenta el crédito.
* Una cancelación realizada con al menos dos horas de anticipación libera el cupo y devuelve el crédito.
* Una cancelación tardía libera el cupo, pero no devuelve el crédito.
* La ausencia del socio no devuelve el crédito.
* La repetición de una solicitud de cancelación no produce una segunda devolución.
* El socio solo puede gestionar sus propias inscripciones.

#### Exclusiones

* Lista de espera.
* Inscripciones grupales.
* Transferencia de reservas entre socios.
* Notificaciones automáticas.
* Reservas recurrentes.

---

### MOD-07 — Asistencias

#### Propósito

Permitir que el profesor asignado o el administrador registre la presencia o ausencia de los socios inscriptos en una clase.

#### Actores

* Administrador.
* Profesor.

#### Entidades relacionadas

* `attendance`;
* `enrollments`;
* `classes`;
* `users`.

#### Responsabilidades

* Consultar la lista de inscriptos de una clase.
* Registrar presencia o ausencia.
* Identificar quién realizó el registro.
* Registrar la fecha y hora del presentismo.
* Impedir más de un registro de asistencia por inscripción.
* Limitar al profesor a sus clases asignadas.
* Permitir la consulta de historiales.
* Mantener el registro aun cuando un usuario sea desactivado.

#### Operaciones principales

* Consultar la lista de inscriptos.
* Registrar asistencia.
* Modificar el presentismo cuando corresponda.
* Consultar asistencias por clase.
* Consultar historial por socio.

#### Dependencias

* MOD-01 — Autenticación y autorización.
* MOD-02 — Usuarios.
* MOD-04 — Clases y cupos.
* MOD-06 — Inscripciones y cancelaciones.

#### Criterio mínimo de aceptación

* La asistencia solo puede registrarse sobre una inscripción confirmada.
* Solo el administrador o el profesor asignado a la clase puede registrar el presentismo.
* Existe como máximo un registro de asistencia por inscripción.
* El sistema identifica quién registró la asistencia y cuándo.
* Una ausencia no devuelve el crédito consumido.
* El socio puede consultar su propio historial, pero no modificarlo.

#### Exclusiones

* Registro biométrico.
* Control mediante molinetes.
* Código QR.
* Registro de ingreso al establecimiento.
* Justificación documental de ausencias.

---

### MOD-08 — Panel administrativo

#### Propósito

Proporcionar al administrador una vista consolidada de indicadores operativos básicos obtenidos de los módulos principales.

#### Actores

* Administrador.

#### Entidades relacionadas

El módulo utiliza consultas agregadas sobre:

* `users`;
* `classes`;
* `member_packages`;
* `enrollments`;
* `attendance`.

#### Responsabilidades

* Mostrar cantidad de socios activos.
* Identificar clases que alcanzaron su cupo.
* Mostrar paquetes próximos a vencer.
* Proporcionar accesos directos a las gestiones principales.
* Presentar información operativa sin modificar las reglas de los módulos de origen.

#### Operaciones principales

* Consultar socios activos.
* Consultar clases llenas.
* Consultar paquetes próximos a vencer.
* Consultar indicadores generales.

#### Dependencias

* MOD-02 — Usuarios.
* MOD-04 — Clases y cupos.
* MOD-05 — Planes y paquetes.
* MOD-06 — Inscripciones y cancelaciones.
* MOD-07 — Asistencias.

#### Criterio mínimo de aceptación

* Solo el administrador puede acceder al panel.
* Los indicadores se calculan a partir de los datos registrados en los módulos correspondientes.
* Las clases llenas se identifican comparando la capacidad con las inscripciones confirmadas.
* Los paquetes próximos a vencer respetan la definición de una semana.
* Los datos presentados coinciden con la información almacenada.

#### Exclusiones

* Informes contables.
* Gráficos estadísticos avanzados.
* Exportación de archivos.
* Predicciones de demanda.
* Indicadores financieros.

## 4. Matriz de permisos

| Operación                          |             Administrador |         Profesor |      Socio |
| ---------------------------------- | ------------------------: | ---------------: | ---------: |
| Iniciar y cerrar sesión            |                    Propia |           Propia |     Propia |
| Gestionar usuarios                 |                        Sí |               No |         No |
| Consultar perfil                   |                     Todos |           Propio |     Propio |
| Gestionar actividades              |                        Sí |               No |         No |
| Crear, modificar o cancelar clases |                        Sí |               No |         No |
| Consultar clases                   |                     Todas |        Asignadas | Publicadas |
| Gestionar tipos de paquetes        |                        Sí |               No |         No |
| Asignar paquetes                   |                        Sí |               No |         No |
| Consultar paquetes                 |                     Todos |               No |    Propios |
| Crear inscripciones                | Asistencia administrativa |               No |    Propias |
| Cancelar inscripciones             | Asistencia administrativa |               No |    Propias |
| Consultar lista de inscriptos      |                     Todas | Clases asignadas |         No |
| Registrar asistencia               |                     Todas | Clases asignadas |         No |
| Consultar historial                |                     Todos | Clases asignadas |     Propio |
| Consultar panel administrativo     |                        Sí |               No |         No |

La interfaz de React podrá ocultar las opciones no autorizadas para mejorar la experiencia de uso. Sin embargo, cada operación será validada nuevamente en el backend.

## 5. Dependencias y orden de desarrollo

| Etapa | Módulos                        | Condición necesaria                              |
| ----- | ------------------------------ | ------------------------------------------------ |
| 1     | Autenticación y usuarios       | Modelo de usuarios y configuración inicial       |
| 2     | Actividades, clases y paquetes | Autenticación y permisos disponibles             |
| 3     | Inscripciones y cancelaciones  | Usuarios, clases y paquetes integrados           |
| 4     | Asistencias                    | Clases e inscripciones integradas                |
| 5     | Panel administrativo           | Información disponible en los módulos anteriores |

Las actividades, clases y paquetes podrán desarrollarse parcialmente en paralelo después de integrar la autenticación y la gestión básica de usuarios.

## 6. Criterio general de finalización

Un módulo se considerará terminado cuando:

* implemente las operaciones acordadas;
* respete las reglas de negocio y permisos;
* valide los datos recibidos;
* mantenga la integridad de la base de datos;
* cuente con pruebas sobre sus procesos principales;
* haya sido revisado por la otra integrante;
* se encuentre documentado;
* haya sido integrado a la rama principal mediante un pull request aprobado.
