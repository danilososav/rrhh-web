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

st.set_page_config(page_title="Resumen Ejecutivo | Texo RRHH", layout="wide", page_icon="📊")

logo_path = Path("images/logo.jpg")
if logo_path.exists():
    st.sidebar.image(str(logo_path), width=220)
else:
    st.sidebar.markdown("### 👥 RRHH · Texo")

st.markdown("""
<style>
    .metric-card {
        background: #1a1f2e; border-radius: 12px; padding: 16px;
        text-align: center; border-left: 4px solid #4C6FFF; margin-bottom: 8px;
    }
    .metric-card.danger { background: #2a1a1a; border-left: 4px solid #FF4C4C; }
    .metric-card.success { background: #1a2a1a; border-left: 4px solid #00C853; }
    .metric-card.warn { background: #2a2210; border-left: 4px solid #FFB300; }
    .metric-value { font-size: 1.4rem; font-weight: 700; color: #4C6FFF; line-height: 1.2; word-break: break-word; }
    .metric-card.danger .metric-value { color: #FF4C4C; }
    .metric-card.success .metric-value { color: #00C853; }
    .metric-card.warn .metric-value { color: #FFB300; }
    .metric-label { font-size: 0.75rem; color: #aaa; margin-top: 6px; line-height: 1.3; }
    .company-header {
        background: linear-gradient(135deg, #1a1f2e, #252d42);
        border-radius: 12px; padding: 14px 20px; margin-bottom: 16px;
        border-left: 5px solid #4C6FFF;
    }
    .company-name { font-size: 1.3rem; font-weight: 700; color: #fff; }
    .divider { border-top: 1px solid #2a2d40; margin: 12px 0; }
</style>
""", unsafe_allow_html=True)

def mc(label, value, suffix="", style=""):
    cls = f"metric-card {style}".strip()
    return f"""<div class="{cls}">
        <div class="metric-value">{value}{suffix}</div>
        <div class="metric-label">{label}</div>
    </div>"""

def fmt_gs(val):
    try:
        v = int(val)
        if abs(v) >= 1_000_000_000: return f"₲ {v/1_000_000_000:.1f}B"
        if abs(v) >= 1_000_000:     return f"₲ {v/1_000_000:.1f}M"
        if abs(v) >= 1_000:         return f"₲ {v/1_000:.1f}K"
        return f"₲ {v:,}".replace(",",".")
    except: return "—"

COLOR_SEQ = px.colors.qualitative.Bold
EMPRESAS_TEXO = ["BRICK","NASTA","LUPE","OMD","ROGER","TAC MEDIA","BPR","AMPLIFY","TEXO","ROW"]

GENERACIONES = [
    ("Baby Boomers",  1945, 1964),
    ("Generación X",  1965, 1981),
    ("Millennials",   1982, 1996),
    ("Generación Z",  1997, 2012),
]

def calcular_generacion(fecha_nac):
    try:
        anio = pd.to_datetime(fecha_nac).year
        for nombre, ini, fin in GENERACIONES:
            if ini <= anio <= fin:
                return nombre
        return "Otra"
    except:
        return None

# ─── IA: normalizar empresas ──────────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def normalizar_empresas_ia(nombres: tuple) -> dict:
    lista = "\n".join(f"- {n}" for n in nombres)
    canon = "\n".join(f"- {e}" for e in EMPRESAS_TEXO)
    prompt = f"""Tenés una lista de nombres de empresas del holding Texo que pueden tener variaciones de escritura.
Mapeá cada nombre a su nombre canónico de la lista provista. Si no matchea claramente, usá "OTROS".

NOMBRES CANÓNICOS:
{canon}

NOMBRES A MAPEAR:
{lista}

Respondé ÚNICAMENTE con un JSON válido. Clave = nombre original, valor = nombre canónico."""
    try:
        r = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        texto = re.sub(r"```json|```", "", r.content[0].text.strip()).strip()
        return json.loads(texto)
    except:
        return {n: n for n in nombres}

# ─── IA: insight ejecutivo ────────────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def insight_empresa_ia(data_json: str, empresa: str) -> str:
    prompt = f"""Sos un consultor de RRHH analizando datos del holding Texo (empresas publicitarias en Paraguay).
Estos son los indicadores clave de la empresa {empresa}:

{data_json}

En máximo 3 oraciones directas y ejecutivas, describí:
- Riesgo de rotación y su costo
- Una recomendación concreta

Sin markdown, sin bullets, solo texto ejecutivo."""
    try:
        r = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return r.content[0].text.strip()
    except:
        return ""

# ─── Verificar datos disponibles ──────────────────────────────────────────────
tiene_rotacion    = "df_rotacion"      in st.session_state
tiene_liquidacion = "df_liquidaciones" in st.session_state
tiene_entrevistas = "df_entrevistas"   in st.session_state
tiene_nomina      = "df_nomina"        in st.session_state

st.title("📊 Resumen Ejecutivo")

if st.sidebar.button("🔄 Recalcular datos"):
    st.cache_data.clear()
    st.rerun()

if not any([tiene_rotacion, tiene_liquidacion, tiene_entrevistas, tiene_nomina]):
    st.warning("⚠️ No hay datos cargados. Ingresá a los módulos para cargar datos primero.")
    st.stop()

# ─── Preparar y normalizar datos ──────────────────────────────────────────────
def preparar_datos():
    nombres = set()
    if tiene_rotacion:
        nombres.update(st.session_state["df_rotacion"]["EMPRESA"].dropna().unique().tolist())
    if tiene_liquidacion:
        nombres.update(st.session_state["df_liquidaciones"]["AGENCIA"].dropna().unique().tolist())
    if tiene_entrevistas and "EMPRESA" in st.session_state["df_entrevistas"].columns:
        nombres.update(st.session_state["df_entrevistas"]["EMPRESA"].dropna().unique().tolist())
    if tiene_nomina and "EMPRESA" in st.session_state["df_nomina"].columns:
        nombres.update(st.session_state["df_nomina"]["EMPRESA"].dropna().unique().tolist())
    nombres = tuple(n for n in nombres if str(n).upper() not in ["NAN","NONE",""])
    return normalizar_empresas_ia(nombres)

