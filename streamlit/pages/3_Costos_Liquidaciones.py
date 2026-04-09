import streamlit as st
import pandas as pd
import plotly.express as px
import numpy as np
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="Costos Liquidaciones | Texo RRHH", layout="wide", page_icon="💰")

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
    .metric-card.danger {
        background: #2a1a1a;
        border-left: 4px solid #FF4C4C;
    }
    .metric-value { font-size: 2rem; font-weight: 700; color: #4C6FFF; }
    .metric-card.danger .metric-value { font-size: 2.2rem; color: #FF4C4C; }
    .metric-label { font-size: 0.85rem; color: #aaa; margin-top: 4px; }
    .metric-card.danger .metric-label { color: #ffaaaa; font-weight: 600; }
</style>
""", unsafe_allow_html=True)

def metric_card(label, value, suffix="", danger=False):
    cls = "metric-card danger" if danger else "metric-card"
    return f"""<div class="{cls}">
        <div class="metric-value">{value}{suffix}</div>
        <div class="metric-label">{label}</div>
    </div>"""

def fmt_gs(val):
    """Formatea en millones o miles para que entre en la card."""
    try:
        v = int(val)
        if abs(v) >= 1_000_000_000:
            return f"₲ {v/1_000_000_000:.1f}B"
        elif abs(v) >= 1_000_000:
            return f"₲ {v/1_000_000:.1f}M"
        elif abs(v) >= 1_000:
            return f"₲ {v/1_000:.1f}K"
        return f"₲ {v:,}".replace(",",".")
    except:
        return "—"

COLOR_SEQ = px.colors.qualitative.Bold

COL_MAP = {
    "#": "NRO",
    "CI_NRO": "CI", "CI": "CI",
    "RAZON_SOCIAL": "NOMBRE", "RAZON_SOCIAL:": "NOMBRE",
    "AGENCIA": "AGENCIA", "EMPRESA": "AGENCIA",
    "NIVEL_AIC": "NIVEL_AIC", "NIVEL": "NIVEL_AIC",
    "INGRESO_IPS": "MES_INGRESO",
    "MES_SALIDA": "MES_SALIDA",
    "FECHA_SALIDA": "FECHA_SALIDA",
    "TIPO_SALIDA": "TIPO_SALIDA",
    "MOTIVO_SALIDA": "MOTIVO_SALIDA",
    "SALARIO_BASE": "SALARIO_BASE",
    "SALARIO_MES": "SALARIO_MES",
    "COMISIONES": "COMISIONES",
    "HORAS_EXTRAS": "HORAS_EXTRAS",
    "BONIF_FAMILIAR": "BONIF_FAMILIAR",
    "VACACIONES_CAUSADAS": "VAC_CAUSADAS",
    "VACACIONES_PROPORCIONALES": "VAC_PROPORCIONALES",
    "INDEMNIZACION": "INDEMNIZACION",
    "PREAVISO": "PREAVISO",
    "GRATIFICACION_EXTRAORDINARIA": "GRATIFICACION",
    "AGUINALDO": "AGUINALDO",
    "TOTAL_BRUTO": "TOTAL_BRUTO",
    "ANTICIPO_DE_SALARIO": "ANTICIPO",
    "OMISION_DE_PREAVISO": "OMISION_PREAVISO",
    "SEGURO_MEDICO": "SEGURO_MEDICO",
    "SMARTFIT": "SMARTFIT",
    "OTROS_DESCUENTOS": "OTROS_DESCUENTOS",
    "PTMO_CUOTAS": "PTMO_CUOTAS",
    "IPS_1": "IPS_1",
    "IPS_SOBRECOSTO": "IPS_SOBRECOSTO",
    "IPS_TOTAL": "IPS_TOTAL",
    "TOTAL_DESCUENTOS": "TOTAL_DESCUENTOS",
    "NETO": "NETO",
    "AP_1": "AP_1",
    "AP_SOBRECOSTO": "AP_SOBRECOSTO",
    "APORTE_PATRONAL": "APORTE_PATRONAL",
    "TOTAL_COSTO": "TOTAL_COSTO",
    "SOBRECOSTO": "SOBRECOSTO",
}

COLS_NUMERICAS = [
    "SALARIO_BASE","COMISIONES","HORAS_EXTRAS","BONIF_FAMILIAR",
    "VAC_CAUSADAS","VAC_PROPORCIONALES","INDEMNIZACION","PREAVISO",
    "GRATIFICACION","AGUINALDO","TOTAL_BRUTO","ANTICIPO","OMISION_PREAVISO",
    "SEGURO_MEDICO","SMARTFIT","OTROS_DESCUENTOS","PTMO_CUOTAS",
    "IPS_1","IPS_SOBRECOSTO","IPS_TOTAL","TOTAL_DESCUENTOS",
    "NETO","AP_1","AP_SOBRECOSTO","APORTE_PATRONAL","TOTAL_COSTO","SOBRECOSTO"
]

# ─── Carga ─────────────────────────────────────────────────────────────────────
st.title("💰 Costos de Liquidaciones")

uploaded_files = st.file_uploader(
    "Subí uno o más archivos Excel de liquidaciones",
    type=["xlsx","xls"],
    accept_multiple_files=True
)

if uploaded_files:
    dfs = []
    for i, f in enumerate(uploaded_files):
        try:
            xl = pd.ExcelFile(f)
            hojas = xl.sheet_names
            if len(hojas) == 1:
                hoja_sel = hojas[0]
            else:
                hoja_sel = st.selectbox(f"📋 Seleccioná la hoja de **{f.name}**",
                                        options=hojas, key=f"hoja_{f.name}_{i}")
            df_tmp = pd.read_excel(xl, sheet_name=hoja_sel)
            df_tmp["_archivo"] = f.name
            dfs.append(df_tmp)
            st.success(f"✅ {f.name} → {len(df_tmp)} filas cargadas")
        except Exception as e:
            st.warning(f"No se pudo leer {f.name}: {e}")

    if dfs:
        df_raw = pd.concat(dfs, ignore_index=True)

        # Normalizar columnas
        df_raw.columns = (df_raw.columns.str.strip().str.upper()
                          .str.replace(" ","_").str.replace(".",",",regex=False)
                          .str.replace("Á","A").str.replace("É","E")
                          .str.replace("Í","I").str.replace("Ó","O")
                          .str.replace("Ú","U").str.replace("Ñ","N")
                          .str.replace(":",""))
        df_raw.rename(columns={k:v for k,v in COL_MAP.items() if k in df_raw.columns}, inplace=True)

        # Texto
        for col in ["AGENCIA","NIVEL_AIC","TIPO_SALIDA","MOTIVO_SALIDA","NOMBRE"]:
            if col in df_raw.columns:
                df_raw[col] = df_raw[col].astype(str).str.strip().str.upper().replace("NAN", np.nan)

        # Numéricos
        for col in COLS_NUMERICAS:
            if col in df_raw.columns:
                df_raw[col] = pd.to_numeric(df_raw[col], errors="coerce").fillna(0)

        # Fechas
        if "FECHA_SALIDA" in df_raw.columns:
            df_raw["FECHA_SALIDA"] = pd.to_datetime(df_raw["FECHA_SALIDA"], errors="coerce")
            df_raw["ANO_SALIDA"]   = df_raw["FECHA_SALIDA"].dt.year.astype("Int64")
            df_raw["MES_SALIDA_N"] = df_raw["FECHA_SALIDA"].dt.month.astype("Int64")

        st.session_state["df_liquidaciones"] = df_raw

if "df_liquidaciones" not in st.session_state:
    st.info("📂 Subí al menos un archivo Excel de liquidaciones para comenzar.")
    st.stop()

df = st.session_state["df_liquidaciones"].copy()

# ─── Sidebar Filtros ───────────────────────────────────────────────────────────
st.sidebar.header("🔍 Filtros")

def sidebar_multi(label, col):
    if col in df.columns:
        opts = sorted(df[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts)
    return None

f_agencia = sidebar_multi("Agencia", "AGENCIA")
f_nivel   = sidebar_multi("Nivel AIC", "NIVEL_AIC")
f_tipo    = sidebar_multi("Tipo Salida", "TIPO_SALIDA")
f_motivo  = sidebar_multi("Motivo Salida", "MOTIVO_SALIDA")
f_ano     = sidebar_multi("Año", "ANO_SALIDA")

mask = pd.Series([True]*len(df))
if f_agencia and "AGENCIA"       in df.columns: mask &= df["AGENCIA"].isin(f_agencia)
if f_nivel   and "NIVEL_AIC"     in df.columns: mask &= df["NIVEL_AIC"].isin(f_nivel)
if f_tipo    and "TIPO_SALIDA"   in df.columns: mask &= df["TIPO_SALIDA"].isin(f_tipo)
if f_motivo  and "MOTIVO_SALIDA" in df.columns: mask &= df["MOTIVO_SALIDA"].isin(f_motivo)
if f_ano     and "ANO_SALIDA"    in df.columns: mask &= df["ANO_SALIDA"].isin(f_ano)

dff = df[mask].copy()

if dff.empty:
    st.warning("No hay datos con los filtros seleccionados.")
    st.stop()

# ─── KPIs ──────────────────────────────────────────────────────────────────────
total_casos      = len(dff)
total_bruto      = dff["TOTAL_BRUTO"].sum()     if "TOTAL_BRUTO"     in dff.columns else 0
total_neto       = dff["NETO"].sum()            if "NETO"            in dff.columns else 0
total_costo      = dff["TOTAL_COSTO"].sum()     if "TOTAL_COSTO"     in dff.columns else 0
total_sobrecosto = dff["SOBRECOSTO"].sum()      if "SOBRECOSTO"      in dff.columns else 0
aporte_pat       = dff["APORTE_PATRONAL"].sum() if "APORTE_PATRONAL" in dff.columns else 0

cols = st.columns(6)
for i, (lbl, val, suf, danger) in enumerate([
    ("Liquidaciones",   total_casos,               "", False),
    ("Total Bruto",     fmt_gs(total_bruto),        "", False),
    ("Total Neto",      fmt_gs(total_neto),         "", False),
    ("Total Costo",     fmt_gs(total_costo),        "", False),
    ("Aporte Patronal", fmt_gs(aporte_pat),         "", False),
    ("⚠️ Sobrecosto",   fmt_gs(total_sobrecosto),   "", True),
]):
    cols[i].markdown(metric_card(lbl, val, suf, danger), unsafe_allow_html=True)

st.markdown("---")

# ─── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🏢 Por Agencia",
    "💸 Composición de Costos",
    "📋 Por Tipo / Motivo",
    "📅 Tendencia",
    "📋 Detalle"
])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — POR AGENCIA
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    if "AGENCIA" not in dff.columns:
        st.warning("No se encontró columna AGENCIA.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            ag_costo = dff.groupby("AGENCIA")[["SOBRECOSTO","TOTAL_COSTO"]].sum().reset_index()
            ag_costo = ag_costo.sort_values("SOBRECOSTO", ascending=True)
            st.plotly_chart(px.bar(ag_costo, x="SOBRECOSTO", y="AGENCIA", orientation="h",
                title="⚠️ Sobrecosto por Agencia (costo de desvinculaciones)",
                color="SOBRECOSTO", color_continuous_scale="Reds"
            ).update_layout(coloraxis_showscale=False), use_container_width=True)

        with c2:
            ag_n = dff.groupby("AGENCIA").size().reset_index(name="Cantidad")
            ag_n = ag_n.sort_values("Cantidad", ascending=True)
            st.plotly_chart(px.bar(ag_n, x="Cantidad", y="AGENCIA", orientation="h",
                title="Cantidad de Liquidaciones por Agencia",
                color="AGENCIA", color_discrete_sequence=COLOR_SEQ
            ).update_layout(showlegend=False), use_container_width=True)

        ag_prom = dff.groupby("AGENCIA")[["SOBRECOSTO","TOTAL_COSTO"]].mean().reset_index()
        ag_prom = ag_prom.sort_values("SOBRECOSTO", ascending=False)
        st.plotly_chart(px.bar(ag_prom, x="AGENCIA", y="SOBRECOSTO",
            title="⚠️ Sobrecosto Promedio por Liquidación por Agencia",
            color="AGENCIA", color_discrete_sequence=COLOR_SEQ
        ).update_layout(showlegend=False), use_container_width=True)

        if "SOBRECOSTO" in dff.columns:
            ag_sob = dff.groupby("AGENCIA")["SOBRECOSTO"].sum().reset_index()
            ag_sob.columns = ["AGENCIA","Sobrecosto"]
            ag_sob = ag_sob[ag_sob["Sobrecosto"] > 0].sort_values("Sobrecosto", ascending=False)
            if not ag_sob.empty:
                st.plotly_chart(px.bar(ag_sob, x="AGENCIA", y="Sobrecosto",
                    title="Sobrecosto por Agencia (costo de la no retención)",
                    color="AGENCIA", color_discrete_sequence=COLOR_SEQ
                ).update_layout(showlegend=False), use_container_width=True)

        # ── Nivel AIC ──────────────────────────────────────────────────────────
        if "NIVEL_AIC" in dff.columns:
            st.markdown("---")
            st.markdown("#### 🎯 Análisis por Nivel AIC")

            # Orden lógico de niveles
            orden_aic = ["PASANTE","PRINCIPIANTE","JUNIOR","INTERMEDIO","SENIOR","LIDER","GERENTE"]
            def sort_aic(df_in, col="NIVEL_AIC"):
                df_in = df_in.copy()
                df_in["_ord"] = df_in[col].apply(
                    lambda x: orden_aic.index(x) if x in orden_aic else 99)
                return df_in.sort_values("_ord").drop(columns="_ord")

            c1, c2 = st.columns(2)
            with c1:
                aic_costo = dff.groupby("NIVEL_AIC")["TOTAL_COSTO"].sum().reset_index()
                aic_costo.columns = ["Nivel AIC","Total Costo"]
                aic_costo = sort_aic(aic_costo, "Nivel AIC")
                st.plotly_chart(px.bar(aic_costo, x="Nivel AIC", y="Total Costo",
                    title="Costo Total de Liquidaciones por Nivel AIC",
                    color="Nivel AIC", color_discrete_sequence=COLOR_SEQ, text_auto=True
                ).update_layout(showlegend=False), use_container_width=True)

            with c2:
                aic_n = dff.groupby("NIVEL_AIC").size().reset_index(name="Cantidad")
                aic_n = sort_aic(aic_n, "NIVEL_AIC")
                st.plotly_chart(px.bar(aic_n, x="NIVEL_AIC", y="Cantidad",
                    title="Cantidad de Liquidaciones por Nivel AIC",
                    color="NIVEL_AIC", color_discrete_sequence=COLOR_SEQ, text_auto=True
                ).update_layout(showlegend=False, xaxis_title="Nivel AIC"), use_container_width=True)

            # Sobrecosto por Nivel AIC — destacado
            if "SOBRECOSTO" in dff.columns:
                aic_sob = dff.groupby("NIVEL_AIC")["SOBRECOSTO"].sum().reset_index()
                aic_sob.columns = ["Nivel AIC","Sobrecosto"]
                aic_sob = aic_sob[aic_sob["Sobrecosto"] > 0]
                aic_sob = sort_aic(aic_sob, "Nivel AIC")
                if not aic_sob.empty:
                    st.plotly_chart(px.bar(aic_sob, x="Nivel AIC", y="Sobrecosto",
                        title="⚠️ Sobrecosto por Nivel AIC (impacto financiero de desvinculaciones)",
                        color="Sobrecosto", color_continuous_scale="Reds", text_auto=True
                    ).update_layout(coloraxis_showscale=False), use_container_width=True)

            # Costo promedio por nivel
            aic_prom = dff.groupby("NIVEL_AIC")["TOTAL_COSTO"].mean().reset_index()
            aic_prom.columns = ["Nivel AIC","Costo Promedio"]
            aic_prom = sort_aic(aic_prom, "Nivel AIC")
            st.plotly_chart(px.bar(aic_prom, x="Nivel AIC", y="Costo Promedio",
                title="Costo Promedio por Liquidación según Nivel AIC",
                color="Nivel AIC", color_discrete_sequence=COLOR_SEQ, text_auto=True
            ).update_layout(showlegend=False), use_container_width=True)

            # Sobrecosto vs Costo Total por nivel (comparativo)
            if "SOBRECOSTO" in dff.columns:
                aic_comp = dff.groupby("NIVEL_AIC")[["TOTAL_COSTO","SOBRECOSTO"]].sum().reset_index()
                aic_comp = sort_aic(aic_comp, "NIVEL_AIC")
                aic_melt = aic_comp.melt(id_vars="NIVEL_AIC", var_name="Concepto", value_name="Monto")
                aic_melt["Concepto"] = aic_melt["Concepto"].map(
                    {"TOTAL_COSTO":"Costo Total","SOBRECOSTO":"Sobrecosto"})
                st.plotly_chart(px.bar(aic_melt, x="NIVEL_AIC", y="Monto", color="Concepto",
                    title="Costo Total vs Sobrecosto por Nivel AIC",
                    barmode="group", color_discrete_map={
                        "Costo Total":"#4C6FFF","Sobrecosto":"#FF4C4C"}
                ).update_layout(xaxis_title="Nivel AIC"), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — COMPOSICIÓN DE COSTOS
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    conceptos = {
        "Salario Base":        "SALARIO_BASE",
        "Vacaciones Causadas": "VAC_CAUSADAS",
        "Vac. Proporcionales": "VAC_PROPORCIONALES",
        "Indemnización":       "INDEMNIZACION",
        "Preaviso":            "PREAVISO",
        "Aguinaldo":           "AGUINALDO",
        "Gratificación":       "GRATIFICACION",
        "Comisiones":          "COMISIONES",
        "Horas Extras":        "HORAS_EXTRAS",
        "Bonif. Familiar":     "BONIF_FAMILIAR",
        "IPS Total":           "IPS_TOTAL",
        "Aporte Patronal":     "APORTE_PATRONAL",
        "Sobrecosto":          "SOBRECOSTO",
    }
    comp = {k: dff[v].sum() for k,v in conceptos.items() if v in dff.columns and dff[v].sum() > 0}
    df_comp = pd.DataFrame(list(comp.items()), columns=["Concepto","Monto"])

    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(px.pie(df_comp, names="Concepto", values="Monto",
            title="Composición del Costo Total", hole=0.4,
            color_discrete_sequence=COLOR_SEQ), use_container_width=True)
    with c2:
        st.plotly_chart(px.bar(df_comp.sort_values("Monto"), x="Monto", y="Concepto",
            orientation="h", title="Monto por Concepto",
            color="Concepto", color_discrete_sequence=COLOR_SEQ
        ).update_layout(showlegend=False), use_container_width=True)

    if "AGENCIA" in dff.columns:
        cols_stack = [v for v in conceptos.values() if v in dff.columns]
        ag_stack = dff.groupby("AGENCIA")[cols_stack].sum().reset_index()
        ag_melt  = ag_stack.melt(id_vars="AGENCIA", var_name="Concepto", value_name="Monto")
        ag_melt["Concepto"] = ag_melt["Concepto"].map({v:k for k,v in conceptos.items()})
        ag_melt  = ag_melt[ag_melt["Monto"] > 0]
        st.plotly_chart(px.bar(ag_melt, x="AGENCIA", y="Monto", color="Concepto",
            title="Composición del Costo por Agencia", barmode="stack",
            color_discrete_sequence=COLOR_SEQ), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — POR TIPO / MOTIVO
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    c1, c2 = st.columns(2)
    with c1:
        if "TIPO_SALIDA" in dff.columns:
            ts_sob = dff.groupby("TIPO_SALIDA")["SOBRECOSTO"].sum().reset_index()
            ts_sob.columns = ["Tipo","Sobrecosto"]
            st.plotly_chart(px.pie(ts_sob, names="Tipo", values="Sobrecosto",
                title="⚠️ Sobrecosto por Tipo de Salida", hole=0.4,
                color_discrete_sequence=COLOR_SEQ), use_container_width=True)
    with c2:
        if "MOTIVO_SALIDA" in dff.columns:
            mot_sob = dff.groupby("MOTIVO_SALIDA")["SOBRECOSTO"].sum().reset_index()
            mot_sob.columns = ["Motivo","Sobrecosto"]
            mot_sob = mot_sob.sort_values("Sobrecosto", ascending=False).head(10)
            st.plotly_chart(px.bar(mot_sob, x="Sobrecosto", y="Motivo", orientation="h",
                title="⚠️ Top 10 Motivos por Sobrecosto",
                color="Sobrecosto", color_continuous_scale="Reds"
            ).update_layout(coloraxis_showscale=False), use_container_width=True)

    if "TIPO_SALIDA" in dff.columns:
        ts_prom = dff.groupby("TIPO_SALIDA")[["SOBRECOSTO","TOTAL_COSTO"]].mean().reset_index()
        st.plotly_chart(px.bar(ts_prom, x="TIPO_SALIDA", y="SOBRECOSTO",
            title="⚠️ Sobrecosto Promedio por Tipo de Salida",
            color="TIPO_SALIDA", color_discrete_sequence=COLOR_SEQ
        ).update_layout(showlegend=False, xaxis_title="Tipo de Salida"), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 — TENDENCIA
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    if "ANO_SALIDA" not in dff.columns:
        st.warning("No se encontraron fechas de salida.")
    else:
        c1, c2 = st.columns(2)
        with c1:
            ano_sob = dff.groupby("ANO_SALIDA")["SOBRECOSTO"].sum().reset_index()
            ano_sob.columns = ["Año","Sobrecosto"]
            ano_sob["Año"] = ano_sob["Año"].astype(str)
            st.plotly_chart(px.bar(ano_sob, x="Año", y="Sobrecosto",
                title="⚠️ Sobrecosto Total por Año",
                color="Sobrecosto", color_continuous_scale="Reds", text_auto=True
            ).update_layout(coloraxis_showscale=False), use_container_width=True)
        with c2:
            ano_n = dff.groupby("ANO_SALIDA").size().reset_index(name="Liquidaciones")
            ano_n["ANO_SALIDA"] = ano_n["ANO_SALIDA"].astype(str)
            st.plotly_chart(px.bar(ano_n, x="ANO_SALIDA", y="Liquidaciones",
                title="Cantidad de Liquidaciones por Año",
                color="ANO_SALIDA", color_discrete_sequence=COLOR_SEQ, text_auto=True
            ).update_layout(showlegend=False, xaxis_title="Año"), use_container_width=True)

        if "MES_SALIDA_N" in dff.columns:
            mes_sob = dff.groupby(["ANO_SALIDA","MES_SALIDA_N"])["SOBRECOSTO"].sum().reset_index()
            mes_sob["ANO_SALIDA"] = mes_sob["ANO_SALIDA"].astype(str)
            MESES = {1:"Ene",2:"Feb",3:"Mar",4:"Abr",5:"May",6:"Jun",
                     7:"Jul",8:"Ago",9:"Sep",10:"Oct",11:"Nov",12:"Dic"}
            mes_sob["Mes"] = mes_sob["MES_SALIDA_N"].map(MESES)
            st.plotly_chart(px.line(mes_sob, x="Mes", y="SOBRECOSTO", color="ANO_SALIDA",
                title="⚠️ Evolución Mensual del Sobrecosto", markers=True,
                color_discrete_sequence=COLOR_SEQ
            ).update_layout(yaxis_title="Sobrecosto"), use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 — DETALLE
# ══════════════════════════════════════════════════════════════════════════════
with tab5:
    st.markdown(f"**{len(dff)} registros** con los filtros aplicados")
    show_cols = [c for c in ["AGENCIA","NOMBRE","TIPO_SALIDA","MOTIVO_SALIDA",
                              "FECHA_SALIDA","SALARIO_BASE","TOTAL_BRUTO",
                              "TOTAL_DESCUENTOS","NETO","APORTE_PATRONAL",
                              "SOBRECOSTO","TOTAL_COSTO"] if c in dff.columns]
    st.dataframe(dff[show_cols], use_container_width=True, height=500)
    csv = dff[show_cols].to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Descargar (.csv)", csv, "costos_liquidaciones.csv", "text/csv")