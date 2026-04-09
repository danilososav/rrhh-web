import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import os
import json
import re
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from datetime import date

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

st.set_page_config(page_title="Nómina | Texo RRHH", layout="wide", page_icon="👥")

# ─── Logo ──────────────────────────────────────────────────────────────────────
logo_path = Path("images/logo.jpg")
if logo_path.exists():
    st.sidebar.image(str(logo_path), width=220)
else:
    st.sidebar.markdown("### 👥 RRHH · Texo")

# ─── Estilos ───────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .metric-card {
        background: #1a1f2e; border-radius: 12px; padding: 20px;
        text-align: center; border-left: 4px solid #4C6FFF; margin-bottom: 8px;
    }
    .metric-card.success { background: #1a2a1a; border-left: 4px solid #00C853; }
    .metric-card.warn    { background: #2a2210; border-left: 4px solid #FFB300; }
    .metric-card.danger  { background: #2a1a1a; border-left: 4px solid #FF4C4C; }
    .metric-value { font-size: 2rem; font-weight: 700; color: #4C6FFF; }
    .metric-card.success .metric-value { color: #00C853; }
    .metric-card.warn    .metric-value { color: #FFB300; }
    .metric-card.danger  .metric-value { color: #FF4C4C; }
    .metric-label { font-size: 0.85rem; color: #aaa; margin-top: 4px; }
</style>
""", unsafe_allow_html=True)

def mc(label, value, suffix="", style=""):
    cls = f"metric-card {style}".strip()
    return f"""<div class="{cls}">
        <div class="metric-value">{value}{suffix}</div>
        <div class="metric-label">{label}</div>
    </div>"""

COLOR_SEQ = px.colors.qualitative.Bold

# ─── Mapeo columnas ────────────────────────────────────────────────────────────
COL_MAP = {
    "SITUACION": "SITUACION", "SITUACIÓN": "SITUACION",
    "CODIGO": "CODIGO", "CÓDIGO": "CODIGO",
    "RAZON_SOCIAL": "NOMBRE", "RAZÓN_SOCIAL": "NOMBRE",
    "RAZON SOCIAL": "NOMBRE", "RAZÓN SOCIAL": "NOMBRE",
    "DOC_DE_IDENTIDAD": "CEDULA", "DOC DE IDENTIDAD": "CEDULA", "DOCUMENTO": "CEDULA",
    "CARGO": "CARGO",
    "SECCION": "SECCION", "SECCIÓN": "SECCION",
    "DEPARTAMENTO": "DEPARTAMENTO",
    "AREA": "AREA", "ÁREA": "AREA",
    "CENTRO_DE_COSTO": "CENTRO_COSTO", "CENTRO DE COSTO": "CENTRO_COSTO",
    "SALARIO": "SALARIO",
    "IPS": "IPS",
    "FECHA_INGRESO": "FECHA_INGRESO", "FECHA INGRESO": "FECHA_INGRESO",
    "FECHA_ANTIGUEDAD": "FECHA_ANTIGUEDAD", "FECHA ANTIGÜEDAD": "FECHA_ANTIGUEDAD",
    "ANTIGUEDAD": "ANTIGUEDAD", "ANTIGÜEDAD": "ANTIGUEDAD",
    "TIPO_DE_PAGO_IRP": "TIPO_PAGO", "TIPO DE PAGO IRP": "TIPO_PAGO",
    "FECHA_SALIDA": "FECHA_SALIDA", "FECHA SALIDA": "FECHA_SALIDA",
    "MOTIVO_SALIDA": "MOTIVO_SALIDA", "MOTIVO SALIDA": "MOTIVO_SALIDA",
    "NIVEL_AIC": "NIVEL_AIC", "NIVEL AIC": "NIVEL_AIC",
    "FECHA_DE_NACIMIENTO": "FECHA_NACIMIENTO",
    "FECHA DE NACIMIENTO": "FECHA_NACIMIENTO",
    "NACIONALIDAD": "NACIONALIDAD",
}

NIVELES_LIDER = ["SENIOR", "INTERMEDIO"]

GENERACIONES = [
    ("Baby Boomers",  1945, 1964),
    ("Generación X",  1965, 1981),
    ("Millennials",   1982, 1996),
    ("Generación Z",  1997, 2012),
]

# ─── Inferir sexo con IA ───────────────────────────────────────────────────────
def limpiar_nombre(n):
    return str(n).replace('"', '').replace("'", "").replace("\n", " ").strip()

def inferir_sexo_lote(nombres_limpios: list) -> dict:
    """Infiere sexo para un lote de nombres (máx 50)."""
    lista = "\n".join(f"- {n}" for n in nombres_limpios)
    prompt = f"""Tenés una lista de nombres completos de personas de Paraguay/Latinoamérica.
Para cada nombre, determiná si es MASCULINO (M) o FEMENINO (F) basándote en el primer nombre.
En caso de duda usá M.

NOMBRES:
{lista}

Respondé ÚNICAMENTE con un JSON válido. Clave = nombre exacto, valor = "M" o "F".
Sin explicaciones, sin markdown, solo el JSON."""
    r = client.messages.create(
        model="claude-sonnet-4-20250514", max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    texto = re.sub(r"```json|```", "", r.content[0].text.strip()).strip()
    return json.loads(texto)

@st.cache_data(show_spinner=False)
def inferir_sexo_ia(nombres: tuple) -> dict:
    resultado = {}
    lote_size = 50
    nombres_list = list(nombres)
    limpios_list  = [limpiar_nombre(n) for n in nombres_list]

    for i in range(0, len(nombres_list), lote_size):
        orig_lote   = nombres_list[i:i+lote_size]
        limpio_lote = limpios_list[i:i+lote_size]
        try:
            mapa = inferir_sexo_lote(limpio_lote)
            for orig, limpio in zip(orig_lote, limpio_lote):
                resultado[orig] = mapa.get(limpio, "M")
        except Exception as e:
            st.warning(f"Error en lote {i//lote_size + 1}: {e}")
            for orig in orig_lote:
                resultado[orig] = "M"
    return resultado

# ─── Calcular generación ───────────────────────────────────────────────────────
def calcular_generacion(fecha_nac):
    try:
        anio = pd.to_datetime(fecha_nac).year
        for nombre, ini, fin in GENERACIONES:
            if ini <= anio <= fin:
                return nombre
        return "Otra"
    except:
        return None

def calcular_edad(fecha_nac):
    try:
        fn = pd.to_datetime(fecha_nac)
        hoy = pd.Timestamp(date.today())
        return int((hoy - fn).days / 365.25)
    except:
        return None

# ─── Normalizar DataFrame ──────────────────────────────────────────────────────
def normalizar_nomina(df_raw: pd.DataFrame) -> pd.DataFrame:
    df = df_raw.copy()
    # Renombrar primera columna como EMPRESA
    df.rename(columns={df.columns[0]: "EMPRESA"}, inplace=True)
    # Normalizar nombres de columnas
    df.columns = (
        df.columns.str.strip().str.upper()
        .str.replace("Á", "A").str.replace("É", "E")
        .str.replace("Í", "I").str.replace("Ó", "O")
        .str.replace("Ú", "U").str.replace("Ñ", "N")
    )
    # Mapear columnas conocidas
    rename_map = {}
    for col in df.columns:
        col_norm = col.strip()
        if col_norm in COL_MAP:
            rename_map[col] = COL_MAP[col_norm]
    df.rename(columns=rename_map, inplace=True)

    # Limpiar strings
    for col in ["EMPRESA", "SITUACION", "NOMBRE", "CARGO", "AREA",
                "DEPARTAMENTO", "SECCION", "NIVEL_AIC", "NACIONALIDAD",
                "MOTIVO_SALIDA", "TIPO_PAGO"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper().replace("NAN", np.nan)

    # Fechas
    for col in ["FECHA_INGRESO", "FECHA_SALIDA", "FECHA_NACIMIENTO", "FECHA_ANTIGUEDAD"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Salario numérico
    if "SALARIO" in df.columns:
        df["SALARIO"] = pd.to_numeric(df["SALARIO"], errors="coerce")

    # Filtrar solo activos
    if "SITUACION" in df.columns:
        df = df[df["SITUACION"].str.strip().str.upper() == "A"].copy()

    # Columna LIDER
    if "NIVEL_AIC" in df.columns:
        df["LIDER"] = df["NIVEL_AIC"].apply(
            lambda x: "SI" if str(x).strip().upper() in NIVELES_LIDER else "NO"
        )

    # Columna GENERACION y EDAD
    if "FECHA_NACIMIENTO" in df.columns:
        df["GENERACION"] = df["FECHA_NACIMIENTO"].apply(calcular_generacion)
        df["EDAD"]       = df["FECHA_NACIMIENTO"].apply(calcular_edad)

    # Antigüedad en años desde fecha ingreso
    if "FECHA_INGRESO" in df.columns:
        hoy = pd.Timestamp(date.today())
        df["ANTIGUEDAD_ANOS"] = ((hoy - df["FECHA_INGRESO"]).dt.days / 365.25).round(1)

    return df

# ══════════════════════════════════════════════════════════════════════════════
# CARGA DE DATOS
# ══════════════════════════════════════════════════════════════════════════════
st.title("👥 Nómina")

uploaded = st.file_uploader(
    "Subí el archivo Excel de nómina",
    type=["xlsx", "xls"],
    accept_multiple_files=False,
    key="uploader_nomina"
)

if uploaded:
    try:
        xl = pd.ExcelFile(uploaded)
        hojas = xl.sheet_names
        hoja_sel = hojas[0] if len(hojas) == 1 else st.selectbox("Seleccioná la hoja", hojas)
        df_raw = pd.read_excel(xl, sheet_name=hoja_sel)

        with st.spinner("🔄 Procesando nómina..."):
            df_nom = normalizar_nomina(df_raw)

        # Inferir sexo con IA
        if "NOMBRE" in df_nom.columns:
            nombres_u = tuple(df_nom["NOMBRE"].dropna().unique())
            if nombres_u:
                with st.spinner(f"🤖 Infiriendo sexo de {len(nombres_u)} colaboradores con IA..."):
                    mapa_sexo = inferir_sexo_ia(nombres_u)
                df_nom["SEXO"] = df_nom["NOMBRE"].map(mapa_sexo).fillna("M")

        # Reset índice para evitar IndexingError en filtros
        df_nom = df_nom.reset_index(drop=True)
        st.session_state["df_nomina"] = df_nom
        st.success(f"✅ Nómina cargada: {len(df_nom)} colaboradores activos")

    except Exception as e:
        st.error(f"Error al procesar el archivo: {e}")

if st.sidebar.button("🗑️ Limpiar datos de Nómina"):
    if "df_nomina" in st.session_state:
        del st.session_state["df_nomina"]
        st.rerun()

if "df_nomina" not in st.session_state:
    st.info("📂 Subí un archivo Excel de nómina para comenzar.")
    st.stop()

df = st.session_state["df_nomina"].copy()

# ─── Filtros sidebar ───────────────────────────────────────────────────────────
st.sidebar.header("🔍 Filtros Nómina")

def sf_multi(label, col, key=None):
    if col in df.columns:
        opts = sorted(df[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts, key=key or f"fn_{col}")
    return None

f_empresa = sf_multi("Empresa", "EMPRESA")
f_nivel   = sf_multi("Nivel AIC", "NIVEL_AIC")
f_lider   = sf_multi("Líder", "LIDER")

mask = pd.Series([True] * len(df))
if f_empresa and "EMPRESA"   in df.columns: mask &= df["EMPRESA"].isin(f_empresa)
if f_nivel   and "NIVEL_AIC" in df.columns: mask &= df["NIVEL_AIC"].isin(f_nivel)
if f_lider   and "LIDER"     in df.columns: mask &= df["LIDER"].isin(f_lider)
dff = df[mask].copy()

# ══════════════════════════════════════════════════════════════════════════════
# KPIs
# ══════════════════════════════════════════════════════════════════════════════
total       = len(dff)
empresas_u  = dff["EMPRESA"].nunique() if "EMPRESA" in dff.columns else "—"
lideres     = (dff["LIDER"] == "SI").sum() if "LIDER" in dff.columns else "—"
pct_f       = f"{(dff['SEXO']=='F').sum()/total*100:.1f}%" if "SEXO" in dff.columns and total > 0 else "—"
pct_ext     = f"{(dff['NACIONALIDAD'].str.upper()!='PARAGUAYA').sum()/total*100:.1f}%" if "NACIONALIDAD" in dff.columns and total > 0 else "—"
sal_prom    = dff["SALARIO"].mean() if "SALARIO" in dff.columns else None
sal_str     = f"{sal_prom:,.0f}" if sal_prom and not np.isnan(sal_prom) else "—"

cols = st.columns(6)
for i, (lbl, val, suf, sty) in enumerate([
    ("Colaboradores Activos", total,      "",    "success"),
    ("Empresas",              empresas_u, "",    ""),
    ("Líderes",               lideres,    "",    ""),
    ("% Mujeres",             pct_f,      "",    ""),
    ("% Extranjeros",         pct_ext,    "",    ""),
    ("Salario Promedio (Gs)", sal_str,    "",    "warn"),
]):
    cols[i].markdown(mc(lbl, val, suf, sty), unsafe_allow_html=True)

st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
# TABS
# ══════════════════════════════════════════════════════════════════════════════
tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "🏢 Por Empresa",
    "⚧ Género",
    "🏆 Liderazgo",
    "🌍 Nacionalidad",
    "📅 Generaciones",
    "💰 Salarios",
    "📋 Detalle",
])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — POR EMPRESA
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    if "EMPRESA" not in dff.columns:
        st.warning("No se encontró columna EMPRESA.")
    else:
        emp_count = dff.groupby("EMPRESA").size().reset_index(name="Colaboradores").sort_values("Colaboradores", ascending=False)
        st.plotly_chart(px.bar(emp_count, x="EMPRESA", y="Colaboradores",
            title="Colaboradores Activos por Empresa",
            color="EMPRESA", color_discrete_sequence=COLOR_SEQ, text="Colaboradores"
        ).update_traces(textposition="outside").update_layout(showlegend=False),
        use_container_width=True)

        if "NIVEL_AIC" in dff.columns:
            emp_nivel = dff.groupby(["EMPRESA","NIVEL_AIC"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(emp_nivel, x="EMPRESA", y="n", color="NIVEL_AIC",
                title="Distribución por Nivel AIC y Empresa", barmode="stack",
                color_discrete_sequence=COLOR_SEQ),
            use_container_width=True)

        if "ANTIGUEDAD_ANOS" in dff.columns:
            ant_emp = dff.groupby("EMPRESA")["ANTIGUEDAD_ANOS"].mean().reset_index()
            ant_emp.columns = ["EMPRESA", "Antigüedad Promedio (años)"]
            ant_emp = ant_emp.sort_values("Antigüedad Promedio (años)", ascending=False)
            st.plotly_chart(px.bar(ant_emp, x="EMPRESA", y="Antigüedad Promedio (años)",
                title="Antigüedad Promedio por Empresa (años)",
                color="EMPRESA", color_discrete_sequence=COLOR_SEQ, text_auto=".1f"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — GÉNERO
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    if "SEXO" not in dff.columns:
        st.warning("No se encontró columna SEXO.")
    else:
        total_f = (dff["SEXO"] == "F").sum()
        total_m = (dff["SEXO"] == "M").sum()
        c1, c2, c3 = st.columns(3)
        c1.markdown(mc("👩 Mujeres", total_f, f" ({total_f/total*100:.1f}%)", ""), unsafe_allow_html=True)
        c2.markdown(mc("👨 Hombres", total_m, f" ({total_m/total*100:.1f}%)", ""), unsafe_allow_html=True)
        c3.markdown(mc("Total", total, "", "success"), unsafe_allow_html=True)
        st.markdown("---")

        c1, c2 = st.columns(2)
        with c1:
            sex_dist = dff["SEXO"].value_counts().reset_index()
            sex_dist.columns = ["Sexo","Cantidad"]
            sex_dist["Sexo"] = sex_dist["Sexo"].map({"F":"Mujeres","M":"Hombres"})
            st.plotly_chart(px.pie(sex_dist, names="Sexo", values="Cantidad",
                title="Distribución por Sexo", hole=0.4,
                color="Sexo", color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
            use_container_width=True)
        with c2:
            if "EMPRESA" in dff.columns:
                emp_sex = dff.groupby(["EMPRESA","SEXO"]).size().reset_index(name="n")
                emp_sex["SEXO"] = emp_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                st.plotly_chart(px.bar(emp_sex, x="EMPRESA", y="n", color="SEXO",
                    title="Distribución por Sexo y Empresa", barmode="stack",
                    color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                use_container_width=True)

        if "NIVEL_AIC" in dff.columns:
            nivel_sex = dff.groupby(["NIVEL_AIC","SEXO"]).size().reset_index(name="n")
            nivel_sex["SEXO"] = nivel_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
            st.plotly_chart(px.bar(nivel_sex, x="n", y="NIVEL_AIC", color="SEXO",
                title="Distribución por Sexo y Nivel AIC", barmode="group", orientation="h",
                color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
            use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — LIDERAZGO
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    if "LIDER" not in dff.columns:
        st.warning("No se encontró columna LIDER.")
    else:
        lideres_df = dff[dff["LIDER"] == "SI"]
        total_lid  = len(lideres_df)
        pct_lid    = total_lid / total * 100 if total > 0 else 0

        c1, c2, c3 = st.columns(3)
        c1.markdown(mc("👑 Total Líderes", total_lid, "", "warn"), unsafe_allow_html=True)
        c2.markdown(mc("% del Total", f"{pct_lid:.1f}", "%", ""), unsafe_allow_html=True)

        if "SEXO" in lideres_df.columns:
            lid_f = (lideres_df["SEXO"] == "F").sum()
            lid_m = (lideres_df["SEXO"] == "M").sum()
            pct_lid_f = lid_f / total_lid * 100 if total_lid > 0 else 0
            pct_lid_m = lid_m / total_lid * 100 if total_lid > 0 else 0
            c3.markdown(mc("Mujeres Líderes", f"{pct_lid_f:.0f}", "%", ""), unsafe_allow_html=True)

            st.markdown("---")
            c1, c2 = st.columns(2)
            with c1:
                lid_sex = pd.DataFrame({"Sexo":["Mujeres","Hombres"], "Cantidad":[lid_f, lid_m]})
                st.plotly_chart(px.bar(lid_sex, x="Sexo", y="Cantidad",
                    title=f"Liderazgo por Sexo — Mujeres {pct_lid_f:.0f}% / Hombres {pct_lid_m:.0f}%",
                    color="Sexo", color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"},
                    text="Cantidad"
                ).update_traces(textposition="outside").update_layout(showlegend=False),
                use_container_width=True)
            with c2:
                if "NIVEL_AIC" in lideres_df.columns and "SEXO" in lideres_df.columns:
                    niv_sex = lideres_df.groupby(["NIVEL_AIC","SEXO"]).size().reset_index(name="n")
                    niv_sex["SEXO"] = niv_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                    st.plotly_chart(px.bar(niv_sex, x="n", y="NIVEL_AIC", color="SEXO",
                        title="Líderes por Nivel AIC y Sexo", barmode="group", orientation="h",
                        color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                    use_container_width=True)

        if "EMPRESA" in lideres_df.columns:
            lid_emp = lideres_df.groupby("EMPRESA").size().reset_index(name="Líderes")
            tot_emp = dff.groupby("EMPRESA").size().reset_index(name="Total")
            lid_emp = lid_emp.merge(tot_emp, on="EMPRESA")
            lid_emp["% Líderes"] = (lid_emp["Líderes"] / lid_emp["Total"] * 100).round(1)
            st.plotly_chart(px.bar(lid_emp.sort_values("% Líderes", ascending=False),
                x="EMPRESA", y="% Líderes", title="% Líderes por Empresa",
                color="EMPRESA", color_discrete_sequence=COLOR_SEQ, text="% Líderes"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — NACIONALIDAD
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    if "NACIONALIDAD" not in dff.columns:
        st.warning("No se encontró columna NACIONALIDAD.")
    else:
        dff["ES_PARAGUAYO"] = dff["NACIONALIDAD"].str.upper().str.contains("PARAGUAY", na=False)
        total_ext  = (~dff["ES_PARAGUAYO"]).sum()
        total_par  = dff["ES_PARAGUAYO"].sum()

        c1, c2, c3 = st.columns(3)
        c1.markdown(mc("🌍 Extranjeros", total_ext, "", "warn"), unsafe_allow_html=True)
        c2.markdown(mc("🇵🇾 Paraguayos", total_par, "", "success"), unsafe_allow_html=True)
        c3.markdown(mc("% Extranjeros", f"{total_ext/total*100:.1f}", "%", ""), unsafe_allow_html=True)
        st.markdown("---")

        c1, c2 = st.columns(2)
        with c1:
            nac_count = dff[~dff["ES_PARAGUAYO"]]["NACIONALIDAD"].value_counts().reset_index()
            nac_count.columns = ["Nacionalidad","Cantidad"]
            if not nac_count.empty:
                st.plotly_chart(px.bar(nac_count, x="Cantidad", y="Nacionalidad",
                    title="Extranjeros por Nacionalidad", orientation="h",
                    color="Nacionalidad", color_discrete_sequence=COLOR_SEQ, text="Cantidad"
                ).update_traces(textposition="outside").update_layout(showlegend=False),
                use_container_width=True)
        with c2:
            pie_nac = pd.DataFrame({
                "Grupo": ["Paraguayos","Extranjeros"],
                "Cantidad": [total_par, total_ext]
            })
            st.plotly_chart(px.pie(pie_nac, names="Grupo", values="Cantidad",
                title="Paraguayos vs Extranjeros", hole=0.4,
                color_discrete_sequence=["#a0a0a0","#4C6FFF"]),
            use_container_width=True)

        if "EMPRESA" in dff.columns:
            ext_emp = dff[~dff["ES_PARAGUAYO"]].groupby("EMPRESA").size().reset_index(name="Extranjeros")
            if not ext_emp.empty:
                st.plotly_chart(px.bar(ext_emp.sort_values("Extranjeros", ascending=False),
                    x="EMPRESA", y="Extranjeros", title="Extranjeros por Empresa",
                    color="EMPRESA", color_discrete_sequence=COLOR_SEQ, text="Extranjeros"
                ).update_traces(textposition="outside").update_layout(showlegend=False),
                use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — GENERACIONES
# ══════════════════════════════════════════════════════════════════════════════
with tab5:
    if "GENERACION" not in dff.columns:
        st.warning("No se encontró columna Fecha de Nacimiento para calcular generaciones.")
    else:
        orden_gen = ["Baby Boomers","Generación X","Millennials","Generación Z","Otra"]
        gen_count = dff["GENERACION"].value_counts().reindex(orden_gen).dropna().reset_index()
        gen_count.columns = ["Generación","Cantidad"]

        # KPIs generacionales
        if not gen_count.empty:
            top_gen = gen_count.iloc[0]
            pct_top = top_gen["Cantidad"] / total * 100

        c1, c2 = st.columns(2)
        with c1:
            rangos = {"Baby Boomers":"1945–1964","Generación X":"1965–1981",
                      "Millennials":"1982–1996","Generación Z":"1997–2012"}
            gen_count["Rango"] = gen_count["Generación"].map(rangos).fillna("")
            gen_count["Label"] = gen_count["Generación"] + "<br>" + gen_count["Rango"]
            fig_gen = px.bar(gen_count, x="Generación", y="Cantidad",
                title=f"Brecha Generacional — {len(gen_count)} generaciones conviven",
                color="Generación", color_discrete_sequence=COLOR_SEQ,
                text="Cantidad")
            fig_gen.update_traces(textposition="outside")
            fig_gen.update_layout(showlegend=False)
            st.plotly_chart(fig_gen, use_container_width=True)

        with c2:
            if "SEXO" in dff.columns:
                gen_sex = dff.groupby(["GENERACION","SEXO"]).size().reset_index(name="n")
                gen_sex["SEXO"] = gen_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                gen_ord = [g for g in orden_gen if g in gen_sex["GENERACION"].unique()]
                st.plotly_chart(px.bar(gen_sex, x="n", y="GENERACION", color="SEXO",
                    title="Generaciones por Sexo", barmode="group", orientation="h",
                    category_orders={"GENERACION": gen_ord},
                    color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                use_container_width=True)

        if "EMPRESA" in dff.columns:
            gen_emp = dff.groupby(["EMPRESA","GENERACION"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(gen_emp, x="EMPRESA", y="n", color="GENERACION",
                title="Generaciones por Empresa", barmode="stack",
                color_discrete_sequence=COLOR_SEQ),
            use_container_width=True)

        if "EDAD" in dff.columns:
            st.plotly_chart(px.histogram(dff.dropna(subset=["EDAD"]),
                x="EDAD", nbins=20, color_discrete_sequence=["#4C6FFF"],
                title="Distribución de Edades"),
            use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 6 — SALARIOS
# ══════════════════════════════════════════════════════════════════════════════
with tab6:
    if "SALARIO" not in dff.columns:
        st.warning("No se encontró columna SALARIO.")
    else:
        sal_validos = dff.dropna(subset=["SALARIO"])

        if "NIVEL_AIC" in sal_validos.columns:
            orden_aic = ["JUNIOR","INTERMEDIO","SENIOR"]
            sal_nivel = sal_validos.groupby("NIVEL_AIC")["SALARIO"].agg(
                Máximo="max", Promedio="mean", Mínimo="min", Cantidad="count"
            ).reset_index()
            sal_nivel["Máximo"]   = sal_nivel["Máximo"].round(0)
            sal_nivel["Promedio"] = sal_nivel["Promedio"].round(0)
            sal_nivel["Mínimo"]   = sal_nivel["Mínimo"].round(0)

            c1, c2 = st.columns(2)
            with c1:
                fig_sal = go.Figure()
                for col, color, name in [
                    ("Máximo",  "#4C6FFF", "Máximo"),
                    ("Mínimo",  "#aaaaaa", "Mínimo"),
                    ("Promedio","#FF8C00", "Promedio"),
                ]:
                    fig_sal.add_trace(go.Bar(
                        x=sal_nivel["NIVEL_AIC"], y=sal_nivel[col],
                        name=name, marker_color=color,
                        text=sal_nivel[col].apply(lambda v: f"{v:,.0f}"),
                        textposition="outside"
                    ))
                fig_sal.add_trace(go.Scatter(
                    x=sal_nivel["NIVEL_AIC"], y=sal_nivel["Promedio"],
                    mode="lines+markers", name="Promedio", line=dict(color="#FF8C00", width=2)
                ))
                fig_sal.update_layout(
                    title="Salario Máx / Prom / Mín por Nivel AIC",
                    barmode="group", paper_bgcolor="#0e1117", font_color="#e8eaf0"
                )
                st.plotly_chart(fig_sal, use_container_width=True)

            with c2:
                st.markdown("#### Tabla por Nivel AIC")
                st.dataframe(
                    sal_nivel.rename(columns={"NIVEL_AIC":"Nivel AIC","Cantidad":"Cant."}),
                    use_container_width=True
                )

        if "SEXO" in sal_validos.columns and "NIVEL_AIC" in sal_validos.columns:
            sal_sex_nivel = sal_validos.groupby(["NIVEL_AIC","SEXO"])["SALARIO"].mean().reset_index()
            sal_sex_nivel["SEXO"] = sal_sex_nivel["SEXO"].map({"F":"Mujeres","M":"Hombres"})

            # Calcular brecha
            pivot_sal = sal_sex_nivel.pivot(index="NIVEL_AIC", columns="SEXO", values="SALARIO").reset_index()
            if "Hombres" in pivot_sal.columns and "Mujeres" in pivot_sal.columns:
                pivot_sal["Brecha %"] = ((pivot_sal["Mujeres"] - pivot_sal["Hombres"]) / pivot_sal["Hombres"] * 100).round(1)

            c1, c2 = st.columns(2)
            with c1:
                st.plotly_chart(px.bar(sal_sex_nivel, x="NIVEL_AIC", y="SALARIO", color="SEXO",
                    title="Salario Promedio por Nivel AIC y Sexo", barmode="group",
                    color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                use_container_width=True)
            with c2:
                if "Brecha %" in pivot_sal.columns:
                    st.markdown("#### Brecha Salarial H vs M por Nivel AIC")
                    st.dataframe(
                        pivot_sal.rename(columns={"NIVEL_AIC":"Nivel AIC",
                            "Hombres":"Prom. Hombres","Mujeres":"Prom. Mujeres"}).round(0),
                        use_container_width=True
                    )

            # Promedio global H vs M
            prom_h = sal_validos[sal_validos["SEXO"]=="M"]["SALARIO"].mean()
            prom_f = sal_validos[sal_validos["SEXO"]=="F"]["SALARIO"].mean()
            c1b, c2b = st.columns(2)
            c1b.markdown(mc("💙 Promedio Salarial Hombres", f"{prom_h:,.0f}" if not np.isnan(prom_h) else "—", " Gs.", ""), unsafe_allow_html=True)
            c2b.markdown(mc("💗 Promedio Salarial Mujeres", f"{prom_f:,.0f}" if not np.isnan(prom_f) else "—", " Gs.", ""), unsafe_allow_html=True)

        if "EMPRESA" in sal_validos.columns:
            sal_emp = sal_validos.groupby("EMPRESA")["SALARIO"].mean().reset_index()
            sal_emp.columns = ["EMPRESA","Salario Promedio"]
            sal_emp = sal_emp.sort_values("Salario Promedio", ascending=False)
            st.plotly_chart(px.bar(sal_emp, x="EMPRESA", y="Salario Promedio",
                title="Salario Promedio por Empresa (Gs.)",
                color="EMPRESA", color_discrete_sequence=COLOR_SEQ, text_auto=".0f"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 7 — DETALLE
# ══════════════════════════════════════════════════════════════════════════════
with tab7:
    st.markdown(f"**{len(dff)} colaboradores activos** con los filtros aplicados")
    show_cols = [c for c in [
        "EMPRESA","NOMBRE","CEDULA","CARGO","AREA","DEPARTAMENTO","SECCION",
        "NIVEL_AIC","LIDER","SEXO","GENERACION","EDAD","NACIONALIDAD",
        "SALARIO","FECHA_INGRESO","ANTIGUEDAD_ANOS","SITUACION"
    ] if c in dff.columns]
    st.dataframe(dff[show_cols], use_container_width=True, height=500)
    csv = dff[show_cols].to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Descargar nómina (.csv)", csv, "nomina_activos.csv", "text/csv")