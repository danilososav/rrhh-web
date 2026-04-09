# CONTEXTO.md — Portal RRHH Texo (Migración a Web)

## Descripción del proyecto
Dashboard de HR Analytics para Texo, holding de agencias publicitarias 
en Paraguay. Migración de app Streamlit local a arquitectura web 
FastAPI + Next.js deployada en Render + Vercel.

## Empresas del holding
BRICK, NASTA, LUPE, OMD, ROGER, TAC MEDIA, BPR, AMPLIFY, TEXO, ROW

## Stack tecnológico
- Backend: FastAPI (Python 3.11+) — deployado en Render
- Frontend: Next.js 14 + React — deployado en Vercel
- Gráficos: react-plotly.js (los datos vienen de FastAPI como JSON)
- Claude API: anthropic SDK (llamadas desde FastAPI, nunca desde el frontend)
- Procesamiento: pandas, openpyxl, numpy
- Variables de entorno: ANTHROPIC_API_KEY en backend

## Estructura de módulos
| Ruta frontend       | Endpoint FastAPI         | Módulo original          |
|---------------------|--------------------------|--------------------------|
| /                   | —                        | inicio.py                |
| /reclutamiento      | /api/reclutamiento       | 1_Reclutamiento.py       |
| /rotacion           | /api/rotacion            | 2_Rotacion.py            |
| /costos             | /api/costos              | 3_Costos_Liquidaciones.py|
| /nomina             | /api/nomina              | 4_Nomina.py              |
| /resumen-ejecutivo  | /api/resumen             | 5_Resumen_Ejecutivo.py   |

## Flujo de datos por módulo
1. Usuario sube Excel desde el frontend
2. Frontend hace POST multipart/form-data al endpoint FastAPI
3. FastAPI procesa con pandas, llama a Claude si corresponde
4. FastAPI devuelve JSON con: { kpis, charts_data, tables }
5. Frontend renderiza con react-plotly.js y componentes React

## Estado entre módulos (crítico)
El Resumen Ejecutivo depende de datos de Nómina, Rotación y 
Liquidaciones. Solución: cada módulo guarda su resultado en 
React Context (cliente). El Resumen lee del contexto, no hace 
upload propio.

## Llamadas a Claude API (todas desde FastAPI)
| Módulo       | Función                  | Propósito                              |
|--------------|--------------------------|----------------------------------------|
| Rotación     | interpretar_mes_ia()     | Detecta mes desde nombre de hoja Excel |
| Rotación     | categorizar_motivos_ia() | Clasifica motivos de renuncia a JSON   |
| Rotación     | interpretar_satisfaccion_ia() | Insight ejecutivo de entrevistas  |
| Nómina       | inferir_sexo_ia()        | Infiere género desde nombres (lotes 50)|
| Res. Ejecutivo | narrativa por empresa  | Análisis narrativo para directorio     |

## Reglas de negocio críticas
- Tasa rotación anual = salidas_año / hc_enero × 100
- Denominador = headcount enero (NUNCA promedio mensual)
- Sobrecosto es la métrica principal en liquidaciones
- LIDER = SI si Nivel AIC es SENIOR o INTERMEDIO
- Situación A = activo, Situación I = saliente
- Género inferido en batches de máximo 50 nombres
- Todas las tasas se etiquetan como "Anual"

## Diseño visual
- Tema oscuro ejecutivo en toda la app
- Logo: logo.jpg, ancho 220px, presente en todas las páginas
- Paleta: colores oscuros con acentos de alto contraste
- Gráficos: fondo transparente o dark, sin bordes blancos

## Columnas Excel de nómina
Empresa, Situación, Código, Razón Social, Doc. Identidad, Cargo,
Sección, Departamento, Área, Centro de Costo, Salario, IPS,
Fecha Ingreso, Fecha Antigüedad, Antigüedad, Tipo Pago IRP,
Fecha Salida, Motivo Salida, Nivel AIC, Fecha Nacimiento, Nacionalidad

## Lo que NO incluye esta versión
- Autenticación con usuarios y roles
- Base de datos persistente
- Edición de datos desde la UI
- Notificaciones o alertas automáticas