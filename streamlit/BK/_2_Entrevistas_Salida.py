import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date
import numpy as np
import re
from pathlib import Path
import os
import json
from dotenv import load_dotenv
import anthropic

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

st.set_page_config(page_title="Entrevistas de Salida | Texo RRHH", layout="wide", page_icon="🚪")

logo_path = Path("images/logo.jpg")
if logo_path.exists():
    st.sidebar.image(str(logo_path), width=220)
else:
    st.sidebar.markdown("### 👥 RRHH · Texo")

st.markdown("""
<style>
    .metric-card {
        background: #1a1f2e;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        border-left: 4px solid #4C6FFF;
    }
    .metric-value { font-size: 2rem; font-weight: 700; color: #4C6FFF; }
    .metric-label { font-size: 0.85rem; color: #aaa; margin-top: 4px; }
</style>
""", unsafe_allow_html=True)

def metric_card(label, value, suffix=""):
    return f"""<div class="metric-card">
        <div class="metric-value">{value}{suffix}</div>
        <div class="metric-label">{label}</div>
    </div>"""

# ─── Categorías fijas de motivos ──────────────────────────────────────────────
CATEGORIAS_MOTIVOS = [
    "Mejor propuesta salarial",
    "Desarrollo profesional",
    "Ambiente laboral",
    "Relación con supervisor",
    "Horario / modalidad de trabajo",
    "Motivos personales",
    "Carga laboral",
    "Ubicación / distancia",
    "Proyectos personales",
    "Otro",
]

PREGUNTAS = {
    "P1_ORIENTACION":       "1. Orientación en el cargo",
    "P2_CAPACITACION":      "2. Capacitación / Entrenamiento",
    "P3_CRECIMIENTO":       "3. Oportunidad de crecimiento",
    "P4_INFRAESTRUCTURA":   "4. Infraestructura adecuada",
    "P5_AMBIENTE":          "5. Ambiente laboral",
    "P6_SUPERVISOR":        "6. Actitud del supervisor",
    "P7_APOYO_SUPERIOR":    "7. Apoyo del superior inmediato",
    "P8_APERTURA_SUPERIOR": "8. Apertura a sugerencias",
}

COLOR_SEQ = px.colors.qualitative.Bold

# ─── Función IA: categorizar motivos ──────────────────────────────────────────
@st.cache_data(show_spinner=False)
def categorizar_motivos_ia(motivos_unicos: tuple) -> dict:
    """Llama a Claude para categorizar cada motivo en una categoría estándar."""
    lista = "\n".join(f"- {m}" for m in motivos_unicos)
    cats  = "\n".join(f"- {c}" for c in CATEGORIAS_MOTIVOS)

    prompt = f"""Tenés esta lista de motivos de renuncia laboral de empleados.
Cada motivo puede contener múltiples razones separadas por coma.
Tu tarea es asignar a cada motivo UNA categoría principal de la lista provista.

CATEGORÍAS DISPONIBLES:
{cats}

MOTIVOS A CATEGORIZAR:
{lista}

Respondé ÚNICAMENTE con un objeto JSON válido donde la clave es el motivo exacto y el valor es la categoría asignada.
No incluyas explicaciones, markdown ni texto adicional. Solo el JSON.
Ejemplo: {{"DESARROLLO PROFESIONAL": "Desarrollo profesional", "MEJOR PROPUESTA SALARIAL, HORARIO": "Mejor propuesta salarial"}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        texto = response.content[0].text.strip()
        texto = re.sub(r"```json|```", "", texto).strip()
        return json.loads(texto)
    except Exception as e:
        st.warning(f"Error al categorizar con IA: {e}")
        return {m: "Otro" for m in motivos_unicos}

# ─── Función IA: interpretar satisfacción ─────────────────────────────────────
@st.cache_data(show_spinner=False)
def interpretar_satisfaccion_ia(promedios_json: str) -> str:
    """Claude analiza los promedios de satisfacción y da insights."""
    prompt = f"""Sos un consultor de RRHH analizando resultados de entrevistas de salida de empleados del holding Texo (empresas publicitarias en Paraguay).

Estos son los promedios de satisfacción por dimensión (escala 1 a 5) de empleados que renunciaron:

{promedios_json}

Analizá estos resultados y generá:
1. Los 2-3 puntos más críticos (puntaje más bajo) con una interpretación breve de qué significa para la organización
2. Los puntos más fuertes
3. Una recomendación concreta y accionable para la dirección

Sé directo y ejecutivo. Máximo 200 palabras. Sin markdown excesivo, solo texto claro."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        return f"No se pudo generar el análisis: {e}"

# ─── Carga de datos ────────────────────────────────────────────────────────────
st.title("🚪 Entrevistas de Salida")

uploaded_files = st.file_uploader(
    "Subí uno o más archivos Excel de entrevistas de salida",
    type=["xlsx", "xls"],
    accept_multiple_files=True
)

if uploaded_files:
    dfs = []
    for f in uploaded_files:
        try:
            xl = pd.ExcelFile(f)
            hojas = xl.sheet_names
            if len(hojas) == 1:
                hoja_sel = hojas[0]
            else:
                hoja_sel = st.selectbox(f"📋 Seleccioná la hoja de **{f.name}**",
                                        options=hojas, key=f"hoja_{f.name}")
            df_tmp = pd.read_excel(xl, sheet_name=hoja_sel)
            df_tmp["_archivo"] = f.name
            dfs.append(df_tmp)
            st.success(f"✅ {f.name} → hoja **{hoja_sel}** cargada ({len(df_tmp)} filas)")
        except Exception as e:
            st.warning(f"No se pudo leer {f.name}: {e}")
    if dfs:
        st.session_state["df_entrevistas"] = pd.concat(dfs, ignore_index=True)

if "df_entrevistas" not in st.session_state:
    st.info("📂 Subí al menos un archivo Excel para comenzar.")
    st.stop()

df = st.session_state["df_entrevistas"]
# ─── Normalización de columnas ─────────────────────────────────────────────────
df.columns = (df.columns.str.strip().str.upper()
              .str.replace(".", "", regex=False)
              .str.replace(" ", "_")
              .str.replace("Á","A").str.replace("É","E")
              .str.replace("Í","I").str.replace("Ó","O")
              .str.replace("Ú","U").str.replace("Ñ","N")
              .str.replace(",","").str.replace("(","").str.replace(")","")
              .str.replace("?","").str.replace("¿",""))

# Fallback: mapeo por posición
posicion_map = {
    0: "MARCA_TEMPORAL", 1: "NOMBRE", 2: "EMPRESA", 3: "CARGO",
    4: "AREA", 5: "FECHA_INGRESO", 6: "FECHA_SALIDA", 7: "MOTIVO_PRINCIPAL",
    8: "P1_ORIENTACION", 9: "P2_CAPACITACION", 10: "P3_CRECIMIENTO",
    11: "P4_INFRAESTRUCTURA", 12: "P5_AMBIENTE", 13: "P6_SUPERVISOR",
    14: "P7_APOYO_SUPERIOR", 15: "P8_APERTURA_SUPERIOR",
    16: "P9_LO_QUE_GUSTO", 17: "P10_MEJORAS", 18: "P11_VOLVERIA",
    19: "P12_RECOMENDARIA", 20: "PUNTUACION", 21: "EMAIL",
    22: "CEDULA", 23: "BUSQUEDA_EXTERIOR", 24: "MOTIVO_SECUNDARIO", 25: "MOTIVO_OTRO"
}
cols_actuales = list(df.columns)
for i, nuevo_nombre in posicion_map.items():
    if i < len(cols_actuales) and nuevo_nombre not in df.columns:
        df.rename(columns={cols_actuales[i]: nuevo_nombre}, inplace=True)

# ─── Limpiar columnas de texto ─────────────────────────────────────────────────
cols_texto = ["NOMBRE","EMPRESA","CARGO","AREA","MOTIVO_PRINCIPAL",
              "MOTIVO_SECUNDARIO","MOTIVO_OTRO","P11_VOLVERIA","P12_RECOMENDARIA"]
for col in cols_texto:
    if col in df.columns:
        df[col] = df[col].astype(str).str.strip().str.upper().replace("NAN", np.nan)

# ─── Fechas ────────────────────────────────────────────────────────────────────
for col in ["FECHA_INGRESO","FECHA_SALIDA","MARCA_TEMPORAL"]:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], errors="coerce")

