import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import date
import numpy as np
import re
from pathlib import Path

st.set_page_config(page_title="Reclutamiento | Texo RRHH", layout="wide", page_icon="🔍")

logo_path = Path("images/logo.jpg")
if logo_path.exists():
    st.sidebar.image(str(logo_path), width=220)
else:
    st.sidebar.markdown("### 👥 RRHH · Texo")
# ─── Estilos ───────────────────────────────────────────────────────────────────
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

# ─── Helpers ───────────────────────────────────────────────────────────────────
def dias_habiles(inicio, fin):
    try:
        if pd.isnull(inicio) or pd.isnull(fin):
            return None
        return int(np.busday_count(pd.Timestamp(inicio).date(), pd.Timestamp(fin).date()))
    except Exception:
        return None

def metric_card(label, value, suffix=""):
    return f"""<div class="metric-card">
        <div class="metric-value">{value}{suffix}</div>
        <div class="metric-label">{label}</div>
    </div>"""

def normalizar_situacion(val):
    if pd.isnull(val) or str(val).strip().upper() == "NAN":
        return np.nan
    v = str(val).strip().upper()
    if v in ["CERRADO","CERRADA","CERRADO/A","CIERRE"]:       return "CERRADA"
    if v in ["ABIERTO","ABIERTA","EN PROCESO","ACTIVA"]:      return "ABIERTA"
    if v in ["PAUSADO","PAUSADA","EN PAUSA","PAUSA"]:         return "PAUSADA"
    if v in ["CANCELADO","CANCELADA","CANCEL"]:               return "CANCELADA"
    return v

def contar_candidatos(val):
    if pd.isnull(val) or str(val).strip() == "" or str(val).strip().upper() == "NAN":
        return 0
    partes = re.split(r'[+,;]', str(val))
    return len([p for p in partes if p.strip()])

# ─── Carga de datos ────────────────────────────────────────────────────────────
st.title("🔍 Reclutamiento")

uploaded_files = st.file_uploader(
    "Subí uno o más archivos Excel de reclutamiento",
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
                hoja_sel = st.selectbox(
                    f"📋 Seleccioná la hoja de **{f.name}**",
                    options=hojas, key=f"hoja_{f.name}"
                )
            df_tmp = pd.read_excel(xl, sheet_name=hoja_sel)
            df_tmp["_archivo"] = f.name
            df_tmp["_hoja"] = hoja_sel
            dfs.append(df_tmp)
            st.success(f"✅ {f.name} → hoja **{hoja_sel}** cargada ({len(df_tmp)} filas)")
        except Exception as e:
            st.warning(f"No se pudo leer {f.name}: {e}")
    if dfs:
        st.session_state["df_reclutamiento"] = pd.concat(dfs, ignore_index=True)

if "df_reclutamiento" not in st.session_state:
    st.info("📂 Subí al menos un archivo Excel para comenzar.")
    st.stop()

df = st.session_state["df_reclutamiento"]
# ─── Normalización de columnas ─────────────────────────────────────────────────
df.columns = (df.columns.str.strip().str.upper()
              .str.replace(".", "", regex=False)
              .str.replace(" ", "_")
              .str.replace("Á","A").str.replace("É","E")
              .str.replace("Í","I").str.replace("Ó","O")
              .str.replace("Ú","U").str.replace("Ñ","N"))

col_map = {
    "DIAS_HAB_": "DIAS_HAB", "DIAS_HAB": "DIAS_HAB",
    "POSICION0": "POSICION", "POSICION": "POSICION",
    "ANO": "ANO", "AO": "ANO",
}
df.rename(columns={k:v for k,v in col_map.items() if k in df.columns}, inplace=True)

# ─── Limpiar todas las columnas de texto ──────────────────────────────────────
cols_texto = ["AGENCIA","RESPONSABLE","SOLICITANTE","TIPO_VACANTE","POSICION",
              "NIVEL","STATUS","SITUACION","TIPO_INGRESO","SELECCIONADO"]

for col in cols_texto:
    if col in df.columns:
        df[col] = (df[col].astype(str)
                   .str.strip()
                   .str.upper()
                   .replace("NAN", np.nan))

# ─── Fechas ────────────────────────────────────────────────────────────────────
for col in ["RECEPCION", "CIERRE"]:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], errors="coerce")

# ─── Normalizar SITUACION ──────────────────────────────────────────────────────
if "SITUACION" in df.columns:
    df["SITUACION"] = df["SITUACION"].apply(normalizar_situacion)

