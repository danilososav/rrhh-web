import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import re
import os
import json
from pathlib import Path
from dotenv import load_dotenv
import anthropic

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

st.set_page_config(page_title="Rotación | Texo RRHH", layout="wide", page_icon="🔄")

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

COLOR_SEQ = px.colors.qualitative.Bold

MESES_MAP = {
    "ENE": 1, "ENERO": 1, "JAN": 1, "JANUARY": 1, "01": 1,
    "FEB": 2, "FEBRERO": 2, "FEBRUARY": 2, "02": 2,
    "MAR": 3, "MARZO": 3, "MARCH": 3, "03": 3,
    "ABR": 4, "ABRIL": 4, "APRIL": 4, "04": 4,
    "MAY": 5, "MAYO": 5, "05": 5,
    "JUN": 6, "JUNIO": 6, "JUNE": 6, "06": 6,
    "JUL": 7, "JULIO": 7, "JULY": 7, "07": 7,
    "AGO": 8, "AGOSTO": 8, "AUGUST": 8, "AUG": 8, "08": 8,
    "SEP": 9, "SEPTIEMBRE": 9, "SEPTEMBER": 9, "09": 9,
    "OCT": 10, "OCTUBRE": 10, "OCTOBER": 10, "10": 10,
    "NOV": 11, "NOVIEMBRE": 11, "NOVEMBER": 11, "11": 11,
    "DIC": 12, "DICIEMBRE": 12, "DECEMBER": 12, "DEC": 12, "12": 12,
}

MESES_NOMBRE = {
    1:"Enero", 2:"Febrero", 3:"Marzo", 4:"Abril", 5:"Mayo", 6:"Junio",
    7:"Julio", 8:"Agosto", 9:"Septiembre", 10:"Octubre", 11:"Noviembre", 12:"Diciembre"
}

# ─── Entrevistas: constantes ───────────────────────────────────────────────────
CATEGORIAS_MOTIVOS = [
    "Mejor propuesta salarial", "Desarrollo profesional", "Ambiente laboral",
    "Relación con supervisor", "Horario / modalidad de trabajo", "Motivos personales",
    "Carga laboral", "Ubicación / distancia", "Proyectos personales", "Otro",
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

@st.cache_data(show_spinner=False)
def interpretar_mes_ia(nombre_ficha: str) -> int:
    prompt = f"""El nombre de una hoja de Excel es: "{nombre_ficha}"
¿A qué número de mes corresponde? (1=Enero ... 12=Diciembre)
Respondé ÚNICAMENTE con el número entero del mes, sin texto adicional."""
    try:
        r = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=10,
            messages=[{"role": "user", "content": prompt}]
        )
        return int(r.content[0].text.strip())
    except:
        return 0

def detectar_mes(nombre_ficha: str) -> int:
    nombre_upper = nombre_ficha.upper().strip()
    nombre_limpio = re.sub(r'^M_|^MES_|^SHEET', '', nombre_upper).strip()
    for k, v in MESES_MAP.items():
        if k in nombre_limpio:
            return v
    return interpretar_mes_ia(nombre_ficha)

@st.cache_data(show_spinner=False)
def categorizar_motivos_ia(motivos_unicos: tuple) -> dict:
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
No incluyas explicaciones, markdown ni texto adicional. Solo el JSON."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        texto = re.sub(r"```json|```", "", response.content[0].text.strip()).strip()
        return json.loads(texto)
    except Exception as e:
        st.warning(f"Error al categorizar con IA: {e}")
        return {m: "Otro" for m in motivos_unicos}

