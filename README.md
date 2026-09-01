# GymFlow 🏋️‍♂️

> **Trabajo Final Integrador (TFI)**  
> *Tecnicatura Universitaria en Programación a Distancia (TUPaD)*

---

## 👥 Integrantes
- **Giselle Chaumont Mohr**
- **Emilia Gómez Juárez**

**Tutor asignado:** Santiago Fonzo
**Fecha de entrega propuesta:** 30/08/2026

---

## 📌 Descripción del Proyecto
**GymFlow** es una aplicación web desacoplada (SPA + API REST) orientada a la administración y centralización operativa de gimnasios pequeños/medianos, estudios de entrenamiento y centros deportivos.

El sistema resuelve la dispersión de información tradicional (planillas de cálculo independientes, notas en papel, mensajes de WhatsApp) facilitando la gestión centralizada de socios, profesores, actividades, clases programadas con cupos en tiempo real, paquetes de créditos y registros de asistencia.

---

## 🚀 Funcionalidades Principales (MVP)

- 🔐 **Autenticación y Roles:** Control de acceso y rutas protegidas según el perfil (**Administrador**, **Profesor**, **Socio**).
- 📅 **Gestión de Clases y Cupos:** Programación de actividades con validación estricta de cupos máximos en el backend para evitar sobrecupos y duplicados.
- 📦 **Control de Paquetes:** Administración de planes vigentes con verificación automática de créditos y vigencia al momento de reservar.
- 📋 **Control de Asistencia:** Panel ágil para que los profesores registren la presencia/ausencia de los socios inscriptos.
- 📱 **Autogestión para Socios:** Consulta de disponibilidad de clases, inscripción y cancelación autónoma con liberación inmediata de cupos.

---

## 🛠️ Stack Tecnológico Propuesto

| Componente | Tecnología Seleccionada |
| :--- | :--- |
| **Frontend (SPA)** | React (JavaScript / CSS / Bootstrap o Tailwind) |
| **Backend (API REST)** | Node.js (Express / Fastify / NestJS) |
| **Autenticación** | JWT (JSON Web Tokens) & Bcrypt |
| **Base de Datos** | Base de datos relacional SQL (MySQL / PostgreSQL) |
| **Plataforma Cloud** | Vercel (Frontend) / Render (Backend y DB) |
| **Control de Versiones** | Git y GitHub |

---

## 📂 Estructura del Repositorio

```text
gymflow/
├── frontend/        # Aplicación web cliente desarrollada en React
├── backend/         # API REST y lógica de negocio en Node.js
├── database/        # Scripts SQL de creación de tablas, esquemas y datos demo
├── docs/            # Entregas formales, diagramas y documentación del proyecto
├── README.md        # Documentación principal del repositorio
└── .gitignore