# ─── Calcular días hábiles ─────────────────────────────────────────────────────
today = pd.Timestamp(date.today())
if "RECEPCION" in df.columns:
    df["DIAS_HAB_CALC"] = df.apply(
        lambda r: dias_habiles(r["RECEPCION"], r["CIERRE"] if pd.notnull(r.get("CIERRE")) else today), axis=1)
    df["DIAS_CIERRE"] = df.apply(
        lambda r: dias_habiles(r["RECEPCION"], r["CIERRE"]) if pd.notnull(r.get("CIERRE")) else None, axis=1)

# ─── AÑO y MES ────────────────────────────────────────────────────────────────
if "ANO" not in df.columns and "RECEPCION" in df.columns:
    df["ANO"] = df["RECEPCION"].dt.year
if "MES" not in df.columns and "RECEPCION" in df.columns:
    df["MES"] = df["RECEPCION"].dt.month
if "ANO" in df.columns:
    df["ANO"] = pd.to_numeric(df["ANO"], errors="coerce").astype("Int64")

# ─── Contar candidatos ─────────────────────────────────────────────────────────
if "CANDIDATOS" in df.columns:
    df["N_CANDIDATOS"] = df["CANDIDATOS"].apply(contar_candidatos)

# ─── Sidebar Filtros ───────────────────────────────────────────────────────────
st.sidebar.header("🔍 Filtros")

def sidebar_multi(label, col):
    if col in df.columns:
        opts = sorted(df[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts)
    return None

f_agencia     = sidebar_multi("Agencia", "AGENCIA")
f_situacion   = sidebar_multi("Situación", "SITUACION")
f_tipo_vac    = sidebar_multi("Tipo Vacante", "TIPO_VACANTE")
f_responsable = sidebar_multi("Responsable", "RESPONSABLE")
f_tipo_ing    = sidebar_multi("Tipo Ingreso", "TIPO_INGRESO")
f_nivel       = sidebar_multi("Nivel", "NIVEL")

if "ANO" in df.columns:
    años = sorted(df["ANO"].dropna().unique().tolist())
    f_anio = st.sidebar.multiselect("Año", años, default=años)
else:
    f_anio = None

# Aplicar filtros
mask = pd.Series([True] * len(df))
if f_agencia     and "AGENCIA"      in df.columns: mask &= df["AGENCIA"].isin(f_agencia)
if f_situacion   and "SITUACION"    in df.columns: mask &= df["SITUACION"].isin(f_situacion)
if f_tipo_vac    and "TIPO_VACANTE" in df.columns: mask &= df["TIPO_VACANTE"].isin(f_tipo_vac)
if f_responsable and "RESPONSABLE"  in df.columns: mask &= df["RESPONSABLE"].isin(f_responsable)
if f_tipo_ing    and "TIPO_INGRESO" in df.columns: mask &= df["TIPO_INGRESO"].isin(f_tipo_ing)
if f_nivel       and "NIVEL"        in df.columns: mask &= df["NIVEL"].isin(f_nivel)
if f_anio        and "ANO"          in df.columns: mask &= df["ANO"].isin(f_anio)

dff = df[mask].copy()

if dff.empty:
    st.warning("No hay datos con los filtros seleccionados.")
    st.stop()

# ─── KPIs ──────────────────────────────────────────────────────────────────────
total      = len(dff)
abiertas   = len(dff[dff.get("SITUACION", pd.Series(dtype=str)).str.upper() == "ABIERTA"])   if "SITUACION" in dff.columns else 0
cerradas   = len(dff[dff.get("SITUACION", pd.Series(dtype=str)).str.upper() == "CERRADA"])   if "SITUACION" in dff.columns else 0
canceladas = len(dff[dff.get("SITUACION", pd.Series(dtype=str)).str.upper() == "CANCELADA"]) if "SITUACION" in dff.columns else 0
pausadas   = len(dff[dff.get("SITUACION", pd.Series(dtype=str)).str.upper() == "PAUSADA"])   if "SITUACION" in dff.columns else 0

dias_prom = dff["DIAS_CIERRE"].mean() if "DIAS_CIERRE" in dff.columns else None
dias_str  = f"{dias_prom:.0f}" if dias_prom is not None and not np.isnan(dias_prom) else "—"
total_cand = int(dff["N_CANDIDATOS"].sum()) if "N_CANDIDATOS" in dff.columns else "—"

cols = st.columns(7)
cards = [
    ("Total Búsquedas", total, ""),
    ("Abiertas", abiertas, ""),
    ("Cerradas", cerradas, ""),
    ("Canceladas", canceladas, ""),
    ("Pausadas", pausadas, ""),
    ("Días Prom. Cierre", dias_str, " días"),
    ("Total Candidatos", total_cand, ""),
]
for i, (label, val, suf) in enumerate(cards):
    cols[i].markdown(metric_card(label, val, suf), unsafe_allow_html=True)

st.markdown("---")

# ─── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🏢 Por Agencia", "💼 Por Puesto", "📅 Por Tiempo", "👤 Por Responsable", "📋 Detalle"
])