with st.spinner("🤖 Normalizando nombres de empresa con IA..."):
    mapa_empresas = preparar_datos()

df_rot = df_liq = df_ent = df_nom = None

if tiene_rotacion:
    df_rot = st.session_state["df_rotacion"].copy()
    df_rot["EMPRESA_N"] = df_rot["EMPRESA"].map(mapa_empresas).fillna(df_rot["EMPRESA"])

if tiene_liquidacion:
    df_liq = st.session_state["df_liquidaciones"].copy()
    df_liq["EMPRESA_N"] = df_liq["AGENCIA"].map(mapa_empresas).fillna(df_liq["AGENCIA"])

if tiene_entrevistas:
    df_ent = st.session_state["df_entrevistas"].copy()
    if "EMPRESA" in df_ent.columns:
        df_ent["EMPRESA_N"] = df_ent["EMPRESA"].map(mapa_empresas).fillna(df_ent["EMPRESA"])

if tiene_nomina:
    df_nom = st.session_state["df_nomina"].copy()
    if "EMPRESA" in df_nom.columns:
        df_nom["EMPRESA_N"] = df_nom["EMPRESA"].map(mapa_empresas).fillna(df_nom["EMPRESA"])

# Empresas disponibles
empresas_disp = set()
for d, col in [(df_rot,"EMPRESA_N"),(df_liq,"EMPRESA_N"),(df_ent,"EMPRESA_N"),(df_nom,"EMPRESA_N")]:
    if d is not None and col in d.columns:
        empresas_disp.update(d[col].dropna().unique())
empresas_disp = sorted([e for e in empresas_disp if e not in ["NAN","OTROS"]])

# ─── Sidebar ──────────────────────────────────────────────────────────────────
st.sidebar.header("⚙️ Configuración")
modo = st.sidebar.radio("Vista", ["📋 Todas las empresas", "🔍 Una empresa"], index=0)

anos_disp = []
if df_rot is not None and "ANO_REPORTE" in df_rot.columns:
    anos_disp = sorted(df_rot["ANO_REPORTE"].dropna().unique().astype(int).tolist(), reverse=True)

if anos_disp:
    if len(anos_disp) == 1:
        anos_sel = anos_disp
        st.sidebar.markdown(f"**Año:** {anos_disp[0]}")
    else:
        anos_sel = st.sidebar.multiselect(
            "Año(s)", options=anos_disp, default=[anos_disp[0]], max_selections=2
        )
        if not anos_sel: anos_sel = [anos_disp[0]]
else:
    anos_sel = []

comparar_anos = len(anos_sel) == 2

if modo == "🔍 Una empresa":
    empresa_sel = [st.sidebar.selectbox("Empresa", empresas_disp)]
else:
    empresa_sel = empresas_disp

# ─── Debug ────────────────────────────────────────────────────────────────────
if st.sidebar.checkbox("🐛 Debug empresa", value=False, key="show_debug"):
    emp_debug = st.sidebar.selectbox("Empresa a debuggear", empresas_disp, key="debug_emp_sel")