@st.cache_data(show_spinner=False)
def interpretar_satisfaccion_ia(promedios_json: str) -> str:
    prompt = f"""Sos un consultor de RRHH analizando resultados de entrevistas de salida de empleados del holding Texo (empresas publicitarias en Paraguay).

Estos son los promedios de satisfacción por dimensión (escala 1 a 5) de empleados que renunciaron:

{promedios_json}

Analizá estos resultados y generá:
1. Los 2-3 puntos más críticos (puntaje más bajo) con una interpretación breve
2. Los puntos más fuertes
3. Una recomendación concreta y accionable para la dirección

Sé directo y ejecutivo. Máximo 200 palabras. Sin markdown excesivo."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        return f"No se pudo generar el análisis: {e}"

COL_MAP = {
    "SITUACION": "SITUACION", "SITUACIÓN": "SITUACION",
    "CODIGO": "CODIGO", "CÓDIGO": "CODIGO",
    "RAZON_SOCIAL": "NOMBRE", "RAZÓN_SOCIAL": "NOMBRE", "NOMBRE": "NOMBRE",
    "DOC_DE_IDENTIDAD": "CEDULA", "DOCUMENTO": "CEDULA",
    "CARGO": "CARGO",
    "SECCION": "SECCION", "SECCIÓN": "SECCION",
    "DEPARTAMENTO": "DEPARTAMENTO",
    "AREA": "AREA", "ÁREA": "AREA",
    "CENTRO_DE_COSTO": "CENTRO_COSTO",
    "SALARIO": "SALARIO",
    "IPS": "IPS",
    "MES_INGRESO": "MES_INGRESO",
    "ANO_INGRESO": "ANO_INGRESO", "AÑO_INGRESO": "ANO_INGRESO",
    "FECHA_INGRESO": "FECHA_INGRESO",
    "TIPO_DE_PAGO_IRP": "TIPO_PAGO",
    "MES_SALIDA": "MES_SALIDA",
    "ANO_SALIDA": "ANO_SALIDA", "AÑO_SALIDA": "ANO_SALIDA",
    "FECHA_SALIDA": "FECHA_SALIDA",
    "MOTIVO_SALIDA": "MOTIVO_SALIDA",
    "TIPO_SALIDA": "TIPO_SALIDA",
}

def normalizar_df(df_raw: pd.DataFrame, empresa_col: str, mes: int, ano: int) -> pd.DataFrame:
    df = df_raw.copy()
    df.rename(columns={df.columns[0]: "EMPRESA"}, inplace=True)
    df.columns = (df.columns.str.strip().str.upper()
                  .str.replace(" ", "_").str.replace(".", "", regex=False)
                  .str.replace("Á","A").str.replace("É","E")
                  .str.replace("Í","I").str.replace("Ó","O")
                  .str.replace("Ú","U").str.replace("Ñ","N"))
    df.rename(columns={k:v for k,v in COL_MAP.items() if k in df.columns}, inplace=True)
    for col in ["EMPRESA","SITUACION","CARGO","DEPARTAMENTO","AREA","MOTIVO_SALIDA","TIPO_SALIDA","SECCION"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper().replace("NAN", np.nan)
    for col in ["FECHA_INGRESO","FECHA_SALIDA"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    if "SALARIO" in df.columns:
        df["SALARIO"] = pd.to_numeric(df["SALARIO"], errors="coerce")
    df["MES_REPORTE"] = mes
    df["ANO_REPORTE"] = ano
    df["MES_NOMBRE"]  = MESES_NOMBRE.get(mes, str(mes))
    if "FECHA_INGRESO" in df.columns and "FECHA_SALIDA" in df.columns:
        df["MESES_PERMANENCIA"] = ((df["FECHA_SALIDA"] - df["FECHA_INGRESO"])
                                   .dt.days / 30.44).round(1)
    return df

# ══════════════════════════════════════════════════════════════════════════════
# CARGA DE DATOS
# ══════════════════════════════════════════════════════════════════════════════
st.title("🔄 Rotación de Personal")

uploaded_files = st.file_uploader(
    "Subí uno o más archivos Excel de rotación (un archivo por año)",
    type=["xlsx", "xls"],
    accept_multiple_files=True,
    key="uploader_rotacion"
)

FICHAS_IGNORAR = ["ROTACION","RESUMEN","DASHBOARD","TOTAL","DB","TB","DATOS","PIVOT","GRAFICO"]

if uploaded_files:
    all_dfs = []
    for i, f in enumerate(uploaded_files):
        xl = pd.ExcelFile(f)
        ano_match = re.search(r'20\d{2}', f.name)
        ano_default = int(ano_match.group()) if ano_match else 2025
        ano = st.number_input(f"📅 Año del archivo **{f.name}**",
                      min_value=2000, max_value=2100,
                      value=ano_default, key=f"ano_{f.name}_{i}")
        hojas_validas = [h for h in xl.sheet_names
                         if not any(x in h.upper() for x in FICHAS_IGNORAR)]
        st.markdown(f"**Fichas a importar en {f.name}:** {', '.join(hojas_validas)}")
        for hoja in hojas_validas:
            mes = detectar_mes(hoja)
            if mes == 0:
                st.warning(f"⚠️ No se pudo interpretar el mes de la ficha **{hoja}** — se omite.")
                continue
            try:
                df_raw = pd.read_excel(xl, sheet_name=hoja)
                if df_raw.empty or len(df_raw.columns) < 3:
                    continue
                df_norm = normalizar_df(df_raw, df_raw.columns[0], mes, int(ano))
                all_dfs.append(df_norm)
            except Exception as e:
                st.warning(f"Error leyendo {hoja}: {e}")
    if all_dfs:
        df_nuevo = pd.concat(all_dfs, ignore_index=True)
        if "df_rotacion" in st.session_state:
            df_existente = st.session_state["df_rotacion"]
            anos_nuevos  = df_nuevo["ANO_REPORTE"].unique()
            df_existente = df_existente[~df_existente["ANO_REPORTE"].isin(anos_nuevos)]
            st.session_state["df_rotacion"] = pd.concat([df_existente, df_nuevo], ignore_index=True)
        else:
            st.session_state["df_rotacion"] = df_nuevo
        anos_cargados = sorted(st.session_state["df_rotacion"]["ANO_REPORTE"].unique().tolist())
        st.success(f"✅ Datos cargados. Años disponibles: {', '.join(map(str, anos_cargados))}")

if "df_rotacion" in st.session_state:
    if st.sidebar.button("🗑️ Limpiar datos de Rotación"):
        del st.session_state["df_rotacion"]
        st.rerun()

if "df_rotacion" not in st.session_state:
    st.info("📂 Subí al menos un archivo Excel de rotación para comenzar.")
    st.stop()

df = st.session_state["df_rotacion"].copy()

if "SITUACION" in df.columns:
    df_activos = df[df["SITUACION"] != "I"].copy()
    df_salidas  = df[df["SITUACION"] == "I"].copy()
else:
    df_activos = df.copy()
    df_salidas  = pd.DataFrame()

# ─── Sidebar Filtros ───────────────────────────────────────────────────────────
st.sidebar.header("🔍 Filtros Rotación")

def sidebar_multi(label, col, data=None):
    d = data if data is not None else df
    if col in d.columns:
        opts = sorted(d[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts)
    return None

anos_disp = sorted(df["ANO_REPORTE"].dropna().unique().tolist()) if "ANO_REPORTE" in df.columns else []
f_ano     = st.sidebar.multiselect("Año", anos_disp, default=anos_disp)
f_empresa = sidebar_multi("Empresa", "EMPRESA")
f_dept    = sidebar_multi("Departamento", "DEPARTAMENTO")
f_tipo_salida = sidebar_multi("Tipo Salida", "TIPO_SALIDA", df_salidas)

mask_all = pd.Series([True]*len(df))
if f_ano     and "ANO_REPORTE"  in df.columns: mask_all &= df["ANO_REPORTE"].isin(f_ano)
if f_empresa and "EMPRESA"      in df.columns: mask_all &= df["EMPRESA"].isin(f_empresa)
if f_dept    and "DEPARTAMENTO" in df.columns: mask_all &= df["DEPARTAMENTO"].isin(f_dept)

dff     = df[mask_all].copy()
dff_sal = dff[dff["SITUACION"] == "I"].copy() if "SITUACION" in dff.columns else pd.DataFrame()
dff_act = dff[dff["SITUACION"] != "I"].copy() if "SITUACION" in dff.columns else dff.copy()

if f_tipo_salida and "TIPO_SALIDA" in dff_sal.columns:
    dff_sal = dff_sal[dff_sal["TIPO_SALIDA"].isin(f_tipo_salida)]

# ─── KPIs ── CAMBIO 1: tasa anual usando headcount enero como denominador ──────
total_salidas = len(dff_sal)
empresas_u    = dff["EMPRESA"].nunique() if "EMPRESA" in dff.columns else 0

# Calcular tasa anual correcta: salidas_año / headcount_enero * 100
def calcular_tasa_anual(df_filtrado, ano=None):
    """
    Tasa anual = Total salidas del año / Headcount de enero del año * 100
    Enero es el punto de partida: incluye A + I de ese mes (todos los que
    estaban ese mes, ya que los que salen en enero también aparecen ahí).
    Si se filtra por múltiples años, se calcula el promedio ponderado.
    """
    if "ANO_REPORTE" not in df_filtrado.columns or "MES_REPORTE" not in df_filtrado.columns:
        return None
    if "SITUACION" not in df_filtrado.columns:
        return None

    anos = [ano] if ano else df_filtrado["ANO_REPORTE"].unique()
    tasas = []
    for a in anos:
        df_ano = df_filtrado[df_filtrado["ANO_REPORTE"] == a]
        # Salidas del año
        salidas_ano = len(df_ano[df_ano["SITUACION"].str.strip().str.upper() == "I"])
        # Headcount enero = todas las filas del mes 1 (activos + los que salieron en enero)
        hc_enero = len(df_ano[df_ano["MES_REPORTE"] == 1])
        if hc_enero > 0 and salidas_ano > 0:
            tasas.append((salidas_ano / hc_enero * 100, salidas_ano))
    if not tasas:
        return None
    # Promedio ponderado por salidas
    total_sal = sum(t[1] for t in tasas)
    tasa_pond = sum(t[0] * t[1] for t in tasas) / total_sal if total_sal > 0 else None
    return round(tasa_pond, 1) if tasa_pond else None

tasa_anual = calcular_tasa_anual(dff)
tasa_str   = f"{tasa_anual}%" if tasa_anual is not None else "—"

vol   = len(dff_sal[dff_sal["TIPO_SALIDA"].str.contains("VOL", na=False)]) if "TIPO_SALIDA" in dff_sal.columns else 0
invol = len(dff_sal[dff_sal["TIPO_SALIDA"].str.contains("INV", na=False)]) if "TIPO_SALIDA" in dff_sal.columns else 0
perm_prom = dff_sal["MESES_PERMANENCIA"].mean() if "MESES_PERMANENCIA" in dff_sal.columns else None
perm_str  = f"{perm_prom:.1f}" if perm_prom and not np.isnan(perm_prom) else "—"

cols = st.columns(6)
for i, (lbl, val, suf) in enumerate([
    ("Total Salidas",              total_salidas, ""),
    ("Empresas",                   empresas_u,    ""),
    # CAMBIO 1: etiqueta actualizada a "anual"
    ("Tasa Rot. Anual (promedio)", tasa_str,      ""),
    ("Voluntarias",                vol,           ""),
    ("Involuntarias",              invol,         ""),
    ("Permanencia Prom.",          perm_str,      " meses"),
]):
    cols[i].markdown(metric_card(lbl, val, suf), unsafe_allow_html=True)

st.markdown("---")

# ─── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📊 Rotación General",
    "🏢 Por Empresa",
    "💼 Por Cargo / Área",
    "📅 Tendencia",
    "🚪 Entrevistas de Salida",
    "📋 Detalle"
])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — ROTACIÓN GENERAL
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    if dff_sal.empty:
        st.warning("No hay registros de salidas con los filtros aplicados.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            if "TIPO_SALIDA" in dff_sal.columns:
                ts = dff_sal["TIPO_SALIDA"].value_counts().reset_index()
                ts.columns = ["Tipo","Cantidad"]
                ts = ts[ts["Tipo"].str.upper() != "NAN"]
                st.plotly_chart(px.pie(ts, names="Tipo", values="Cantidad",
                    title="Voluntaria vs Involuntaria", hole=0.4,
                    color_discrete_sequence=COLOR_SEQ), use_container_width=True)
        with c2:
            if "MOTIVO_SALIDA" in dff_sal.columns:
                ms = dff_sal["MOTIVO_SALIDA"].value_counts().reset_index()
                ms.columns = ["Motivo","Cantidad"]
                ms = ms[ms["Motivo"].str.upper() != "NAN"].head(10)
                st.plotly_chart(px.bar(ms, x="Cantidad", y="Motivo", orientation="h",
                    title="Top 10 Motivos de Salida", color="Motivo",
                    color_discrete_sequence=COLOR_SEQ
                ).update_layout(showlegend=False), use_container_width=True)

        if "MES_REPORTE" in dff.columns:
            sal_mes = dff_sal.groupby(["ANO_REPORTE","MES_REPORTE"]).size().reset_index(name="Salidas")
            # Headcount por mes = A + I de ese mes
            hc_mes = (dff[dff["SITUACION"].str.strip().str.upper().isin(["A","I"])]
                      .groupby(["ANO_REPORTE","MES_REPORTE"]).size().reset_index(name="Headcount"))
            rot_mes = sal_mes.merge(hc_mes, on=["ANO_REPORTE","MES_REPORTE"], how="left")
            rot_mes["Tasa % (mensual)"] = (rot_mes["Salidas"] / rot_mes["Headcount"] * 100).round(2)
            rot_mes["Mes"]    = rot_mes["MES_REPORTE"].map(MESES_NOMBRE)
            rot_mes["ANO_REPORTE"] = rot_mes["ANO_REPORTE"].astype(str)
            st.plotly_chart(px.line(rot_mes, x="Mes", y="Tasa % (mensual)", color="ANO_REPORTE",
                title="Tasa de Rotación Mensual (%) — referencia por mes",
                markers=True, color_discrete_sequence=COLOR_SEQ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — POR EMPRESA
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    if "EMPRESA" not in dff.columns:
        st.warning("No se encontró columna EMPRESA.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            sal_emp = dff_sal.groupby("EMPRESA").size().reset_index(name="Salidas").sort_values("Salidas")
            st.plotly_chart(px.bar(sal_emp, x="Salidas", y="EMPRESA", orientation="h",
                title="Total Salidas por Empresa", color="EMPRESA",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)
        with c2:
            # CAMBIO 1 + 3: tasa anual por empresa usando headcount enero
            empresas_unicas = dff["EMPRESA"].dropna().unique()
            tasa_rows = []
            for emp in empresas_unicas:
                df_emp = dff[dff["EMPRESA"] == emp]
                for ano in df_emp["ANO_REPORTE"].unique():
                    df_emp_ano = df_emp[df_emp["ANO_REPORTE"] == ano]
                    salidas_ano = len(df_emp_ano[df_emp_ano["SITUACION"].str.strip().str.upper() == "I"])
                    hc_enero = len(df_emp_ano[df_emp_ano["MES_REPORTE"] == 1])
                    if hc_enero > 0:
                        tasa = round(salidas_ano / hc_enero * 100, 1)
                        tasa_rows.append({"EMPRESA": emp, "ANO": ano, "Tasa % (anual)": tasa})
            if tasa_rows:
                tasa_e = pd.DataFrame(tasa_rows)
                # Si hay múltiples años, mostrar el más reciente
                tasa_e = tasa_e.sort_values("ANO", ascending=False).drop_duplicates("EMPRESA")
                tasa_e = tasa_e.sort_values("Tasa % (anual)")
                st.plotly_chart(px.bar(tasa_e, x="Tasa % (anual)", y="EMPRESA", orientation="h",
                    # CAMBIO 1: título actualizado con "(anual)"
                    title="Tasa de Rotación Anual por Empresa (%)",
                    color="Tasa % (anual)", color_continuous_scale="RdYlGn_r",
                    # CAMBIO 1: tooltip con etiqueta anual
                    hover_data={"Tasa % (anual)": ":.1f", "EMPRESA": True}
                ).update_layout(coloraxis_showscale=False)
                 .update_traces(
                    hovertemplate="<b>%{y}</b><br>Tasa Anual: %{x:.1f}%<extra></extra>"
                 ), use_container_width=True)

        if "TIPO_SALIDA" in dff_sal.columns:
            emp_ts = dff_sal.groupby(["EMPRESA","TIPO_SALIDA"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(emp_ts, x="EMPRESA", y="n", color="TIPO_SALIDA",
                title="Tipo de Salida por Empresa", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "MESES_PERMANENCIA" in dff_sal.columns:
            perm_emp = dff_sal.groupby("EMPRESA")["MESES_PERMANENCIA"].mean().reset_index()
            perm_emp.columns = ["EMPRESA","Meses Promedio"]
            perm_emp = perm_emp.dropna().sort_values("Meses Promedio")
            st.plotly_chart(px.bar(perm_emp, x="Meses Promedio", y="EMPRESA", orientation="h",
                title="Permanencia Promedio por Empresa (meses)",
                color="Meses Promedio", color_continuous_scale="Blues"
            ).update_layout(coloraxis_showscale=False), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — POR CARGO / ÁREA
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    c1, c2 = st.columns(2)
    with c1:
        if "CARGO" in dff_sal.columns:
            cargo_sal = dff_sal.groupby("CARGO").size().reset_index(name="Salidas")
            cargo_sal = cargo_sal.sort_values("Salidas", ascending=False).head(15)
            st.plotly_chart(px.bar(cargo_sal, x="Salidas", y="CARGO", orientation="h",
                title="Top 15 Cargos con Más Rotación", color="CARGO",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)
    with c2:
        if "CARGO" in dff_sal.columns and "MESES_PERMANENCIA" in dff_sal.columns:
            perm_cargo = dff_sal.groupby("CARGO")["MESES_PERMANENCIA"].mean().reset_index()
            perm_cargo.columns = ["CARGO","Meses Promedio"]
            perm_cargo = perm_cargo.dropna().sort_values("Meses Promedio").head(15)
            st.plotly_chart(px.bar(perm_cargo, x="Meses Promedio", y="CARGO", orientation="h",
                title="Top 15 Cargos con Menor Permanencia",
                color="Meses Promedio", color_continuous_scale="RdYlGn"
            ).update_layout(coloraxis_showscale=False), use_container_width=True)

    if "AREA" in dff_sal.columns:
        c1b, c2b = st.columns(2)
        with c1b:
            area_sal = dff_sal.groupby("AREA").size().reset_index(name="Salidas").sort_values("Salidas", ascending=False).head(10)
            st.plotly_chart(px.bar(area_sal, x="Salidas", y="AREA", orientation="h",
                title="Top 10 Áreas con Más Rotación", color="AREA",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)
        with c2b:
            if "DEPARTAMENTO" in dff_sal.columns:
                dept_sal = dff_sal.groupby("DEPARTAMENTO").size().reset_index(name="Salidas").sort_values("Salidas", ascending=False).head(10)
                st.plotly_chart(px.bar(dept_sal, x="Salidas", y="DEPARTAMENTO", orientation="h",
                    title="Top 10 Departamentos con Más Rotación", color="DEPARTAMENTO",
                    color_discrete_sequence=COLOR_SEQ
                ).update_layout(showlegend=False), use_container_width=True)

    if "MESES_PERMANENCIA" in dff_sal.columns:
        st.plotly_chart(px.histogram(dff_sal.dropna(subset=["MESES_PERMANENCIA"]),
            x="MESES_PERMANENCIA", nbins=24, color_discrete_sequence=["#4C6FFF"],
            title="Distribución de Permanencia al Momento de la Salida (meses)"
        ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — TENDENCIA
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    if "ANO_REPORTE" not in dff.columns:
        st.warning("No hay datos de año disponibles.")
    else:
        sal_trend = dff_sal.groupby(["ANO_REPORTE","MES_REPORTE"]).size().reset_index(name="Salidas")
        sal_trend["Mes"] = sal_trend["MES_REPORTE"].map(MESES_NOMBRE)
        sal_trend["ANO_REPORTE"] = sal_trend["ANO_REPORTE"].astype(str)
        st.plotly_chart(px.line(sal_trend, x="Mes", y="Salidas", color="ANO_REPORTE",
            title="Tendencia de Salidas por Mes y Año", markers=True,
            color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        c1, c2 = st.columns(2)
        with c1:
            sal_ano = dff_sal.groupby("ANO_REPORTE").size().reset_index(name="Salidas")
            st.plotly_chart(px.bar(sal_ano, x="ANO_REPORTE", y="Salidas",
                title="Total Salidas por Año", color="ANO_REPORTE",
                color_discrete_sequence=COLOR_SEQ, text="Salidas"
            ).update_traces(textposition="outside").update_layout(showlegend=False), use_container_width=True)
        with c2:
            if "TIPO_SALIDA" in dff_sal.columns:
                ts_ano = dff_sal.groupby(["ANO_REPORTE","TIPO_SALIDA"]).size().reset_index(name="n")
                ts_ano["ANO_REPORTE"] = ts_ano["ANO_REPORTE"].astype(str)
                st.plotly_chart(px.bar(ts_ano, x="ANO_REPORTE", y="n", color="TIPO_SALIDA",
                    title="Tipo de Salida por Año", barmode="stack",
                    color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "EMPRESA" in dff_sal.columns:
            heat = dff_sal.groupby(["EMPRESA","MES_REPORTE"]).size().reset_index(name="Salidas")
            heat["Mes"] = heat["MES_REPORTE"].map(MESES_NOMBRE)
            st.plotly_chart(px.density_heatmap(heat, x="Mes", y="EMPRESA", z="Salidas",
                color_continuous_scale="Reds",
                title="Mapa de Calor: Salidas por Empresa y Mes"), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — ENTREVISTAS DE SALIDA
# ══════════════════════════════════════════════════════════════════════════════
with tab5:
    st.markdown("### 🚪 Entrevistas de Salida")

    uploaded_ent = st.file_uploader(
        "Subí el archivo Excel de entrevistas de salida (export de Google Forms)",
        type=["xlsx","xls"],
        accept_multiple_files=True,
        key="uploader_entrevistas"
    )

    if uploaded_ent:
        dfs_ent = []
        for f in uploaded_ent:
            try:
                xl = pd.ExcelFile(f)
                hojas = xl.sheet_names
                hoja_sel = hojas[0] if len(hojas) == 1 else st.selectbox(
                    f"📋 Hoja de **{f.name}**", options=hojas, key=f"hoja_ent_{f.name}")
                df_tmp = pd.read_excel(xl, sheet_name=hoja_sel)
                df_tmp["_archivo"] = f.name
                dfs_ent.append(df_tmp)
                st.success(f"✅ {f.name} → {len(df_tmp)} filas")
            except Exception as e:
                st.warning(f"No se pudo leer {f.name}: {e}")
        if dfs_ent:
            df_ent_raw = pd.concat(dfs_ent, ignore_index=True)
            df_ent_raw.columns = (df_ent_raw.columns.str.strip().str.upper()
                .str.replace(".", "", regex=False).str.replace(" ", "_")
                .str.replace("Á","A").str.replace("É","E").str.replace("Í","I")
                .str.replace("Ó","O").str.replace("Ú","U").str.replace("Ñ","N")
                .str.replace(",","").str.replace("(","").str.replace(")","")
                .str.replace("?","").str.replace("¿",""))

            posicion_map = {
                0:"MARCA_TEMPORAL", 1:"NOMBRE", 2:"EMPRESA", 3:"CARGO",
                4:"AREA", 5:"FECHA_INGRESO", 6:"FECHA_SALIDA", 7:"MOTIVO_PRINCIPAL",
                8:"P1_ORIENTACION", 9:"P2_CAPACITACION", 10:"P3_CRECIMIENTO",
                11:"P4_INFRAESTRUCTURA", 12:"P5_AMBIENTE", 13:"P6_SUPERVISOR",
                14:"P7_APOYO_SUPERIOR", 15:"P8_APERTURA_SUPERIOR",
                16:"P9_LO_QUE_GUSTO", 17:"P10_MEJORAS", 18:"P11_VOLVERIA",
                19:"P12_RECOMENDARIA", 20:"PUNTUACION", 21:"EMAIL",
                22:"CEDULA", 23:"BUSQUEDA_EXTERIOR", 24:"MOTIVO_SECUNDARIO", 25:"MOTIVO_OTRO"
            }
            cols_act = list(df_ent_raw.columns)
            for i, nuevo in posicion_map.items():
                if i < len(cols_act) and nuevo not in df_ent_raw.columns:
                    df_ent_raw.rename(columns={cols_act[i]: nuevo}, inplace=True)

            for col in ["NOMBRE","EMPRESA","CARGO","AREA","MOTIVO_PRINCIPAL",
                         "MOTIVO_SECUNDARIO","MOTIVO_OTRO","P11_VOLVERIA","P12_RECOMENDARIA"]:
                if col in df_ent_raw.columns:
                    df_ent_raw[col] = df_ent_raw[col].astype(str).str.strip().str.upper().replace("NAN", np.nan)

            for col in ["FECHA_INGRESO","FECHA_SALIDA","MARCA_TEMPORAL"]:
                if col in df_ent_raw.columns:
                    df_ent_raw[col] = pd.to_datetime(df_ent_raw[col], errors="coerce")
            if "FECHA_INGRESO" in df_ent_raw.columns and "FECHA_SALIDA" in df_ent_raw.columns:
                df_ent_raw["MESES_PERMANENCIA"] = ((df_ent_raw["FECHA_SALIDA"] - df_ent_raw["FECHA_INGRESO"])
                                                    .dt.days / 30.44).round(1)
            if "MARCA_TEMPORAL" in df_ent_raw.columns:
                df_ent_raw["ANO"] = df_ent_raw["MARCA_TEMPORAL"].dt.year
                df_ent_raw["MES"] = df_ent_raw["MARCA_TEMPORAL"].dt.month

            pregs_disp = [p for p in PREGUNTAS.keys() if p in df_ent_raw.columns]
            for p in pregs_disp:
                df_ent_raw[p] = pd.to_numeric(df_ent_raw[p], errors="coerce")
            if pregs_disp:
                df_ent_raw["SCORE_PROMEDIO"] = df_ent_raw[pregs_disp].mean(axis=1).round(2)

            if "MOTIVO_PRINCIPAL" in df_ent_raw.columns:
                motivos_u = tuple(df_ent_raw["MOTIVO_PRINCIPAL"].dropna().unique())
                if motivos_u:
                    with st.spinner("🤖 Categorizando motivos con IA..."):
                        mapa_cat = categorizar_motivos_ia(motivos_u)
                    df_ent_raw["MOTIVO_CATEGORIA"] = df_ent_raw["MOTIVO_PRINCIPAL"].map(mapa_cat).fillna("Otro")

            st.session_state["df_entrevistas"] = df_ent_raw

    if "df_entrevistas" not in st.session_state:
        st.info("📂 Subí el archivo de entrevistas de salida para ver el análisis.")
    else:
        de = st.session_state["df_entrevistas"].copy()

        if st.button("🗑️ Limpiar datos de Entrevistas"):
            del st.session_state["df_entrevistas"]
            st.rerun()

        st.sidebar.markdown("---")
        st.sidebar.header("🔍 Filtros Entrevistas")
        def ent_multi(label, col):
            if col in de.columns:
                opts = sorted(de[col].dropna().unique().tolist())
                return st.sidebar.multiselect(label, opts, default=opts, key=f"ef_{col}")
            return None

        ef_empresa = ent_multi("Empresa (Entrev.)", "EMPRESA")
        ef_area    = ent_multi("Área (Entrev.)", "AREA")
        ef_categ   = ent_multi("Categoría Motivo", "MOTIVO_CATEGORIA")
        ef_ano     = ent_multi("Año (Entrev.)", "ANO")

        mask_e = pd.Series([True]*len(de))
        if ef_empresa and "EMPRESA"          in de.columns: mask_e &= de["EMPRESA"].isin(ef_empresa)
        if ef_area    and "AREA"             in de.columns: mask_e &= de["AREA"].isin(ef_area)
        if ef_categ   and "MOTIVO_CATEGORIA" in de.columns: mask_e &= de["MOTIVO_CATEGORIA"].isin(ef_categ)
        if ef_ano     and "ANO"              in de.columns: mask_e &= de["ANO"].isin(ef_ano)
        de = de[mask_e].copy()

        if de.empty:
            st.warning("No hay datos con los filtros seleccionados.")
        else:
            pregs_disp = [p for p in PREGUNTAS.keys() if p in de.columns]

            total_e    = len(de)
            emp_u      = de["EMPRESA"].nunique() if "EMPRESA" in de.columns else "—"
            perm_e     = de["MESES_PERMANENCIA"].mean() if "MESES_PERMANENCIA" in de.columns else None
            perm_e_str = f"{perm_e:.1f}" if perm_e and not np.isnan(perm_e) else "—"
            pct_vol = pct_rec = "—"
            if "P11_VOLVERIA" in de.columns:
                vol_si  = de["P11_VOLVERIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
                pct_vol = f"{vol_si/total_e*100:.0f}%" if total_e > 0 else "—"
            if "P12_RECOMENDARIA" in de.columns:
                rec_si  = de["P12_RECOMENDARIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
                pct_rec = f"{rec_si/total_e*100:.0f}%" if total_e > 0 else "—"

            kpi_cols = st.columns(5)
            for i, (lbl, val, suf) in enumerate([
                ("Entrevistas",           total_e,      ""),
                ("Empresas",              emp_u,         ""),
                ("Perm. Promedio",        perm_e_str,    " meses"),
                ("Volvería a trabajar",   pct_vol,       ""),
                ("Recomendaría Texo",     pct_rec,       ""),
            ]):
                kpi_cols[i].markdown(metric_card(lbl, val, suf), unsafe_allow_html=True)

            st.markdown("---")

            st_e1, st_e2, st_e3, st_e4 = st.tabs([
                "📉 Motivos", "🏢 Por Empresa", "⭐ Satisfacción", "📋 Detalle"
            ])

            with st_e1:
                if "MOTIVO_CATEGORIA" in de.columns:
                    c1, c2 = st.columns(2)
                    with c1:
                        cat = de["MOTIVO_CATEGORIA"].value_counts().reset_index()
                        cat.columns = ["Categoría","Cantidad"]
                        st.plotly_chart(px.bar(cat, x="Cantidad", y="Categoría", orientation="h",
                            title="Categorías de Motivos (agrupadas por IA)", color="Categoría",
                            color_discrete_sequence=COLOR_SEQ
                        ).update_layout(showlegend=False), use_container_width=True)
                    with c2:
                        st.plotly_chart(px.pie(cat, names="Categoría", values="Cantidad",
                            title="Distribución de Categorías", hole=0.4,
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)
                    if "ANO" in de.columns:
                        cat_ano = de.groupby(["ANO","MOTIVO_CATEGORIA"]).size().reset_index(name="n")
                        cat_ano["ANO"] = cat_ano["ANO"].astype(str)
                        st.plotly_chart(px.bar(cat_ano, x="ANO", y="n", color="MOTIVO_CATEGORIA",
                            title="Evolución de Motivos por Año", barmode="stack",
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)
                    with st.expander("Ver motivos originales sin agrupar"):
                        if "MOTIVO_PRINCIPAL" in de.columns:
                            mot = de["MOTIVO_PRINCIPAL"].value_counts().reset_index()
                            mot.columns = ["Motivo","Cantidad"]
                            st.plotly_chart(px.bar(mot, x="Cantidad", y="Motivo", orientation="h",
                                title="Motivos Originales", color="Motivo",
                                color_discrete_sequence=COLOR_SEQ
                            ).update_layout(showlegend=False), use_container_width=True)

            with st_e2:
                if "EMPRESA" in de.columns:
                    c1, c2 = st.columns(2)
                    with c1:
                        emp = de.groupby("EMPRESA").size().reset_index(name="Salidas").sort_values("Salidas")
                        st.plotly_chart(px.bar(emp, x="Salidas", y="EMPRESA", orientation="h",
                            title="Salidas por Empresa", color="EMPRESA",
                            color_discrete_sequence=COLOR_SEQ
                        ).update_layout(showlegend=False), use_container_width=True)
                    with c2:
                        if "SCORE_PROMEDIO" in de.columns:
                            emp_s = de.groupby("EMPRESA")["SCORE_PROMEDIO"].mean().reset_index()
                            emp_s.columns = ["EMPRESA","Puntuación Entrevista"]
                            emp_s = emp_s.dropna().sort_values("Puntuación Entrevista")
                            st.plotly_chart(px.bar(emp_s, x="Puntuación Entrevista", y="EMPRESA", orientation="h",
                                title="Puntuación Entrevista de Salida por Empresa (1-5)",
                                color="Puntuación Entrevista", color_continuous_scale="RdYlGn", range_color=[1,5]
                            ).update_layout(coloraxis_showscale=True), use_container_width=True)
                    if "MOTIVO_CATEGORIA" in de.columns:
                        emp_cat = de.groupby(["EMPRESA","MOTIVO_CATEGORIA"]).size().reset_index(name="n")
                        st.plotly_chart(px.bar(emp_cat, x="EMPRESA", y="n", color="MOTIVO_CATEGORIA",
                            title="Motivos por Empresa", barmode="stack",
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)
                    if "ANO" in de.columns:
                        emp_ano = de.groupby(["ANO","EMPRESA"]).size().reset_index(name="Salidas")
                        emp_ano["ANO"] = emp_ano["ANO"].astype(str)
                        st.plotly_chart(px.line(emp_ano, x="ANO", y="Salidas", color="EMPRESA",
                            title="Evolución de Salidas por Empresa", markers=True,
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)
                    if "P11_VOLVERIA" in de.columns:
                        vol_emp = de.groupby(["EMPRESA","P11_VOLVERIA"]).size().reset_index(name="n")
                        st.plotly_chart(px.bar(vol_emp, x="EMPRESA", y="n", color="P11_VOLVERIA",
                            title="¿Volvería a trabajar? por Empresa", barmode="stack",
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)

            with st_e3:
                if not pregs_disp:
                    st.warning("No se encontraron columnas de satisfacción.")
                else:
                    prom_pregs = {PREGUNTAS[p]: round(de[p].mean(), 2) for p in pregs_disp if p in de.columns}
                    df_prom    = pd.DataFrame(list(prom_pregs.items()), columns=["Dimensión","Promedio"]).sort_values("Promedio")
                    with st.spinner("🤖 Analizando con IA..."):
                        insight = interpretar_satisfaccion_ia(json.dumps(prom_pregs, ensure_ascii=False, indent=2))
                    st.info(f"🤖 **Análisis ejecutivo por IA:**\n\n{insight}")
                    st.markdown("---")
                    c1, c2 = st.columns(2)
                    with c1:
                        fig_radar = go.Figure()
                        fig_radar.add_trace(go.Scatterpolar(
                            r=df_prom["Promedio"].tolist(),
                            theta=df_prom["Dimensión"].tolist(),
                            fill="toself", name="Puntuación", line_color="#4C6FFF"
                        ))
                        fig_radar.update_layout(
                            polar=dict(radialaxis=dict(visible=True, range=[0,5])),
                            title="Radar de Puntuación Entrevista de Salida (1-5)",
                            paper_bgcolor="#0e1117", font_color="#e8eaf0"
                        )
                        st.plotly_chart(fig_radar, use_container_width=True)
                    with c2:
                        st.plotly_chart(px.bar(df_prom, x="Promedio", y="Dimensión", orientation="h",
                            title="Promedio por Dimensión (Entrevista de Salida)",
                            color="Promedio", color_continuous_scale="RdYlGn", range_color=[1,5]
                        ).update_layout(coloraxis_showscale=True), use_container_width=True)

                    if "EMPRESA" in de.columns:
                        emp_pregs = de.groupby("EMPRESA")[pregs_disp].mean().reset_index()
                        emp_melt  = emp_pregs.melt(id_vars="EMPRESA", var_name="Pregunta", value_name="Promedio")
                        emp_melt["Pregunta"] = emp_melt["Pregunta"].map(PREGUNTAS)
                        st.plotly_chart(px.bar(emp_melt.dropna(), x="Promedio", y="Pregunta",
                            color="EMPRESA", barmode="group", orientation="h",
                            title="Puntuación por Dimensión y Empresa",
                            color_discrete_sequence=COLOR_SEQ), use_container_width=True)

                    st.markdown("#### 💬 Comentarios abiertos")
                    for col, titulo in [("P9_LO_QUE_GUSTO","¿Qué fue lo que más te gustó?"),
                                         ("P10_MEJORAS","¿Qué deberíamos mejorar?")]:
                        if col in de.columns:
                            st.markdown(f"**{titulo}**")
                            com = de[[c for c in ["NOMBRE","EMPRESA","CARGO",col] if c in de.columns]].dropna(subset=[col])
                            com = com[com[col].str.upper() != "NAN"]
                            st.dataframe(com.rename(columns={col:"Comentario"}), use_container_width=True, height=200)

            with st_e4:
                st.markdown(f"**{len(de)} registros** con los filtros aplicados")
                show_cols_e = [c for c in ["NOMBRE","EMPRESA","CARGO","AREA","FECHA_INGRESO",
                                            "FECHA_SALIDA","MESES_PERMANENCIA","MOTIVO_PRINCIPAL",
                                            "MOTIVO_CATEGORIA","SCORE_PROMEDIO",
                                            "P11_VOLVERIA","P12_RECOMENDARIA","ANO"] if c in de.columns]
                st.dataframe(de[show_cols_e], use_container_width=True, height=500)
                csv_e = de[show_cols_e].to_csv(index=False).encode("utf-8")
                st.download_button("⬇️ Descargar entrevistas (.csv)", csv_e, "entrevistas_salida.csv", "text/csv")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 6 — DETALLE ROTACIÓN
# ══════════════════════════════════════════════════════════════════════════════
with tab6:
    st.markdown(f"**{len(dff_sal)} salidas** registradas con los filtros aplicados")
    show_cols = [c for c in ["EMPRESA","NOMBRE","CARGO","AREA","DEPARTAMENTO",
                              "FECHA_INGRESO","FECHA_SALIDA","MESES_PERMANENCIA",
                              "MOTIVO_SALIDA","TIPO_SALIDA","SALARIO",
                              "MES_NOMBRE","ANO_REPORTE"] if c in dff_sal.columns]
    if not dff_sal.empty:
        st.dataframe(dff_sal[show_cols], use_container_width=True, height=500)
        csv = dff_sal[show_cols].to_csv(index=False).encode("utf-8")
        st.download_button("⬇️ Descargar salidas (.csv)", csv, "rotacion_salidas.csv", "text/csv")
    else:
        st.info("No hay registros de salidas con los filtros aplicados.")