if "FECHA_INGRESO" in df.columns and "FECHA_SALIDA" in df.columns:
    df["MESES_PERMANENCIA"] = ((df["FECHA_SALIDA"] - df["FECHA_INGRESO"])
                               .dt.days / 30.44).round(1)
    df["ANOS_PERMANENCIA"]  = (df["MESES_PERMANENCIA"] / 12).round(2)

if "MARCA_TEMPORAL" in df.columns:
    df["ANO"] = df["MARCA_TEMPORAL"].dt.year
    df["MES"] = df["MARCA_TEMPORAL"].dt.month

# ─── Puntajes ─────────────────────────────────────────────────────────────────
pregs_disponibles = [p for p in PREGUNTAS.keys() if p in df.columns]
for p in pregs_disponibles:
    df[p] = pd.to_numeric(df[p], errors="coerce")
if pregs_disponibles:
    df["SCORE_PROMEDIO"] = df[pregs_disponibles].mean(axis=1).round(2)

# ─── Categorización IA de motivos ─────────────────────────────────────────────
if "MOTIVO_PRINCIPAL" in df.columns:
    motivos_unicos = tuple(df["MOTIVO_PRINCIPAL"].dropna().unique())
    if motivos_unicos:
        with st.spinner("🤖 Categorizando motivos con IA..."):
            mapa_categorias = categorizar_motivos_ia(motivos_unicos)
        df["MOTIVO_CATEGORIA"] = df["MOTIVO_PRINCIPAL"].map(mapa_categorias).fillna("Otro")

# ─── Sidebar Filtros ───────────────────────────────────────────────────────────
st.sidebar.header("🔍 Filtros")

