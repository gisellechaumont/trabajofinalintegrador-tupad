# Alcance y viabilidad

## Alcance funcional (MVP) y exclusiones

### Módulos incluidos

* **Autenticación y roles:** Inicio/cierre de sesión seguro con tokens JWT y control de rutas privadas en React.
* **Gestión de usuarios:** Altas, modificaciones, activación/desactivación de socios y profesores.
* **Gestión de planes/paquetes:** Creación y asignación manual de paquetes, con fecha de inicio, vencimiento y clases disponibles.
* **Gestión de clases y cupos:** Programación de actividades con fechas, horarios, profesores y límites de cupo con validaciones estrictas en la API backend.
* **Inscripciones y cancelaciones:** Reserva autónoma, liberación automática de cupo ante cancelación y bloqueo por cupo lleno.
* **Control de asistencia:** Registro ágil de presencia/ausencia e historial por socio y clase.
* **Panel informativo administrativo:** Métricas operativas básicas: socios activos, clases llenas y vencimientos próximos.

### Exclusiones explícitas del MVP

Para garantizar la viabilidad y calidad en los plazos estipulados, quedan fuera del alcance:

* Procesamiento de pagos online o pasarelas.
* Facturación electrónica.
* Aplicación móvil nativa.
* Integración con molinetes o biometría.
* Rutinas de entrenamiento o planes nutricionales.
* Listas de espera automáticas.
* Reportes contables complejos.

## Reglas de negocio principales

* **RN-01:** Un usuario debe estar activo y autenticado para operar en el sistema.
* **RN-02:** Cada usuario opera estrictamente según los permisos asignados a su rol.
* **RN-03:** Solo el Administrador puede dar de alta usuarios, planes y programar clases.
* **RN-04:** El Profesor solo puede visualizar y registrar asistencia en las clases que tiene asignadas.
* **RN-05:** El Socio únicamente puede consultar y modificar sus propias reservas y estado del paquete.
* **RN-06:** No se permite la inscripción duplicada de un socio en una misma clase.
* **RN-07:** Una clase no puede superar su cupo máximo configurado.
* **RN-08:** Al cancelarse una inscripción válida, el cupo queda inmediatamente liberado.
* **RN-09:** Para realizar una inscripción, el socio debe contar con un paquete activo y clases disponibles.
* **RN-10:** La asistencia sólo puede registrarse para socios debidamente inscriptos en la clase.
* **RN-11:** Todas las validaciones de negocio críticas se ejecutan y resuelven en el backend.

## Viabilidad

Se profundiza la viabilidad más allá del aspecto técnico, analizando los ejes temporal y de dominio:

### Viabilidad técnica

El equipo cuenta con conocimientos previos sólidos en diseño de bases de datos relacionales SQL, programación web y lógica de negocio adquiridos a lo largo de la carrera. Se descartan funcionalidades de alta complejidad innecesarias para un MVP (como pasarelas de pago bancarias, facturación fiscal o lectura biométrica), manteniendo el alcance acotado y realizable.

### Viabilidad temporal

El proyecto está estructurado a lo largo de 14 semanas (agosto a noviembre de 2026), subdivididas en hitos incrementales claros. La carga horaria estimada es de aproximadamente 8 a 10 horas semanales por integrante, lo que resulta compatible con las restantes obligaciones académicas del equipo. La separación en arquitectura cliente-servidor permite el desarrollo en paralelo: mientras una integrante avanza con el modelado de datos y los endpoints de la API, la otra puede trabajar en la maquetación y componentes de React consumiendo datos simulados (*mock data*).

### Viabilidad de dominio y negocio (conocimiento operativo)

El modelo de negocio y flujo de trabajo de un gimnasio con clases y cupos limitados (CrossFit, Pilates, entrenamiento funcional, yoga) es un dominio conocido y de fácil observación empírica. Se relevó la operativa estándar: venta de pases/paquetes con créditos, publicación de grilla semanal, reserva previa y toma de asistencia por parte del instructor. Al tratarse de un problema recurrente en centros deportivos de barrio, las reglas de negocio resultan claras y no requieren validaciones regulatorias complejas, lo que reduce drásticamente el riesgo de desviaciones funcionales durante el desarrollo.