# ─── CAMBIO 3: Función métricas — denominador = headcount enero ───────────────
def get_metricas(empresa: str, ano: int = None) -> dict:
    m = {"empresa": empresa}

    if df_rot is not None:
        er = df_rot[df_rot["EMPRESA_N"] == empresa]
        if "SITUACION" in er.columns and "MES_REPORTE" in er.columns and "ANO_REPORTE" in er.columns:
            ano_usar = ano if ano else int(er["ANO_REPORTE"].max())
            er_ano = er[er["ANO_REPORTE"] == ano_usar]
            m["ultimo_ano"] = ano_usar

            if not er_ano.empty:
                ultimo_mes = er_ano["MES_REPORTE"].max()
                activos = er_ano[
                    (er_ano["MES_REPORTE"] == ultimo_mes) &
                    (er_ano["SITUACION"].str.strip().str.upper() == "A")
                ]
                m["activos"]    = len(activos)
                m["ultimo_mes"] = ultimo_mes

                salidas_raw = er_ano[er_ano["SITUACION"].str.strip().str.upper() == "I"].copy()
                if "CEDULA" in salidas_raw.columns:
                    salidas = salidas_raw.sort_values("MES_REPORTE").drop_duplicates(subset="CEDULA", keep="first")
                elif "NOMBRE" in salidas_raw.columns:
                    salidas = salidas_raw.sort_values("MES_REPORTE").drop_duplicates(subset="NOMBRE", keep="first")
                else:
                    salidas = salidas_raw.drop_duplicates()
                m["salidas_total"] = len(salidas)

                # CAMBIO 3: denominador = headcount enero (mes 1)
                hc_enero = len(er_ano[er_ano["MES_REPORTE"] == 1])
                if hc_enero > 0 and m["salidas_total"] > 0:
                    m["tasa_rotacion"] = round(m["salidas_total"] / hc_enero * 100, 1)
                else:
                    m["tasa_rotacion"] = None

                m["_debug"] = {
                    "ano_usado": ano_usar,
                    "hc_enero (denominador)": hc_enero,
                    "salidas_año (numerador)": len(salidas),
                    "formula": f"{len(salidas)} / {hc_enero} * 100",
                    "tasa_calculada": m.get("tasa_rotacion"),
                }
            else:
                salidas = pd.DataFrame()
                m["salidas_total"] = 0
        else:
            salidas_raw = er[er["SITUACION"].str.strip().str.upper() == "I"] if "SITUACION" in er.columns else pd.DataFrame()
            salidas = salidas_raw
            m["salidas_total"] = len(salidas)

        if "MESES_PERMANENCIA" in salidas.columns and not salidas.empty:
            m["perm_prom"] = round(salidas["MESES_PERMANENCIA"].mean(), 1)
        if "TIPO_SALIDA" in salidas.columns and not salidas.empty:
            m["tipo_salida_top"] = salidas["TIPO_SALIDA"].value_counts().idxmax()
        if "NIVEL_AIC" in er.columns and not salidas.empty:
            m["salidas_por_nivel"] = salidas.groupby("NIVEL_AIC").size().to_dict()

    if df_liq is not None:
        el = df_liq[df_liq["EMPRESA_N"] == empresa]
        if not el.empty:
            m["sobrecosto"]  = el["SOBRECOSTO"].sum()  if "SOBRECOSTO"  in el.columns else 0
            m["total_costo"] = el["TOTAL_COSTO"].sum() if "TOTAL_COSTO" in el.columns else 0
            m["liq_count"]   = len(el)
            if "NIVEL_AIC" in el.columns and "SOBRECOSTO" in el.columns:
                m["sob_por_nivel"] = el.groupby("NIVEL_AIC")["SOBRECOSTO"].sum().to_dict()

    if df_ent is not None and "EMPRESA_N" in df_ent.columns:
        ee = df_ent[df_ent["EMPRESA_N"] == empresa]
        if not ee.empty:
            m["ent_count"] = len(ee)
            col_motivo = "MOTIVO_CATEGORIA" if "MOTIVO_CATEGORIA" in ee.columns else "MOTIVO_PRINCIPAL"
            if col_motivo in ee.columns:
                top = ee[col_motivo].value_counts()
                if not top.empty:
                    m["motivo_top"] = top.idxmax()
                    m["motivo_pct"] = round(top.iloc[0] / top.sum() * 100, 0)
            if "P11_VOLVERIA" in ee.columns:
                si = ee["P11_VOLVERIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
                m["pct_volveria"] = round(si / len(ee) * 100, 0)
            if "P12_RECOMENDARIA" in ee.columns:
                si = ee["P12_RECOMENDARIA"].str.upper().str.contains("SI|SÍ|YES", na=False).sum()
                m["pct_rec"] = round(si / len(ee) * 100, 0)

    return m

# Debug output
if st.sidebar.checkbox("🐛 Debug empresa", value=False, key="show_debug2"):
    emp_debug = st.sidebar.selectbox("Empresa", empresas_disp, key="debug_emp2")
    ano_debug = anos_sel[0] if anos_sel else None
    m_debug = get_metricas(emp_debug, ano=ano_debug)
    with st.expander(f"🐛 Debug: {emp_debug} — año {ano_debug}", expanded=True):
        st.json(m_debug.get("_debug", {"info": "Sin datos de rotación"}))
        st.write("Métricas:", {k: v for k, v in m_debug.items() if k != "_debug"})

# ─── Scorecard por empresa ────────────────────────────────────────────────────
def render_scorecard(empresa: str):
    m  = get_metricas(empresa, ano=anos_sel[0] if anos_sel else None)
    m2 = get_metricas(empresa, ano=anos_sel[1]) if comparar_anos else None

    titulo_ano = f"{anos_sel[0]}" + (f" vs {anos_sel[1]}" if comparar_anos else "") if anos_sel else ""
    st.markdown(f'<div class="company-header"><span class="company-name">🏢 {empresa} — {titulo_ano}</span></div>', unsafe_allow_html=True)

    if comparar_anos and m2:
        def fmt_tasa(v): return f"{v}%" if v else "—"
        resumen_comp = {
            "Indicador": ["👥 Activos", "🔄 Tasa Rotación Anual", "📅 Permanencia (meses)", "⚠️ Sobrecosto"],
            str(anos_sel[1]): [
                m2.get("activos","—"), fmt_tasa(m2.get("tasa_rotacion")),
                m2.get("perm_prom","—"), fmt_gs(m2.get("sobrecosto",0)),
            ],
            str(anos_sel[0]): [
                m.get("activos","—"), fmt_tasa(m.get("tasa_rotacion")),
                m.get("perm_prom","—"), fmt_gs(m.get("sobrecosto",0)),
            ],
        }
        st.dataframe(pd.DataFrame(resumen_comp).set_index("Indicador"), use_container_width=True)

    # CAMBIO 2: eliminada ficha de Satisfacción — ahora son 5 columnas
    c1, c2, c3, c4, c5 = st.columns(5)

    activos = m.get("activos", "—")
    c1.markdown(mc("👥 Colaboradores activos", activos, style="success"), unsafe_allow_html=True)

    tasa = m.get("tasa_rotacion")
    tasa_str   = f"{tasa}%" if tasa is not None else "—"
    tasa_style = "danger" if tasa and tasa > 15 else "warn" if tasa and tasa > 8 else ""
    c2.markdown(mc("🔄 Tasa rotación anual", tasa_str, style=tasa_style), unsafe_allow_html=True)

    perm = m.get("perm_prom")
    perm_str   = f"{perm}" if perm else "—"
    perm_style = "danger" if perm and perm < 6 else "warn" if perm and perm < 12 else ""
    c3.markdown(mc("📅 Permanencia prom.", perm_str, " meses", perm_style), unsafe_allow_html=True)

    sob = m.get("sobrecosto", 0)
    sob_style = "danger" if sob > 50_000_000 else "warn" if sob > 20_000_000 else ""
    c4.markdown(mc("⚠️ Sobrecosto", fmt_gs(sob), style=sob_style), unsafe_allow_html=True)

    motivo = m.get("motivo_top", "—")
    pct    = m.get("motivo_pct", "")
    c5.markdown(mc("🚪 Motivo salida top", motivo, f" ({int(pct)}%)" if pct else "", "warn"), unsafe_allow_html=True)

    c1b, c2b, c3b, c4b = st.columns([1,1,1,3])

    vuelve = m.get("pct_volveria")
    c1b.markdown(mc("↩️ Volvería a trabajar", f"{int(vuelve)}%" if vuelve is not None else "—",
                    style="success" if vuelve and vuelve >= 50 else "danger"), unsafe_allow_html=True)

    rec = m.get("pct_rec")
    c2b.markdown(mc("📣 Recomendaría Texo", f"{int(rec)}%" if rec is not None else "—",
                    style="success" if rec and rec >= 50 else "danger"), unsafe_allow_html=True)

    tipo = m.get("tipo_salida_top", "—")
    c3b.markdown(mc("📤 Tipo salida frecuente", tipo, style="warn"), unsafe_allow_html=True)

    if modo == "🔍 Una empresa":
        data_resumen = {
            "activos": m.get("activos","—"),
            "tasa_rotacion_anual_pct": m.get("tasa_rotacion","—"),
            "permanencia_prom_meses": m.get("perm_prom","—"),
            "sobrecosto": fmt_gs(m.get("sobrecosto",0)),
            "motivo_principal_salida": m.get("motivo_top","—"),
            "pct_volveria": m.get("pct_volveria","—"),
            "pct_recomendaria": m.get("pct_rec","—"),
        }
        with c4b:
            with st.spinner("🤖 Generando insight..."):
                insight = insight_empresa_ia(json.dumps(data_resumen, ensure_ascii=False), empresa)
            if insight:
                st.info(f"🤖 **Diagnóstico IA:** {insight}")

    sob_nivel = m.get("sob_por_nivel", {})
    sal_nivel = m.get("salidas_por_nivel", {})
    if sob_nivel or sal_nivel:
        st.markdown('<div class="divider"></div>', unsafe_allow_html=True)
        gc1, gc2 = st.columns(2)
        orden = ["PASANTE","PRINCIPIANTE","JUNIOR","INTERMEDIO","SENIOR","LIDER","GERENTE"]
        if sob_nivel:
            df_sn = pd.DataFrame(list(sob_nivel.items()), columns=["Nivel","Sobrecosto"])
            df_sn["_ord"] = df_sn["Nivel"].apply(lambda x: orden.index(x) if x in orden else 99)
            df_sn = df_sn.sort_values("_ord").drop(columns="_ord")
            with gc1:
                st.plotly_chart(px.bar(df_sn, x="Nivel", y="Sobrecosto",
                    title=f"Sobrecosto por Nivel AIC — {empresa}",
                    color="Sobrecosto", color_continuous_scale="Reds", height=280
                ).update_layout(coloraxis_showscale=False, margin=dict(t=40,b=20)),
                use_container_width=True)
        if sal_nivel:
            df_sl = pd.DataFrame(list(sal_nivel.items()), columns=["Nivel","Salidas"])
            df_sl["_ord"] = df_sl["Nivel"].apply(lambda x: orden.index(x) if x in orden else 99)
            df_sl = df_sl.sort_values("_ord").drop(columns="_ord")
            with gc2:
                st.plotly_chart(px.bar(df_sl, x="Nivel", y="Salidas",
                    title=f"Salidas por Nivel AIC — {empresa}",
                    color="Nivel", color_discrete_sequence=COLOR_SEQ, height=280
                ).update_layout(showlegend=False, margin=dict(t=40,b=20)),
                use_container_width=True)
    st.markdown("---")

# ─── Vista comparativa ────────────────────────────────────────────────────────
def render_comparativo():
    rows = []
    for emp in empresa_sel:
        m = get_metricas(emp, ano=anos_sel[0] if anos_sel else None)
        rows.append({
            "Empresa":      emp,
            "Activos":      m.get("activos", 0) or 0,
            "Rotación %":   m.get("tasa_rotacion", 0) or 0,
            "Sobrecosto M": round((m.get("sobrecosto", 0) or 0) / 1_000_000, 1),
            "Volvería %":   m.get("pct_volveria", 0) or 0,
        })
    if not rows: return
    df_comp = pd.DataFrame(rows)

    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(px.bar(df_comp.sort_values("Rotación %", ascending=False),
            x="Empresa", y="Rotación %",
            title="Tasa de Rotación Anual por Empresa (%)",
            color="Rotación %", color_continuous_scale="RdYlGn_r", text_auto=True
        ).update_layout(coloraxis_showscale=False), use_container_width=True)
    with c2:
        st.plotly_chart(px.bar(df_comp.sort_values("Sobrecosto M", ascending=False),
            x="Empresa", y="Sobrecosto M",
            title="⚠️ Sobrecosto por Empresa (en millones ₲)",
            color="Sobrecosto M", color_continuous_scale="Reds", text_auto=True
        ).update_layout(coloraxis_showscale=False), use_container_width=True)

    c3, c4 = st.columns(2)
    with c3:
        df_act = df_comp[df_comp["Activos"] > 0]
        if not df_act.empty:
            st.plotly_chart(px.bar(df_act.sort_values("Activos", ascending=False),
                x="Empresa", y="Activos", title="Colaboradores Activos por Empresa",
                color="Empresa", color_discrete_sequence=COLOR_SEQ, text_auto=True
            ).update_layout(showlegend=False), use_container_width=True)
    with c4:
        df_vol = df_comp[df_comp["Volvería %"] > 0]
        if not df_vol.empty:
            st.plotly_chart(px.bar(df_vol.sort_values("Volvería %", ascending=False),
                x="Empresa", y="Volvería %", title="% Volvería a trabajar en Texo",
                color="Empresa", color_discrete_sequence=COLOR_SEQ, text_auto=True
            ).update_layout(showlegend=False), use_container_width=True)
    st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
# CAMBIO 5 — INFORME DIRECTORIO
# ══════════════════════════════════════════════════════════════════════════════
def render_informe_directorio():
    st.markdown("## 📋 Informe Directorio")

    if not tiene_nomina:
        st.warning("⚠️ Para ver el Informe Directorio completo, cargá el módulo de Nómina.")

    # ── 1. Nómina general ─────────────────────────────────────────────────────
    if tiene_nomina and df_nom is not None:
        st.markdown("### 👥 Nómina")
        total_activos = len(df_nom)
        empresas_count = df_nom.groupby("EMPRESA_N").size().reset_index(name="Colaboradores").sort_values("Colaboradores", ascending=False)

        c1, c2 = st.columns([1, 2])
        with c1:
            st.markdown(f"<h1 style='color:#00C853;font-size:3rem'>{total_activos}</h1>", unsafe_allow_html=True)
            st.markdown("**Funcionarios Activos**")
        with c2:
            st.plotly_chart(px.bar(empresas_count, x="EMPRESA_N", y="Colaboradores",
                title="Colaboradores por Empresa",
                color="EMPRESA_N", color_discrete_sequence=COLOR_SEQ, text="Colaboradores"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)
        st.markdown("---")

        # ── 2. Distribución por Sexo ─────────────────────────────────────────
        if "SEXO" in df_nom.columns:
            st.markdown("### ⚧ Distribución por Sexo")
            total_f = (df_nom["SEXO"] == "F").sum()
            total_m = (df_nom["SEXO"] == "M").sum()
            pct_f = total_f / total_activos * 100
            pct_m = total_m / total_activos * 100

            c1, c2, c3 = st.columns(3)
            c1.markdown(f"<h2 style='color:#FF69B4'>{total_f}<br><small>{pct_f:.1f}%</small></h2>", unsafe_allow_html=True)
            c2.markdown(f"<h2 style='color:#87CEEB'>{total_m}<br><small>{pct_m:.1f}%</small></h2>", unsafe_allow_html=True)

            with c3:
                emp_sex = df_nom.groupby(["EMPRESA_N","SEXO"]).size().reset_index(name="n")
                emp_sex["SEXO"] = emp_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                st.plotly_chart(px.bar(emp_sex, x="EMPRESA_N", y="n", color="SEXO",
                    title="Distribución por Sexo y Empresa", barmode="stack",
                    color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}
                ).update_layout(height=300), use_container_width=True)
            st.markdown("---")

        # ── 3. Liderazgo ─────────────────────────────────────────────────────
        if "LIDER" in df_nom.columns and "SEXO" in df_nom.columns:
            st.markdown("### 👑 Puestos de Liderazgo por Sexo")
            lid = df_nom[df_nom["LIDER"] == "SI"]
            lid_f = (lid["SEXO"] == "F").sum()
            lid_m = (lid["SEXO"] == "M").sum()
            total_lid = len(lid)
            pct_lid_f = lid_f / total_lid * 100 if total_lid > 0 else 0
            pct_lid_m = lid_m / total_lid * 100 if total_lid > 0 else 0

            c1, c2 = st.columns(2)
            with c1:
                st.markdown(f"El **{pct_lid_f:.0f}%** de los puestos de liderazgo están ocupados por **mujeres** vs el **{pct_lid_m:.0f}%** a cargo de **hombres**.")
                lid_sex = pd.DataFrame({"Sexo":["Hombres","Mujeres"],"Pct":[pct_lid_m, pct_lid_f]})
                st.plotly_chart(px.bar(lid_sex, x="Pct", y="Sexo", orientation="h",
                    color="Sexo", color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"},
                    text=lid_sex["Pct"].apply(lambda v: f"{v:.0f}%")
                ).update_traces(textposition="inside").update_layout(showlegend=False),
                use_container_width=True)
            with c2:
                if "NIVEL_AIC" in lid.columns:
                    niv_sex = lid.groupby(["NIVEL_AIC","SEXO"]).size().reset_index(name="n")
                    niv_sex["SEXO"] = niv_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                    st.plotly_chart(px.bar(niv_sex, x="n", y="NIVEL_AIC", color="SEXO",
                        title="Líderes por Nivel AIC y Sexo", barmode="group", orientation="h",
                        color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                    use_container_width=True)
            st.markdown("---")

        # ── 4. Nivel AIC ──────────────────────────────────────────────────────
        if "NIVEL_AIC" in df_nom.columns and "SEXO" in df_nom.columns:
            st.markdown("### 🏅 Distribución por Nivel AIC")
            niv_sex = df_nom.groupby(["NIVEL_AIC","SEXO"]).size().reset_index(name="n")
            niv_sex["SEXO"] = niv_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
            st.plotly_chart(px.bar(niv_sex, x="n", y="NIVEL_AIC", color="SEXO",
                title="Distribución por Nivel AIC y Sexo", barmode="group", orientation="h",
                color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
            use_container_width=True)
            st.markdown("---")

        # ── 5. Nacionalidad / Extranjeros ─────────────────────────────────────
        if "NACIONALIDAD" in df_nom.columns:
            st.markdown("### 🌍 Extranjeros")
            df_nom["ES_PARAGUAYO"] = df_nom["NACIONALIDAD"].str.upper().str.contains("PARAGUAY", na=False)
            total_ext = (~df_nom["ES_PARAGUAYO"]).sum()
            total_par = df_nom["ES_PARAGUAYO"].sum()

            c1, c2, c3 = st.columns(3)
            c1.markdown(f"<h2 style='color:#4C6FFF'>{total_ext}<br><small>Cargos ocupados por Extranjeros</small></h2>", unsafe_allow_html=True)
            with c2:
                nac_ext = df_nom[~df_nom["ES_PARAGUAYO"]]["NACIONALIDAD"].value_counts().reset_index()
                nac_ext.columns = ["Nacionalidad","Cantidad"]
                if not nac_ext.empty:
                    st.plotly_chart(px.bar(nac_ext, x="Cantidad", y="Nacionalidad",
                        orientation="h", color="Nacionalidad",
                        color_discrete_sequence=COLOR_SEQ, text="Cantidad"
                    ).update_traces(textposition="outside").update_layout(showlegend=False, height=250),
                    use_container_width=True)
            with c3:
                pie_nac = pd.DataFrame({"Grupo":["Paraguayos","Extranjeros"],"Cantidad":[total_par, total_ext]})
                st.plotly_chart(px.pie(pie_nac, names="Grupo", values="Cantidad",
                    hole=0.4, color_discrete_map={"Paraguayos":"#a0a0a0","Extranjeros":"#4C6FFF"}),
                use_container_width=True)
            st.markdown("---")

        # ── 6. Brecha Generacional ────────────────────────────────────────────
        if "GENERACION" in df_nom.columns:
            st.markdown("### 📅 Brecha Generacional")
            orden_gen = ["Baby Boomers","Generación X","Millennials","Generación Z","Otra"]
            gen_count = df_nom["GENERACION"].value_counts().reindex(orden_gen).dropna().reset_index()
            gen_count.columns = ["Generación","Cantidad"]
            total_gen = gen_count["Cantidad"].sum()

            rangos = {"Baby Boomers":"1945–1964","Generación X":"1965–1981",
                      "Millennials":"1982–1996","Generación Z":"1997–2012"}
            num_gen = len(gen_count)
            top_gen = gen_count.iloc[0] if not gen_count.empty else None
            pct_top = top_gen["Cantidad"] / total_gen * 100 if top_gen is not None else 0

            st.markdown(f"**{num_gen} generaciones** conviven en el mismo espacio de trabajo. El **{pct_top:.0f}%** de la fuerza laboral está ocupada por **{top_gen['Generación'] if top_gen is not None else '—'}**.")

            c1, c2 = st.columns(2)
            with c1:
                fig_gen = go.Figure()
                fig_gen.add_trace(go.Bar(
                    x=gen_count["Generación"], y=gen_count["Cantidad"],
                    text=gen_count["Cantidad"], textposition="outside",
                    marker_color=COLOR_SEQ[:len(gen_count)]
                ))
                for i, row in gen_count.iterrows():
                    rango = rangos.get(row["Generación"],"")
                    fig_gen.add_annotation(x=row["Generación"], y=-0.15, text=rango,
                        showarrow=False, yref="paper", font=dict(size=10, color="#aaa"))
                fig_gen.update_layout(title="Brecha Generacional", showlegend=False,
                    paper_bgcolor="#0e1117", font_color="#e8eaf0")
                st.plotly_chart(fig_gen, use_container_width=True)
            with c2:
                if "SEXO" in df_nom.columns:
                    gen_sex = df_nom.groupby(["GENERACION","SEXO"]).size().reset_index(name="n")
                    gen_sex["SEXO"] = gen_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                    st.plotly_chart(px.bar(gen_sex, x="n", y="GENERACION", color="SEXO",
                        title="Generaciones por Sexo", barmode="group", orientation="h",
                        color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                    use_container_width=True)
            st.markdown("---")

        # ── 7. Brecha Antigüedad ──────────────────────────────────────────────
        if "ANTIGUEDAD_ANOS" in df_nom.columns:
            st.markdown("### 📆 Brecha Antigüedad")

            def rango_ant(a):
                if pd.isna(a): return None
                if a < 1:  return "Menor a 1 año"
                if a < 5:  return "Entre 1 y 5 años"
                if a < 10: return "Entre 5 y 10 años"
                return "Mayor a 10 años"

            df_nom["RANGO_ANT"] = df_nom["ANTIGUEDAD_ANOS"].apply(rango_ant)
            orden_ant = ["Menor a 1 año","Entre 1 y 5 años","Entre 5 y 10 años","Mayor a 10 años"]

            c1, c2 = st.columns(2)
            with c1:
                ant_count = df_nom["RANGO_ANT"].value_counts().reindex(orden_ant).dropna().reset_index()
                ant_count.columns = ["Rango","Cantidad"]
                st.plotly_chart(px.bar(ant_count, x="Rango", y="Cantidad",
                    title="Cantidad de Personas por Rango de Antigüedad",
                    color="Rango", color_discrete_sequence=COLOR_SEQ, text="Cantidad"
                ).update_traces(textposition="outside").update_layout(showlegend=False),
                use_container_width=True)
            with c2:
                if "EMPRESA_N" in df_nom.columns:
                    ant_emp = df_nom.groupby("EMPRESA_N")["ANTIGUEDAD_ANOS"].mean().reset_index()
                    ant_emp.columns = ["Empresa","Antigüedad Promedio (años)"]
                    ant_emp = ant_emp.sort_values("Antigüedad Promedio (años)", ascending=False)
                    st.plotly_chart(px.bar(ant_emp, x="Empresa", y="Antigüedad Promedio (años)",
                        title="Promedio de Antigüedad por Empresa",
                        color="Empresa", color_discrete_sequence=COLOR_SEQ, text_auto=".1f"
                    ).update_traces(textposition="outside").update_layout(showlegend=False),
                    use_container_width=True)
            st.markdown("---")

        # ── 8. Salarios ───────────────────────────────────────────────────────
        if "SALARIO" in df_nom.columns and "NIVEL_AIC" in df_nom.columns:
            st.markdown("### 💰 Salario Máximo, Promedio y Mínimo")
            sal = df_nom.dropna(subset=["SALARIO"])
            sal_nivel = sal.groupby("NIVEL_AIC")["SALARIO"].agg(
                Máximo="max", Promedio="mean", Mínimo="min", Cant="count"
            ).reset_index().round(0)

            c1, c2 = st.columns(2)
            with c1:
                fig_sal = go.Figure()
                for col_s, color_s, name_s in [
                    ("Máximo","#4C6FFF","Máximo"),("Mínimo","#aaaaaa","Mínimo")]:
                    fig_sal.add_trace(go.Bar(
                        x=sal_nivel["NIVEL_AIC"], y=sal_nivel[col_s],
                        name=name_s, marker_color=color_s,
                        text=sal_nivel[col_s].apply(lambda v: f"{v:,.0f}"), textposition="outside"
                    ))
                fig_sal.add_trace(go.Scatter(
                    x=sal_nivel["NIVEL_AIC"], y=sal_nivel["Promedio"],
                    mode="lines+markers", name="Promedio",
                    line=dict(color="#FF8C00", width=2)
                ))
                fig_sal.update_layout(title="Salario por Nivel AIC",
                    paper_bgcolor="#0e1117", font_color="#e8eaf0")
                st.plotly_chart(fig_sal, use_container_width=True)
            with c2:
                st.dataframe(sal_nivel.rename(columns={"NIVEL_AIC":"Nivel AIC","Cant":"Cantidad"}),
                    use_container_width=True)

            if "SEXO" in sal.columns:
                st.markdown("### 💰 Distribución Salarial — Hombres y Mujeres")
                sal_sex = sal.groupby(["NIVEL_AIC","SEXO"])["SALARIO"].mean().reset_index()
                sal_sex["SEXO"] = sal_sex["SEXO"].map({"F":"Mujeres","M":"Hombres"})
                pivot_sal = sal_sex.pivot(index="NIVEL_AIC", columns="SEXO", values="SALARIO").reset_index()
                if "Hombres" in pivot_sal.columns and "Mujeres" in pivot_sal.columns:
                    pivot_sal["Brecha %"] = ((pivot_sal["Mujeres"] - pivot_sal["Hombres"]) / pivot_sal["Hombres"] * 100).round(1)

                c1, c2 = st.columns(2)
                with c1:
                    st.plotly_chart(px.bar(sal_sex, x="NIVEL_AIC", y="SALARIO", color="SEXO",
                        title="Salario Promedio H vs M por Nivel AIC", barmode="group",
                        color_discrete_map={"Mujeres":"#FF69B4","Hombres":"#87CEEB"}),
                    use_container_width=True)
                with c2:
                    prom_h = sal[sal["SEXO"]=="M"]["SALARIO"].mean()
                    prom_f = sal[sal["SEXO"]=="F"]["SALARIO"].mean()
                    c2a, c2b = st.columns(2)
                    c2a.markdown(f"<h3 style='color:#FF69B4'>{prom_f:,.0f}<br><small>Prom. Mujeres</small></h3>", unsafe_allow_html=True)
                    c2b.markdown(f"<h3 style='color:#87CEEB'>{prom_h:,.0f}<br><small>Prom. Hombres</small></h3>", unsafe_allow_html=True)
                    if "Brecha %" in pivot_sal.columns:
                        st.dataframe(pivot_sal.rename(columns={"NIVEL_AIC":"Nivel AIC",
                            "Hombres":"Prom. H","Mujeres":"Prom. M"}).round(0),
                        use_container_width=True)
            st.markdown("---")

    # ── 9. Rotación del Talento ───────────────────────────────────────────────
    if tiene_rotacion and df_rot is not None:
        st.markdown("### 🔄 Rotación del Talento")
        ano_ref = anos_sel[0] if anos_sel else None
        if ano_ref:
            dr = df_rot[df_rot["ANO_REPORTE"] == ano_ref]
        else:
            dr = df_rot.copy()

        if "SITUACION" in dr.columns and "EMPRESA_N" in dr.columns:
            sal_r = dr[dr["SITUACION"].str.strip().str.upper() == "I"]
            sal_emp = sal_r.groupby("EMPRESA_N").size().reset_index(name="Egresos")

            # Tasa rotación por empresa usando headcount enero
            tasa_rows = []
            for emp in dr["EMPRESA_N"].unique():
                df_e = dr[dr["EMPRESA_N"] == emp]
                sal_e = len(df_e[df_e["SITUACION"].str.strip().str.upper() == "I"])
                hc_e = len(df_e[df_e["MES_REPORTE"] == 1])
                if hc_e > 0:
                    tasa_rows.append({"EMPRESA_N": emp, "% Rotación": round(sal_e/hc_e*100, 0), "Egresos": sal_e})
            if tasa_rows:
                df_tasa = pd.DataFrame(tasa_rows)
                df_tasa = df_tasa.merge(sal_emp, on="EMPRESA_N", how="left")

                fig_rot = go.Figure()
                fig_rot.add_trace(go.Bar(
                    x=df_tasa["EMPRESA_N"], y=df_tasa["Egresos"],
                    name="Nº de Egresos", marker_color="#FF8C00",
                    text=df_tasa["Egresos"], textposition="outside"
                ))
                fig_rot.add_trace(go.Scatter(
                    x=df_tasa["EMPRESA_N"], y=df_tasa["% Rotación"],
                    name="% Rotación Anual", yaxis="y2",
                    mode="lines+markers+text",
                    text=df_tasa["% Rotación"].apply(lambda v: f"{v:.0f}%"),
                    textposition="top center",
                    line=dict(color="#FFD700", width=2)
                ))
                fig_rot.update_layout(
                    title="Rotación del Talento por Empresa",
                    yaxis2=dict(overlaying="y", side="right", showgrid=False),
                    paper_bgcolor="#0e1117", font_color="#e8eaf0", barmode="group"
                )
                st.plotly_chart(fig_rot, use_container_width=True)

            if "TIPO_SALIDA" in sal_r.columns:
                tipo_dist = sal_r["TIPO_SALIDA"].value_counts(normalize=True).reset_index()
                tipo_dist.columns = ["Tipo","Pct"]
                tipo_dist["Pct"] = (tipo_dist["Pct"] * 100).round(0)
                fig_tipos = px.bar(tipo_dist, x="Pct", y=["Pct"],
                    orientation="h", color="Tipo",
                    color_discrete_sequence=COLOR_SEQ)
                fig_tipos.update_layout(
                    title="Distribución de Tipos de Salida (%)",
                    showlegend=True, height=100,
                    paper_bgcolor="#0e1117", font_color="#e8eaf0",
                    margin=dict(t=30,b=10)
                )
                st.plotly_chart(fig_tipos, use_container_width=True)
        st.markdown("---")

    # ── 10. Rotación Involuntaria ─────────────────────────────────────────────
    if tiene_rotacion and df_rot is not None:
        st.markdown("### 🚫 Rotación Involuntaria")
        ano_ref = anos_sel[0] if anos_sel else None
        dr = df_rot[df_rot["ANO_REPORTE"] == ano_ref] if ano_ref else df_rot.copy()

        if "TIPO_SALIDA" in dr.columns and "EMPRESA_N" in dr.columns:
            invol_mask = dr["TIPO_SALIDA"].str.upper().str.contains("INV|DESPIDO|MUTUO", na=False)
            sal_invol = dr[invol_mask & (dr["SITUACION"].str.strip().str.upper() == "I")]
            invol_emp = sal_invol.groupby("EMPRESA_N").size().reset_index(name="Involuntaria")

            tasa_invol_rows = []
            for emp in dr["EMPRESA_N"].unique():
                df_e = dr[dr["EMPRESA_N"] == emp]
                inv_e = len(df_e[invol_mask & (df_e["SITUACION"].str.strip().str.upper() == "I")])
                hc_e  = len(df_e[df_e["MES_REPORTE"] == 1])
                if hc_e > 0:
                    tasa_invol_rows.append({"EMPRESA_N": emp, "% Rot. Involuntaria": round(inv_e/hc_e*100, 0), "Involuntaria": inv_e})
            if tasa_invol_rows:
                df_inv = pd.DataFrame(tasa_invol_rows)
                fig_inv = go.Figure()
                fig_inv.add_trace(go.Bar(
                    x=df_inv["EMPRESA_N"], y=df_inv["Involuntaria"],
                    name="Salidas Involuntarias", marker_color="#808080",
                    text=df_inv["Involuntaria"], textposition="outside"
                ))
                fig_inv.add_trace(go.Scatter(
                    x=df_inv["EMPRESA_N"], y=df_inv["% Rot. Involuntaria"],
                    name="% Rotación Involuntaria", yaxis="y2",
                    mode="lines+markers+text",
                    text=df_inv["% Rot. Involuntaria"].apply(lambda v: f"{v:.0f}%"),
                    textposition="top center",
                    line=dict(color="#FFD700", width=2)
                ))
                fig_inv.update_layout(
                    title="Rotación Involuntaria por Empresa",
                    yaxis2=dict(overlaying="y", side="right", showgrid=False),
                    paper_bgcolor="#0e1117", font_color="#e8eaf0"
                )
                st.plotly_chart(fig_inv, use_container_width=True)
        st.markdown("---")

    # ── 11. Sobrecostos ───────────────────────────────────────────────────────
    if tiene_liquidacion and df_liq is not None:
        st.markdown("### 💸 Sobrecostos de Egresos")
        if "SOBRECOSTO" in df_liq.columns:
            total_sob = df_liq["SOBRECOSTO"].sum()
            st.markdown(f"<h2 style='color:#FF4C4C'>Gs. {total_sob:,.0f}</h2>", unsafe_allow_html=True)

            c1, c2 = st.columns(2)
            with c1:
                if "MES" in df_liq.columns or "FECHA" in df_liq.columns:
                    col_mes = "MES" if "MES" in df_liq.columns else "FECHA"
                    sob_mes = df_liq.groupby(col_mes)["SOBRECOSTO"].sum().reset_index()
                    sob_mes.columns = ["Mes","Sobrecosto"]
                    st.plotly_chart(px.bar(sob_mes, x="Mes", y="Sobrecosto",
                        title="Sobrecosto por Mes", color="Mes",
                        color_discrete_sequence=COLOR_SEQ
                    ).update_layout(showlegend=False), use_container_width=True)
            with c2:
                sob_emp = df_liq.groupby("EMPRESA_N")["SOBRECOSTO"].sum().reset_index()
                sob_emp.columns = ["Empresa","Sobrecosto"]
                sob_emp = sob_emp.sort_values("Sobrecosto", ascending=False)
                st.plotly_chart(px.bar(sob_emp, x="Empresa", y="Sobrecosto",
                    title="Sobrecosto por Empresa",
                    color="Empresa", color_discrete_sequence=COLOR_SEQ, text_auto=".0f"
                ).update_traces(textposition="outside").update_layout(showlegend=False),
                use_container_width=True)
        st.markdown("---")

    # ── 12-13. Reclutamiento ──────────────────────────────────────────────────
    if "df_reclutamiento" in st.session_state:
        df_rec = st.session_state["df_reclutamiento"]
        st.markdown("### 🔍 Perfiles más Buscados")
        if "CARGO" in df_rec.columns or "POSICION" in df_rec.columns:
            col_cargo = "CARGO" if "CARGO" in df_rec.columns else "POSICION"
            top_cargos = df_rec[col_cargo].value_counts().head(10).reset_index()
            top_cargos.columns = ["Cargo","Búsquedas"]
            st.plotly_chart(px.bar(top_cargos, x="Búsquedas", y="Cargo",
                orientation="h", title="Top 10 Perfiles más Buscados",
                color="Cargo", color_discrete_sequence=COLOR_SEQ, text="Búsquedas"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)

        if "EMPRESA" in df_rec.columns or "AGENCIA" in df_rec.columns:
            col_emp = "EMPRESA" if "EMPRESA" in df_rec.columns else "AGENCIA"
            busq_emp = df_rec.groupby(col_emp).size().reset_index(name="Búsquedas")
            st.plotly_chart(px.bar(busq_emp.sort_values("Búsquedas", ascending=False),
                x=col_emp, y="Búsquedas", title="Búsquedas por Agencia",
                color=col_emp, color_discrete_sequence=COLOR_SEQ, text="Búsquedas"
            ).update_traces(textposition="outside").update_layout(showlegend=False),
            use_container_width=True)
        st.markdown("---")

# ══════════════════════════════════════════════════════════════════════════════
# RENDER PRINCIPAL — con tabs
# ══════════════════════════════════════════════════════════════════════════════
st.markdown(f"**Fuentes activas:** {'✅ Rotación' if tiene_rotacion else '❌ Rotación'} · "
            f"{'✅ Liquidaciones' if tiene_liquidacion else '❌ Liquidaciones'} · "
            f"{'✅ Entrevistas' if tiene_entrevistas else '❌ Entrevistas'} · "
            f"{'✅ Nómina' if tiene_nomina else '❌ Nómina'}")
st.markdown("---")

# CAMBIO 5: nueva pestaña Informe Directorio
tab_resumen, tab_directorio = st.tabs(["📊 Resumen Operativo", "📋 Informe Directorio"])

with tab_resumen:
    if modo == "📋 Todas las empresas":
        render_comparativo()
        for emp in empresa_sel:
            render_scorecard(emp)
    else:
        render_scorecard(empresa_sel[0])

with tab_directorio:
    render_informe_directorio()