def sidebar_multi(label, col):
    if col in df.columns:
        opts = sorted(df[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts)
    return None

f_empresa = sidebar_multi("Empresa", "EMPRESA")
f_area    = sidebar_multi("Área", "AREA")
f_categ   = sidebar_multi("Categoría Motivo", "MOTIVO_CATEGORIA")

if "ANO" in df.columns:
    anos  = sorted(df["ANO"].dropna().unique().tolist())
    f_ano = st.sidebar.multiselect("Año", anos, default=anos)
else:
    f_ano = None

mask = pd.Series([True] * len(df))
if f_empresa and "EMPRESA"          in df.columns: mask &= df["EMPRESA"].isin(f_empresa)
if f_area    and "AREA"             in df.columns: mask &= df["AREA"].isin(f_area)
if f_categ   and "MOTIVO_CATEGORIA" in df.columns: mask &= df["MOTIVO_CATEGORIA"].isin(f_categ)
if f_ano     and "ANO"              in df.columns: mask &= df["ANO"].isin(f_ano)

dff = df[mask].copy()

if dff.empty:
    st.warning("No hay datos con los filtros seleccionados.")
    st.stop()

# ─── KPIs ──────────────────────────────────────────────────────────────────────
total       = len(dff)
empresas_u  = dff["EMPRESA"].nunique() if "EMPRESA" in dff.columns else "—"
perm_prom   = dff["MESES_PERMANENCIA"].mean() if "MESES_PERMANENCIA" in dff.columns else None
perm_str    = f"{perm_prom:.1f}" if perm_prom and not np.isnan(perm_prom) else "—"
score_prom  = dff["SCORE_PROMEDIO"].mean() if "SCORE_PROMEDIO" in dff.columns else None
score_str   = f"{score_prom:.2f}" if score_prom and not np.isnan(score_prom) else "—"

if "P11_VOLVERIA" in dff.columns:
    vol_si      = dff["P11_VOLVERIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
    pct_vol     = f"{vol_si/total*100:.0f}%" if total > 0 else "—"
else:
    pct_vol = "—"

if "P12_RECOMENDARIA" in dff.columns:
    rec_si      = dff["P12_RECOMENDARIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
    pct_rec     = f"{rec_si/total*100:.0f}%" if total > 0 else "—"
else:
    pct_rec = "—"

cols = st.columns(6)
for i, (label, val, suf) in enumerate([
    ("Total Entrevistas",     total,      ""),
    ("Empresas",              empresas_u, ""),
    ("Perm. Promedio",        perm_str,   " meses"),
    ("Satisfacción Promedio", score_str,  " / 5"),
    ("Volvería a trabajar",   pct_vol,    ""),
    ("Recomendaría Texo",     pct_rec,    ""),
]):
    cols[i].markdown(metric_card(label, val, suf), unsafe_allow_html=True)

st.markdown("---")

# ─── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "📉 Motivos de Salida",
    "🏢 Por Empresa",
    "⭐ Satisfacción",
    "📋 Detalle"
])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — MOTIVOS DE SALIDA
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    if "MOTIVO_CATEGORIA" not in dff.columns:
        st.warning("No se encontró la columna de Motivo Principal.")
    else:
        st.markdown("#### 🤖 Motivos agrupados por IA")
        c1, c2 = st.columns(2)
        with c1:
            cat = dff["MOTIVO_CATEGORIA"].value_counts().reset_index()
            cat.columns = ["Categoría","Cantidad"]
            st.plotly_chart(px.bar(cat, x="Cantidad", y="Categoría", orientation="h",
                title="Categorías de Motivos de Salida", color="Categoría",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        with c2:
            st.plotly_chart(px.pie(cat, names="Categoría", values="Cantidad",
                title="Distribución de Categorías", hole=0.4,
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        # Evolución por año
        if "ANO" in dff.columns:
            cat_ano = dff.groupby(["ANO","MOTIVO_CATEGORIA"]).size().reset_index(name="n")
            cat_ano["ANO"] = cat_ano["ANO"].astype(str)
            st.plotly_chart(px.bar(cat_ano, x="ANO", y="n", color="MOTIVO_CATEGORIA",
                title="Evolución de Motivos por Año", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        # Motivos originales debajo
        with st.expander("Ver motivos originales sin agrupar"):
            mot = dff["MOTIVO_PRINCIPAL"].value_counts().reset_index()
            mot.columns = ["Motivo","Cantidad"]
            st.plotly_chart(px.bar(mot, x="Cantidad", y="Motivo", orientation="h",
                title="Motivos Originales", color="Motivo",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — POR EMPRESA
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    if "EMPRESA" not in dff.columns:
        st.warning("No se encontró la columna EMPRESA.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            emp = dff.groupby("EMPRESA").size().reset_index(name="Salidas").sort_values("Salidas")
            st.plotly_chart(px.bar(emp, x="Salidas", y="EMPRESA", orientation="h",
                title="Salidas por Empresa", color="EMPRESA",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        with c2:
            if "SCORE_PROMEDIO" in dff.columns:
                emp_s = dff.groupby("EMPRESA")["SCORE_PROMEDIO"].mean().reset_index()
                emp_s.columns = ["EMPRESA","Satisfacción"]
                emp_s = emp_s.dropna().sort_values("Satisfacción")
                st.plotly_chart(px.bar(emp_s, x="Satisfacción", y="EMPRESA", orientation="h",
                    title="Satisfacción Promedio por Empresa (1-5)",
                    color="Satisfacción", color_continuous_scale="RdYlGn", range_color=[1,5]
                ).update_layout(coloraxis_showscale=True), use_container_width=True)

        if "MOTIVO_CATEGORIA" in dff.columns:
            emp_cat = dff.groupby(["EMPRESA","MOTIVO_CATEGORIA"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(emp_cat, x="EMPRESA", y="n", color="MOTIVO_CATEGORIA",
                title="Categorías de Motivos por Empresa", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "ANO" in dff.columns:
            emp_ano = dff.groupby(["ANO","EMPRESA"]).size().reset_index(name="Salidas")
            emp_ano["ANO"] = emp_ano["ANO"].astype(str)
            st.plotly_chart(px.line(emp_ano, x="ANO", y="Salidas", color="EMPRESA",
                title="Evolución de Salidas por Empresa", markers=True,
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "P11_VOLVERIA" in dff.columns:
            vol_emp = dff.groupby(["EMPRESA","P11_VOLVERIA"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(vol_emp, x="EMPRESA", y="n", color="P11_VOLVERIA",
                title="¿Volvería a trabajar? por Empresa", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — SATISFACCIÓN
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    if not pregs_disponibles:
        st.warning("No se encontraron columnas de satisfacción.")
    else:
        prom_pregs = {PREGUNTAS[p]: round(dff[p].mean(), 2) for p in pregs_disponibles if p in dff.columns}
        df_prom    = pd.DataFrame(list(prom_pregs.items()), columns=["Dimensión","Promedio"]).sort_values("Promedio")

        # Análisis IA
        with st.spinner("🤖 Analizando satisfacción con IA..."):
            insight = interpretar_satisfaccion_ia(json.dumps(prom_pregs, ensure_ascii=False, indent=2))

        st.info(f"🤖 **Análisis ejecutivo por IA:**\n\n{insight}")
        st.markdown("---")

        c1, c2 = st.columns(2)
        with c1:
            fig_radar = go.Figure()
            fig_radar.add_trace(go.Scatterpolar(
                r=df_prom["Promedio"].tolist(),
                theta=df_prom["Dimensión"].tolist(),
                fill="toself", name="Satisfacción", line_color="#4C6FFF"
            ))
            fig_radar.update_layout(
                polar=dict(radialaxis=dict(visible=True, range=[0,5])),
                title="Radar de Satisfacción (1-5)",
                paper_bgcolor="#0e1117", font_color="#e8eaf0"
            )
            st.plotly_chart(fig_radar, use_container_width=True)

        with c2:
            st.plotly_chart(px.bar(df_prom, x="Promedio", y="Dimensión", orientation="h",
                title="Promedio por Dimensión", color="Promedio",
                color_continuous_scale="RdYlGn", range_color=[1,5]
            ).update_layout(coloraxis_showscale=True), use_container_width=True)

        if "EMPRESA" in dff.columns:
            emp_pregs = dff.groupby("EMPRESA")[pregs_disponibles].mean().reset_index()
            emp_melt  = emp_pregs.melt(id_vars="EMPRESA", var_name="Pregunta", value_name="Promedio")
            emp_melt["Pregunta"] = emp_melt["Pregunta"].map(PREGUNTAS)
            st.plotly_chart(px.bar(emp_melt.dropna(), x="Promedio", y="Pregunta",
                color="EMPRESA", barmode="group", orientation="h",
                title="Satisfacción por Dimensión y Empresa",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "AREA" in dff.columns:
            area_pregs = dff.groupby("AREA")[pregs_disponibles].mean().reset_index()
            area_melt  = area_pregs.melt(id_vars="AREA", var_name="Pregunta", value_name="Promedio")
            area_melt["Pregunta"] = area_melt["Pregunta"].map(PREGUNTAS)
            st.plotly_chart(px.bar(area_melt.dropna(), x="Promedio", y="Pregunta",
                color="AREA", barmode="group", orientation="h",
                title="Satisfacción por Dimensión y Área",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        # Comentarios abiertos
        st.markdown("#### 💬 Comentarios abiertos")
        for col, titulo in [("P9_LO_QUE_GUSTO","¿Qué fue lo que más te gustó?"),
                             ("P10_MEJORAS","¿Qué deberíamos mejorar?")]:
            if col in dff.columns:
                st.markdown(f"**{titulo}**")
                com = dff[[c for c in ["NOMBRE","EMPRESA","CARGO",col] if c in dff.columns]].dropna(subset=[col])
                com = com[com[col].str.upper() != "NAN"]
                st.dataframe(com.rename(columns={col:"Comentario"}), use_container_width=True, height=200)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — DETALLE
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    st.markdown(f"**{len(dff)} registros** con los filtros aplicados")
    show_cols = [c for c in ["NOMBRE","EMPRESA","CARGO","AREA","FECHA_INGRESO","FECHA_SALIDA",
                              "MESES_PERMANENCIA","MOTIVO_PRINCIPAL","MOTIVO_CATEGORIA",
                              "MOTIVO_SECUNDARIO","MOTIVO_OTRO","SCORE_PROMEDIO",
                              "P11_VOLVERIA","P12_RECOMENDARIA","ANO"] if c in dff.columns]
    st.dataframe(dff[show_cols], use_container_width=True, height=500)
    csv = dff[show_cols].to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Descargar datos filtrados (.csv)", csv, "entrevistas_salida.csv", "text/csv")