COLOR_SEQ = px.colors.qualitative.Bold

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — POR AGENCIA
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    if "AGENCIA" not in dff.columns:
        st.warning("No se encontró la columna AGENCIA.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            ag = dff.groupby("AGENCIA").size().reset_index(name="Búsquedas").sort_values("Búsquedas")
            st.plotly_chart(px.bar(ag, x="Búsquedas", y="AGENCIA", orientation="h",
                title="Búsquedas por Agencia", color="AGENCIA",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        with c2:
            if "DIAS_CIERRE" in dff.columns:
                ag_d = dff.groupby("AGENCIA")["DIAS_CIERRE"].mean().reset_index()
                ag_d.columns = ["AGENCIA","Días Promedio"]
                ag_d = ag_d.dropna().sort_values("Días Promedio")
                st.plotly_chart(px.bar(ag_d, x="Días Promedio", y="AGENCIA", orientation="h",
                    title="Días Promedio de Cierre por Agencia",
                    color="Días Promedio", color_continuous_scale="RdYlGn_r"
                ).update_layout(coloraxis_showscale=False), use_container_width=True)

        if "SITUACION" in dff.columns:
            ag_s = dff.groupby(["AGENCIA","SITUACION"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(ag_s, x="AGENCIA", y="n", color="SITUACION",
                title="Situación de Búsquedas por Agencia", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

        if "TIPO_VACANTE" in dff.columns:
            ag_tv = dff.groupby(["AGENCIA","TIPO_VACANTE"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(ag_tv, x="AGENCIA", y="n", color="TIPO_VACANTE",
                title="Tipo de Vacante por Agencia", barmode="group",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — POR PUESTO
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    if "POSICION" not in dff.columns:
        st.warning("No se encontró la columna POSICION.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            pos = (dff.groupby("POSICION").size().reset_index(name="Búsquedas")
                   .sort_values("Búsquedas", ascending=False).head(15))
            st.plotly_chart(px.bar(pos, x="Búsquedas", y="POSICION", orientation="h",
                title="Top 15 Puestos más Solicitados", color="POSICION",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        with c2:
            if "DIAS_CIERRE" in dff.columns:
                pos_d = dff.groupby("POSICION")["DIAS_CIERRE"].mean().reset_index()
                pos_d.columns = ["POSICION","Días Promedio"]
                pos_d = pos_d.dropna().sort_values("Días Promedio", ascending=False).head(15)
                st.plotly_chart(px.bar(pos_d, x="Días Promedio", y="POSICION", orientation="h",
                    title="Top 15 Puestos que Más Tardan en Cubrirse",
                    color="Días Promedio", color_continuous_scale="RdYlGn_r"
                ).update_layout(coloraxis_showscale=False), use_container_width=True)

        if "NIVEL" in dff.columns and "DIAS_CIERRE" in dff.columns:
            niv = dff.groupby("NIVEL")["DIAS_CIERRE"].mean().reset_index()
            niv.columns = ["NIVEL","Días Promedio"]
            st.plotly_chart(px.bar(niv.dropna(), x="NIVEL", y="Días Promedio",
                title="Días Promedio por Nivel AIC", color="NIVEL",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        if "TIPO_INGRESO" in dff.columns:
            c1b, c2b = st.columns(2)
            ti = dff["TIPO_INGRESO"].value_counts().reset_index()
            ti.columns = ["Tipo Ingreso","Cantidad"]
            c1b.plotly_chart(px.pie(ti, names="Tipo Ingreso", values="Cantidad",
                title="Canal de Ingreso", hole=0.4,
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

            if "DIAS_CIERRE" in dff.columns:
                ti_d = dff.groupby("TIPO_INGRESO")["DIAS_CIERRE"].mean().reset_index()
                ti_d.columns = ["Tipo Ingreso","Días Promedio"]
                c2b.plotly_chart(px.bar(ti_d.dropna(), x="Tipo Ingreso", y="Días Promedio",
                    title="Días Promedio por Canal", color="Tipo Ingreso",
                    color_discrete_sequence=COLOR_SEQ
                ).update_layout(showlegend=False), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — POR TIEMPO
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    if "ANO" not in dff.columns:
        st.warning("No se encontró columna AÑO.")
    else:
        anio_c = dff.groupby("ANO").size().reset_index(name="Búsquedas")
        st.plotly_chart(px.bar(anio_c, x="ANO", y="Búsquedas", title="Búsquedas por Año",
            color="ANO", color_discrete_sequence=COLOR_SEQ, text="Búsquedas"
        ).update_traces(textposition="outside").update_layout(showlegend=False), use_container_width=True)

        if "MES" in dff.columns:
            mes_a = dff.groupby(["ANO","MES"]).size().reset_index(name="Búsquedas")
            mes_a["ANO"] = mes_a["ANO"].astype(str)
            fig_l = px.line(mes_a, x="MES", y="Búsquedas", color="ANO",
                title="Tendencia Mensual por Año", markers=True,
                color_discrete_sequence=COLOR_SEQ)
            fig_l.update_xaxes(tickvals=list(range(1,13)),
                ticktext=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"])
            st.plotly_chart(fig_l, use_container_width=True)

        if "DIAS_CIERRE" in dff.columns:
            c1, c2 = st.columns(2)
            with c1:
                d_a = dff.groupby("ANO")["DIAS_CIERRE"].mean().reset_index()
                d_a.columns = ["ANO","Días Promedio"]
                st.plotly_chart(px.bar(d_a.dropna(), x="ANO", y="Días Promedio",
                    title="Días Promedio de Cierre por Año",
                    color="Días Promedio", color_continuous_scale="RdYlGn_r", text_auto=".0f"
                ).update_layout(coloraxis_showscale=False), use_container_width=True)
            with c2:
                if "AGENCIA" in dff.columns:
                    d_ag = dff.groupby(["ANO","AGENCIA"])["DIAS_CIERRE"].mean().reset_index()
                    d_ag["ANO"] = d_ag["ANO"].astype(str)
                    st.plotly_chart(px.line(d_ag.dropna(), x="ANO", y="DIAS_CIERRE",
                        color="AGENCIA", title="Días Cierre: Agencia × Año", markers=True,
                        color_discrete_sequence=COLOR_SEQ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — POR RESPONSABLE
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    if "RESPONSABLE" not in dff.columns:
        st.warning("No se encontró la columna RESPONSABLE.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            resp = dff.groupby("RESPONSABLE").size().reset_index(name="Búsquedas").sort_values("Búsquedas")
            st.plotly_chart(px.bar(resp, x="Búsquedas", y="RESPONSABLE", orientation="h",
                title="Búsquedas por Responsable", color="RESPONSABLE",
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        with c2:
            if "DIAS_CIERRE" in dff.columns:
                resp_d = dff.groupby("RESPONSABLE")["DIAS_CIERRE"].mean().reset_index()
                resp_d.columns = ["RESPONSABLE","Días Promedio"]
                resp_d = resp_d.dropna().sort_values("Días Promedio")
                st.plotly_chart(px.bar(resp_d, x="Días Promedio", y="RESPONSABLE", orientation="h",
                    title="Días Promedio por Responsable",
                    color="Días Promedio", color_continuous_scale="RdYlGn_r"
                ).update_layout(coloraxis_showscale=False), use_container_width=True)

        if "SITUACION" in dff.columns:
            resp_s = dff.groupby(["RESPONSABLE","SITUACION"]).size().reset_index(name="n")
            st.plotly_chart(px.bar(resp_s, x="RESPONSABLE", y="n", color="SITUACION",
                title="Situación por Responsable", barmode="stack",
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)

            resp_tot  = dff.groupby("RESPONSABLE").size()
            resp_cerr = dff[dff["SITUACION"].str.upper() == "CERRADA"].groupby("RESPONSABLE").size()
            tasa = (resp_cerr / resp_tot * 100).reset_index()
            tasa.columns = ["RESPONSABLE","Tasa Éxito (%)"]
            tasa = tasa.dropna().sort_values("Tasa Éxito (%)")
            st.plotly_chart(px.bar(tasa, x="Tasa Éxito (%)", y="RESPONSABLE", orientation="h",
                title="Tasa de Éxito por Responsable (% Cerradas)",
                color="Tasa Éxito (%)", color_continuous_scale="RdYlGn"
            ).update_layout(coloraxis_showscale=False), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — DETALLE
# ══════════════════════════════════════════════════════════════════════════════
with tab5:
    st.markdown(f"**{len(dff)} registros** con los filtros aplicados")
    show_cols = [c for c in ["AGENCIA","RESPONSABLE","POSICION","NIVEL","TIPO_VACANTE",
                              "SITUACION","STATUS","TIPO_INGRESO","RECEPCION","CIERRE",
                              "DIAS_CIERRE","PRESUPUESTO","CANDIDATOS","SELECCIONADO",
                              "N_CANDIDATOS","ANO"] if c in dff.columns]
    st.dataframe(dff[show_cols], use_container_width=True, height=500)
    csv = dff[show_cols].to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Descargar datos filtrados (.csv)", csv, "rrhh_reclutamiento.csv", "text/csv")