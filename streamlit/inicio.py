import streamlit as st
from pathlib import Path

st.set_page_config(page_title="RRHH | Texo", layout="wide", page_icon="👥")

# ─── Logo ──────────────────────────────────────────────────────────────────────
logo_path = Path("images/logo.jpg")
if logo_path.exists():
    st.sidebar.image(str(logo_path), width=220)
else:
    st.sidebar.markdown("### 👥 RRHH · Texo")

# ─── Header con foto ───────────────────────────────────────────────────────────
# Colocá tu imagen en images/inicio.jpg (o .png) y aparecerá aquí automáticamente
foto_path_jpg = Path("images/inicio.jpg")
foto_path_png = Path("images/inicio.png")

col_texto, col_foto = st.columns([2, 1])

with col_texto:
    st.title("Portal de Recursos Humanos")
    st.markdown("Seleccioná un módulo desde el menú de la izquierda.")

with col_foto:
    if foto_path_jpg.exists():
        st.image(str(foto_path_jpg), use_container_width=True)
    elif foto_path_png.exists():
        st.image(str(foto_path_png), use_container_width=True)
    # Si no hay imagen, la columna queda vacía limpiamente

st.markdown("---")

col1, col2, col3, col4, col5, col6 = st.columns(6)
with col1:
    st.info("🔍 **Reclutamiento**\n\nSeguimiento de búsquedas, time-to-fill, candidatos y vacantes.")
with col2:
    st.info("🚪 **Entrevistas de Salida**\n\nMotivos de renuncia, satisfacción por empresa.")
with col3:
    st.info("🔄 **Rotación**\n\nTasa de rotación, permanencia y tendencias por empresa y cargo.")
with col4:
    st.info("💰 **Costos Liquidaciones** \n\nAnálisis de costos de liquidaciones.")
with col5:
    st.info("👥 **Nómina**\n\nColaboradores activos, distribución por sexo, generaciones y salarios.")
with col6:
    st.info("🖥️ **Resumen Ejecutivo**\n\nResumen para presentación al Directorio")

st.markdown("---")
st.caption("Desarrollado por TI Texo · RRHH")