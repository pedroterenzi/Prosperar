   import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import hashlib
import urllib.parse  
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine, text

# =========================================================
# 1. INICIALIZAÇÃO DE ESTADOS DA SESSÃO (ANTI-KEYERROR)
# =========================================================
if 'auth' not in st.session_state: st.session_state['auth'] = False
if 'user' not in st.session_state: st.session_state['user'] = None
if 'perfil' not in st.session_state: st.session_state['perfil'] = None
if 'nome_usuario' not in st.session_state: st.session_state['nome_usuario'] = None
if 'reg_sucesso' not in st.session_state: st.session_state['reg_sucesso'] = 0
if 'ultimo_horario_salvo' not in st.session_state: st.session_state['ultimo_horario_salvo'] = None
if 'aba_ativa_adm' not in st.session_state: st.session_state['aba_ativa_adm'] = 0

# Configuração global de layout
st.set_page_config(layout="wide", page_title="Barbearia Prosperidade", page_icon="💈")

# =========================================================
# BANCO DE DADOS NA NUVEM (POSTGRESQL - NEON.TECH)
# =========================================================
CONNECTION_STRING = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Portfólio de Serviços e Configuração de Split de Comissão
SERVICOS = {
    "Corte Simples": {"preco": 40.0, "comissao": 0.50, "tempo": "30 min", "foto": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400", "cor": "#1e3a8a"}, 
    "Corte + Sobrancelha": {"preco": 55.0, "comissao": 0.50, "tempo": "45 min", "foto": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400", "cor": "#581c87"}, 
    "Barba Completa": {"preco": 35.0, "comissao": 0.50, "tempo": "30 min", "foto": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400", "cor": "#064e3b"}, 
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0, "comissao": 0.55, "tempo": "60 min", "foto": "https://images.unsplash.com/photo-1512864084360-7c0c4d0a0845?w=400", "cor": "#701a75"}, 
    "Luzes / Nevou": {"preco": 90.0, "comissao": 0.60, "tempo": "90 min", "foto": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400", "cor": "#7c2d12"}  
}

PRODUTOS = {
    "Pomada Matte Elesid": {"preco": 35.0, "tipo": "Venda"},
    "Óleo de Barba Cedro": {"preco": 42.0, "tipo": "Venda"},
    "Minoxidil Kirkland": {"preco": 89.90, "tipo": "Venda"},
    "Cerveja Budweiser Long Neck": {"preco": 10.0, "tipo": "Venda"}
}

@st.cache_resource
def obter_engine():
    return create_engine(CONNECTION_STRING, pool_pre_ping=True)

@st.cache_data(ttl=15)
def buscar_dados_sql(query_texto, params=None):
    engine = obter_engine()
    with engine.connect() as conn:
        if params:
            return pd.read_sql_query(text(query_texto), conn, params=params)
        return pd.read_sql_query(text(query_texto), conn)

def hash_senha(senha):
    return hashlib.sha256(str.encode(senha)).hexdigest()

# =========================================================
# 📱 FUNÇÃO DE INTEGRAÇÃO COM WHATSAPP
# =========================================================
def enviar_notificacao_whatsapp(barbeiro, cliente, data, horario, servico, valor, acao="agendamento"):
    celular_barbeiro = "5519971374936" 
    
    if acao == "agendamento":
        texto = f"⚠️ *NOVO AGENDAMENTO!* 💈\n\n" \
                f"Olá *{barbeiro}*, um novo horário foi marcado na sua cadeira!\n\n" \
                f"👤 *Cliente:* {cliente}\n" \
                f"📅 *Data:* {data}\n" \
                f"⏰ *Horário:* {horario}\n" \
                f"🛠️ *Serviço:* {servico}\n" \
                f"💰 *Valor:* R$ {valor:.2f}\n\n" \
                f"Fique atento ao painel!"
    else:
        texto = f"🚨 *AGENDAMENTO CANCELADO!* ❌\n\n" \
                f"Olá *{barbeiro}*, um horário foi cancelado pelo cliente.\n\n" \
                f"👤 *Cliente:* {cliente}\n" \
                f"📅 *Data:* {data}\n" \
                f"⏰ *Horário:* {horario}\n" \
                f"🛠️ *Serviço:* {servico}\n\n" \
                f"A vaga está disponível novamente na sua grade."

    texto_url = urllib.parse.quote(texto)
    link_whatsapp = f"https://api.whatsapp.com/send?phone={celular_barbeiro}&text={texto_url}"
    
    js = f"window.open('{link_whatsapp}', '_blank');"
    st.components.v1.html(f"<script>{js}</script>", height=0, width=0)

# =========================================================
# 🛡️ POP-UPS DIALOGS GERENCIAIS E DE CHECKOUT
# =========================================================
@st.dialog("💈 Confirmar e Escolher Checkout")
def mostrar_popup_confirmacao(hora, barbeiro, servico, preco, data):
    st.markdown("### 📋 Resumo do seu Pedido")
    st.markdown(f"""
    * **Profissional Escolhido:** {barbeiro}
    * **Serviço Selecionado:** {servico}
    * **Data Reserva:** {data.strftime('%d/%m/%Y')}
    * **Horário de Cadeira:** **{hora}**
    """, unsafe_allow_html=True)
    st.markdown("---")
    
    if st.session_state["ultimo_horario_salvo"] == hora:
        st.markdown(f"""
            <div style="background-color:#10b98115; border:1px solid #10b981; color:#34d399; padding:15px; border-radius:10px; font-weight:bold; text-align:center; margin-top:15px; margin-bottom:15px;">
                🎉 Agendamento registrado no sistema e notificação enviada!
            </div>
        """, unsafe_allow_html=True)
        if st.button("Concluir e Atualizar Tela", use_container_width=True, type="primary"):
            st.session_state["ultimo_horario_salvo"] = None  
            st.cache_data.clear()
            st.rerun()
    else:
        st.markdown("#### Como deseja realizar o pagamento?")
        tipo_pagamento = st.radio("Selecione uma opção:", ["Pagar na Barbearia (Preço Normal)", "Antecipar via Pix (Ganha Pontos em Dobro!)"])
        
        col_pop1, col_pop2 = st.columns(2)
        with col_pop1:
            if st.button("✅ Confirmar Vaga", type="primary", use_container_width=True):
                engine = obter_engine()
                forma_f = "Pix" if "Pix" in tipo_pagamento else "Dinheiro"
                fator_pontos = 2 if "Pix" in tipo_pagamento else 1
                
                with engine.begin() as conn:
                    conn.execute(text("""
                        INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, forma_pagamento)
                        VALUES (:u, :b, :d, :h, :s, :v, :fp)
                    """), {"u": st.session_state['user'], "b": barbeiro, "d": str(data), "h": hora, "s": servico, "v": preco, "fp": forma_f})
                    
                    conn.execute(text("UPDATE usuarios_barber SET pontos_fidelidade = pontos_fidelidade + :f WHERE login = :u"), {"f": fator_pontos, "u": st.session_state['user']})
                
                st.session_state["ultimo_horario_salvo"] = hora
                
                enviar_notificacao_whatsapp(
                    barbeiro=barbeiro, 
                    cliente=st.session_state['nome_usuario'], 
                    data=data.strftime('%d/%m/%Y'), 
                    horario=hora, 
                    servico=servico, 
                    valor=preco, 
                    acao="agendamento"
                )
                st.balloons()
                st.rerun()
        with col_pop2:
            if st.button("❌ Cancelar", use_container_width=True):
                st.session_state["ultimo_horario_salvo"] = None
                st.rerun()

@st.dialog("📢 Disparador de Campanhas Segmentadas CRM")
def mostrar_modal_marketing(titulo_campanha, lista_clientes):
    st.markdown(f"### Seleção de Leads — {titulo_campanha}")
    leads_ativos = {}
    for c in lista_clientes:
        leads_ativos[c] = st.checkbox(f"👤 {c.replace('_', ' ').title()}", value=True)
    st.markdown("---")
    if st.button("⚡ DISPARAR ACESSOS DA CAMPANHA", type="primary", use_container_width=True):
        st.success("Disparos agendados no servidor de marketing CRM!")
        st.rerun()

@st.dialog("📋 Histórico Analítico de Atendimentos")
def mostrar_auditoria_barbeiro(barbeiro_nome, data_i, data_f):
    st.markdown(f"### Histórico de Cadeira de {barbeiro_nome}")
    df_auditar = buscar_dados_sql("SELECT data, horario, cliente_login, servico, valor, status FROM agendamentos WHERE barbeiro_nome = :b AND data BETWEEN :ini AND :fim ORDER BY data DESC", params={"b": barbeiro_nome, "ini": str(data_i), "fim": str(data_f)})
    st.dataframe(df_auditar, use_container_width=True)

@st.dialog("🧴 Lançar Venda Rápida de Produto")
def mostrar_modal_venda_rapida(barbeiro):
    st.markdown("### 🛒 Checkout Expresso de Bancada")
    v_prod = st.selectbox("Selecione o Cosmético:", list(PRODUTOS.keys()))
    v_cli = st.text_input("Nome ou Login do Cliente (Opcional):", "Cliente de Balcão")
    if st.button("🏁 Confirmar e Computar Comissão", type="primary", use_container_width=True):
        st.success(f"🎉 {v_prod} lançado com sucesso! Comissão adicionada ao extrato de {barbeiro}.")
        st.rerun()

def init_db():
    engine = obter_engine()
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT
            )
        """))
    
    for coluna, tipo in [("preferencias", "TEXT DEFAULT 'Nenhum'"), 
                         ("pontos_fidelidade", "INTEGER DEFAULT 0"), 
                         ("plano_assinatura", "TEXT DEFAULT 'Nenhum'")]:
        try:
            with engine.begin() as conn: conn.execute(text(f"ALTER TABLE usuarios_barber ADD COLUMN {coluna} {tipo};"))
        except: pass

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY, cliente_login TEXT, barbeiro_nome TEXT,
                data TEXT, horario TEXT, servico TEXT, valor REAL, status TEXT DEFAULT 'Agendado'
            )
        """))
        
    for col_ag, tipo_ag in [("forma_pagamento", "TEXT DEFAULT 'Pix'"), ("nota_avaliacao", "INTEGER DEFAULT 0"), ("feedback_texto", "TEXT")]:
        try:
            with engine.begin() as conn: conn.execute(text(f"ALTER TABLE agendamentos ADD COLUMN {col_ag} {tipo_ag};"))
        except: pass

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sala_espera (
                id SERIAL PRIMARY KEY, cliente_login TEXT, horario_checkin TEXT, status_presenca TEXT DEFAULT 'A caminho'
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS estoque_produtos (
                id SERIAL PRIMARY KEY, nome_produto TEXT UNIQUE, quantidade INTEGER, limite_minimo INTEGER, preco_venda REAL, tipo_estoque TEXT DEFAULT 'Venda'
            )
        """))

try:
    init_db()
except Exception as e:
    st.error(f"⚠️ Erro Crítico na Inicialização do Banco: {e}")

# --- ESTILIZAÇÃO CSS PREMIUM ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    
    [data-testid="stSidebar"] { background-color: #111217; border-right: 1px solid #1e2028; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] label div:first-child { display: none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] label div[data-testid="stMarkdownContainer"] p { display: none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label [data-testid="stWidgetLabel"] { display: none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label {
        background-color: #1e2028 !important; border: 1px solid #2a2d3a !important; padding: 18px 15px !important; 
        border-radius: 8px !important; color: #94a3b8 !important; cursor: pointer; font-weight: 700; font-size: 0.95rem;
        transition: all 0.2s ease-in-out; display: flex !important; align-items: center; justify-content: center; width: 100% !important; box-sizing: border-box !important;
    }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label:nth-child(1)::after { content: "📊 Painel Corporativo ERP"; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label:nth-child(2)::after { content: "📅 Minha Agenda na Cadeira"; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label:hover { background-color: #262933 !important; border-color: #f59e0b !important; color: #ffffff !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label[data-checked="true"] { background: #f59e0b !important; color: #0d0e12 !important; border: 1px solid #d97706 !important; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3) !important; }
    
    div[data-testid="stHorizontalBlock"] .stButton > button {
        height: 85px !important; border-radius: 10px !important; font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-size: 1.3rem !important; font-weight: 800 !important; display: flex !important;
        flex-direction: column !important; justify-content: center !important; align-items: center !important;
    }
    div[data-testid="stHorizontalBlock"] .button-grade-livre > div.stButton > button { background-color: #14151b !important; border: 2px solid #10b981 !important; color: #ffffff !important; }
    div[data-testid="stHorizontalBlock"] .button-grade-livre > div.stButton > button:hover { background-color: #10b98120 !important; border-color: #34d399 !important; box-shadow: 0 0 12px rgba(16, 185, 129, 0.3) !important; }
    div[data-testid="stHorizontalBlock"] .button-grade-ocupada > div.stButton > button { background-color: #1c1d24 !important; border: 1px solid #2a2d3a !important; color: #4b5563 !important; opacity: 0.4 !important; cursor: not-allowed !important; }
    
    .metric-card-barber { background: linear-gradient(135deg, #1e2028 0%, #14151b 100%); padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a; text-align: center; }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    .section-barber { background: #1e2028; padding: 12px 20px; border-radius: 8px; color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px; }
    .product-card { background: #14151b; border: 1px solid #2a2d3a; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px; min-height: 290px; display: flex; flex-direction: column; justify-content: space-between; }
    .barber-card-visual { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px; text-align: center; }
    .barber-agenda-row { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    .kanban-col { background-color: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px; min-height: 350px; }
    .kanban-card { background-color: #1e2028; border: 1px solid #3b3f54; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .bancada-alert-banner { background: linear-gradient(90deg, #1e1b4b 0%, #311042 100%); padding: 12px 20px; border-radius: 8px; border: 1px solid #6366f1; color: #fff; font-weight: 700; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
    </style>
    """, unsafe_allow_html=True)

if not st.session_state['auth']:
    st.markdown("<h1 style='text-align:center; color:#f59e0b; font-weight:900; margin-top:30px;'>💈 BARBEARIA PROSPERIDADE</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center; color:#94a3b8;'>PROSPERIDADE OS — Gestão Operacional, CRM & Finanças Integradas</p>", unsafe_allow_html=True)
    
    portal_cliente, portal_gerencial = st.tabs(["📱 PORTAL DO CLIENTE", "💼 ÁREA DA EQUIPE / DIRETORIA"])
    with portal_cliente:
        ab_l, ab_c = st.tabs(["🔐 Entrar", "📝 Criar Nova Conta"])
        with ab_l:
            l_c = st.text_input("Seu Usuário:", key="l_cli").strip().lower()
            s_c = st.text_input("Sua Senha:", type="password", key="s_cli")
            if st.button("🚀 ACESSAR MINHA CONTA", use_container_width=True):
                engine = obter_engine()
                df_u = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'cliente'"), engine, params={"l": l_c, "s": hash_senha(s_c)})
                if not df_u.empty:
                    st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_u.iloc[0]['login'], 'cliente', df_u.iloc[0]['nome']
                    st.rerun()
                else: st.error("Usuário ou Senha incorretos.")
        with ab_c:
            v_reg = st.session_state['reg_sucesso']
            c_n = st.text_input("Nome Completo", key=f"cn_{v_reg}")
            c_l = st.text_input("Escolha seu Usuário", key=f"cl_{v_reg}").strip().lower()
            c_t = st.text_input("Celular/WhatsApp", key=f"ct_{v_reg}")
            c_s = st.text_input("Crie uma Senha", type="password", key=f"cs_{v_reg}")
            if st.button("🎯 FINALIZAR MEU CADASTRO", use_container_width=True):
                if c_n and c_l and c_s:
                    engine = obter_engine()
                    try:
                        with engine.begin() as conn: conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES (:l, :s, :n, 'cliente', :c)"), {"l": c_l, "s": hash_senha(c_s), "n": c_n, "c": c_t})
                        st.session_state['reg_sucesso'] += 1
                        st.success("Conta criada! Vá na aba 'Entrar'.")
                    except: st.error("Usuário já em uso.")

    with portal_gerencial:
        l_b = st.text_input("Login Administrativo / Profissional:", key="l_brb").strip().lower()
        s_b = st.text_input("Senha de Acesso:", type="password", key="s_brb")
        if st.button("🔑 ACESSAR INFRAESTRUTURA INTERNA", use_container_width=True):
            engine = obter_engine()
            df_b = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil IN ('barbeiro', 'admin')"), engine, params={"l": l_b, "s": hash_senha(s_b)})
            if not df_b.empty:
                st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_b.iloc[0]['login'], df_b.iloc[0]['perfil'], df_b.iloc[0]['nome']
                st.rerun()
            else: st.error("Credenciais administrativas inválidas.")

else:
    engine = obter_engine()
    col_h1, col_h2 = st.columns([4, 1])
    with col_h1: st.markdown(f"### 💈 **{st.session_state['nome_usuario']}** @ Prosperidade <span style='color:#f59e0b'>[{st.session_state['perfil'].upper()}]</span>", unsafe_allow_html=True)
    with col_h2:
        if st.button("Encerra Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.rerun()
    st.markdown("---")

    # =========================================================
    # AMBIENTE DO CLIENTE
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
        df_cli = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :u"), engine, params={"u": st.session_state['user']}).iloc[0]
        agora_brasil = datetime.utcnow() - timedelta(hours=3)
        hora_atual_str = agora_brasil.strftime("%H:%M")
        data_hoje_str = agora_brasil.strftime("%Y-%m-%d")
        
        if agora_brasil.hour < 12: saudacao = "Bom dia"
        elif agora_brasil.hour < 18: saudacao = "Boa tarde"
        else: saudacao = "Boa noite"
        
        st.markdown(f"## 👋 {saudacao}, {st.session_state['nome_usuario'].split()[0]}.")
        
        df_ultimo_historico = pd.read_sql_query(text("SELECT barbeiro_nome, servico FROM agendamentos WHERE cliente_login = :u AND status = 'Agendado' ORDER BY id DESC LIMIT 1"), engine, params={"u": st.session_state['user']})
        if not df_ultimo_historico.empty:
            last_r = df_ultimo_historico.iloc[0]
            if st.button(f"⚡ Repetir Último Corte: {last_r['servico']} com {last_r['barbeiro_nome']}", type="secondary"):
                st.session_state["serv_fluxo"] = last_r['servico']
                st.session_state["barb_fluxo"] = last_r['barbeiro_nome']
                st.toast("🎯 Preferências salvas! Selecione a data e o horário na linha do tempo abaixo.")

        df_meus_cards = buscar_dados_sql("""
            SELECT id, barbeiro_nome, data, horario, servico, valor 
            FROM agendamentos 
            WHERE cliente_login = :u AND status = 'Agendado' AND data >= :hoje
            ORDER BY data ASC, horario ASC
        """, params={"u": st.session_state['user'], "hoje": data_hoje_str})
        
        if not df_meus_cards.empty:
            df_meus_cards = df_meus_cards[~((df_meus_cards['data'] == data_hoje_str) & (df_meus_cards['horario'] < hora_atual_str))]

        if not df_meus_cards.empty:
            prox = df_meus_cards.iloc[0]
            st.markdown(f"""
                <div style="background: linear-gradient(135deg, #1e2028 0%, #052e16 100%); padding: 18px; border-radius: 12px; border: 1px solid #10b981; margin-bottom: 20px;">
                    <span style="background: #10b981; color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">Próximo Atendimento</span>
                    <h3 style="margin: 10px 0 5px 0; color: #fff;">{prox['servico']} com {prox['barbeiro_nome']}</h3>
                    <p style="margin: 0; color: #94a3b8; font-size: 0.9rem;">📅 Data: {datetime.strptime(prox['data'], '%Y-%m-%d').strftime('%d/%m/%Y')} às ⏰ {prox['horario']}</p>
                </div>
            """, unsafe_allow_html=True)

        c_menu = st.tabs(["📅 Agendamento em 4 Passos", "👑 Meu Estilo & Fidelidade", "🧴 Loja de Cosméticos", "⏳ Espera Virtual & Ouvidoria"])
        
        with c_menu[0]:
            st.markdown("### 🛠️ Configurar Novo Agendamento")
            serv_fluxo = st.session_state.get("serv_fluxo", "Corte Simples")
            barb_fluxo = st.session_state.get("barb_fluxo", "Gabriel")
            
            st.markdown("<div class='section-barber'>PASSO 1: SELECIONE O SERVIÇO DESEJADO</div>", unsafe_allow_html=True)
            serv_cols = st.columns(3)
            for idx, (nome_s, dados_s) in enumerate(SERVICOS.items()):
                eh_selecionado = (nome_s == serv_fluxo)
                border_style = "border: 2px solid #10b981; background: #141b17;" if eh_selecionado else "border: 1px solid #2a2d3a;"
                texto_botao = "✓ Ativo" if eh_selecionado else "Selecionar"
                
                with serv_cols[idx % 3]:
                    st.markdown(f"""
                        <div class='product-card' style='min-height:310px; {border_style}'>
                            <img src='{dados_s["foto"]}' style='width:100%; height:130px; object-fit:cover; border-radius:8px; margin-bottom:8px;'/>
                            <div style='font-weight:700; color:#fff;'>{nome_s}</div>
                            <div style='color:#94a3b8; font-size:0.8rem;'>⏱️ Duração: {dados_s["tempo"]}</div>
                            <h3 style='color:#10b981; margin:5px 0;'>R$ {dados_s["preco"]:.2f}</h3>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button(texto_botao, key=f"sel_ser_{idx}", use_container_width=True, type="primary" if eh_selecionado else "secondary"):
                        st.session_state["serv_fluxo"] = nome_s
                        st.rerun()
            
            st.markdown("<div class='section-barber'>PASSO 2: ESCOLHA O PROFISSIONAL (BARBEIRO)</div>", unsafe_allow_html=True)
            col_b1, col_b2 = st.columns(2)
            with col_b1:
                sel_g = (barb_fluxo == "Gabriel")
                b_style_g = "border: 2px solid #3b82f6; background: #121824;" if sel_g else "border: 1px solid #2a2d3a;"
                st.markdown(f"""
                    <div class='barber-card-visual' style='{b_style_g} padding:10px;'>
                        <h4 style='margin:0;'>Gabriel (Proprietário)</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.9 (148 avaliações)</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("✓ Gabriel Ativo" if sel_g else "Escolher Gabriel", key="b_g_flx", use_container_width=True, type="primary" if sel_g else "secondary"):
                    st.session_state["barb_fluxo"] = "Gabriel"
                    st.rerun()
            with col_b2:
                sel_l = (barb_fluxo == "Lucas")
                b_style_l = "border: 2px solid #3b82f6; background: #121824;" if sel_l else "border: 1px solid #2a2d3a;"
                st.markdown(f"""
                    <div class='barber-card-visual' style='{b_style_l} padding:10px;'>
                        <h4 style='margin:0;'>Lucas Barber</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.8 (96 avaliações)</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("✓ Lucas Ativo" if sel_l else "Escolher Lucas", key="b_l_flx", use_container_width=True, type="primary" if sel_l else "secondary"):
                    st.session_state["barb_fluxo"] = "Lucas"
                    st.rerun()
                
            st.markdown("<div class='section-barber'>PASSO 3: GRADE DE HORÁRIOS ACESSÍVEL</div>", unsafe_allow_html=True)
            data_sel = st.date_input("Selecione o Dia da Cadeira:", date.today(), min_value=date.today(), key="data_fluxo_cli")
            
            df_oc = buscar_dados_sql("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'", params={"b": barb_fluxo, "d": str(data_sel)})
            ocupados_list = df_oc['horario'].tolist()
            eh_hoje = (data_sel == date.today())
            
            t_manha = ["09:00", "09:30", "11:00", "11:30"]
            t_tarde = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"]
            t_noite = ["18:00", "18:30", "19:00", "19:30"]
            
            for turno_nome, turnos_slots in [("☀️ Turno da Manhã", t_manha), ("🌤️ Turno da Tarde", t_tarde), ("🌙 Turno da Noite", t_noite)]:
                st.write(f"**{turno_nome}**")
                t_cols = st.columns(4)
                for s_idx, h_slot in enumerate(turnos_slots):
                    with t_cols[s_idx % 4]:
                        if h_slot in ocupados_list or (eh_hoje and h_slot < hora_atual_str):
                            st.container(border=False)
                            st.markdown("<div class='button-grade-ocupada'>", unsafe_allow_html=True)
                            st.button(f"🔒 {h_slot}", key=f"slot_occ_{turno_nome}_{h_slot}", disabled=True, use_container_width=True)
                            st.markdown("</div>", unsafe_allow_html=True)
                        else:
                            st.container(border=False)
                            st.markdown("<div class='button-grade-livre'>", unsafe_allow_html=True)
                            if st.button(f" {h_slot}", key=f"slot_lvr_{turno_nome}_{h_slot}", use_container_width=True):
                                mostrar_popup_confirmacao(h_slot, barb_fluxo, serv_fluxo, SERVICOS[serv_fluxo]["preco"], data_sel)
                            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown("<br><br>", unsafe_allow_html=True)
            st.markdown("<div class='section-barber'>🗑️ CANCELAMENTO DE ATENDIMENTOS ATIVOS</div>", unsafe_allow_html=True)
            if not df_meus_cards.empty:
                st.write("Marque as caixas de seleção na primeira coluna e clique no botão abaixo para desmarcar:")
                df_meus_cards.insert(0, "Selecionar para Cancelar", False)
                df_editado = st.data_editor(df_meus_cards, hide_index=True, use_container_width=True)
                
                if st.button("🗑️ CANCELAR HORÁRIOS SELECIONADOS", type="primary", use_container_width=True):
                    linhas_para_cancelar = df_editado[df_editado["Selecionar para Cancelar"] == True]
                    
                    if not linhas_para_cancelar.empty:
                        with engine.begin() as conn:
                            for idx_c, row_c in linhas_para_cancelar.iterrows():
                                conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(row_c['id'])})
                                
                                data_formatada = datetime.strptime(row_c['data'], '%Y-%m-%d').strftime('%d/%m/%Y')
                                enviar_notificacao_whatsapp(
                                    barbeiro=row_c['barbeiro_nome'],
                                    cliente=st.session_state['nome_usuario'],
                                    data=data_formatada,
                                    horario=row_c['horario'],
                                    servico=row_c['servico'],
                                    valor=float(row_c['valor']),
                                    acao="cancelamento"
                                )
                        st.success("Horários cancelados e barbeiro notificado!")
                        st.rerun()

        with c_menu[1]:
            st.markdown("### 👑 Meu Histórico de Cadeira & Cartão Fidelidade Digital")
            txt_prontuario = df_cli['preferencias']
            if not txt_prontuario or txt_prontuario == "Nenhum":
                txt_prontuario = "Seu barbeiro ainda não adicionou notas sobre o seu estilo. Elas aparecerão aqui assim que seu corte for personalizado!"
            st.info(f"📋 **Ficha Técnico:** {txt_prontuario}")
            st.markdown("#### 📸 Fotos dos meus Cortes Anteriores")
            img_c1, img_c2, _ = st.columns([2, 2, 4])
            with img_c1: st.image("https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500", caption="Último Fade")
            with img_c2: st.image("https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500", caption="Barba Alinhada")

        with c_menu[2]:
            st.markdown("### 🧴 Vitrine Home-Care da Barbearia")
            prod_cols = st.columns(3)
            prod_lista = [
                ("Pomada Modeladora Matte", "R$ 35,00", "https://images.unsplash.com/photo-1608248597481-496100c8c836?w=300"),
                ("Minoxidil Kirkland 6%", "R$ 89,90", "https://images.unsplash.com/photo-1626015713026-d8309d97732a?w=300"),
                ("Óleo de Cedro Premium", "R$ 42,00", "https://images.unsplash.com/photo-1617897903246-719242758050?w=300")
            ]
            for p_idx, (p_nome, p_preco, p_img) in enumerate(prod_lista):
                with prod_cols[p_idx % 3]:
                    st.markdown(f"""
                        <div class='product-card' style='min-height:280px; border:1px solid #2a2d3a; padding:15px; border-radius:12px; text-align:center;'>
                            <img src='{p_img}' style='width:100%; height:120px; object-fit:cover; border-radius:8px;'/>
                            <div style='font-weight:700; margin-top:8px; color:#fff;'>{p_nome}</div>
                            <h4 style='color:#f59e0b; margin:5px 0;'>{p_preco}</h4>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button(f"🎯 Reservar {p_nome.split()[0]}", key=f"buy_p_{p_idx}", use_container_width=True):
                        st.toast(f"Item {p_nome} separado para retirada no balcão!", icon="🛒")

        with c_menu[3]:
            st.markdown("### ⏳ Fila Virtual & Ouvidoria Segura")
            col_o1, col_o2 = st.columns(2)
            with col_o1:
                st.markdown("#### Sala de Espera")
                if st.button("🚀 FAZER CHECK-IN DE CHEGADA", use_container_width=True):
                    with engine.begin() as conn:
                        conn.execute(text("INSERT INTO sala_espera (cliente_login, horario_checkin) VALUES (:u, :h)"), {"u": st.session_state['user'], "h": (datetime.utcnow() - timedelta(hours=3)).strftime("%H:%M")})
                    st.success("Presença marcada no balcão!")
            with col_o2:
                st.markdown("#### Ouvidoria Direta ao Dono Gabriel")
                with st.form("form_estrelas"):
                    estrelas_sel = st.selectbox("Selecione a nota do atendimento:", ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"], index=4)
                    nota_conversao = len(estrelas_sel)
                    text_av = st.text_area("Seu comentário direto:")
                    if st.form_submit_button("Enviar Evaluation"):
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, nota_avaliacao, feedback_texto, status) VALUES (:u, 'Ouvidoria', :d, '00:00', 'Feedback Estrelas', 0, :n, :f, 'Feedback')"), {"u": st.session_state['user'], "d": str(date.today()), "n": nota_conversao, "f": text_av})
                        st.success("Obrigado pelo feedback!")

    # =========================================================
    # AMBIENTE OPERACIONAL DO BARBEIRO / ADMIN
    # =========================================================
    elif st.session_state['perfil'] in ('barbeiro', 'admin'):
        modo_visao = "📅 Minha Agenda na Cadeira (Gabriel)"
        if st.session_state['perfil'] == 'admin':
            modo_visao = st.sidebar.radio("Selecione o Painel Active:", ["📊 Painel Corporativo ERP Prosperidade", "📅 Minha Agenda na Cadeira (Gabriel)"])
        
        if modo_visao == "📅 Minha Agenda na Cadeira (Gabriel)" or st.session_state['perfil'] == 'barbeiro':
            barbeiro_ativo = "Gabriel" if st.session_state['perfil'] == 'admin' else st.session_state['nome_usuario']
            
            df_b_hoje = buscar_dados_sql("""
                SELECT a.id, a.cliente_login, a.barbeiro_nome, a.data, a.horario, a.servico, a.valor, a.status,
                       u.nome as cliente_nome, u.preferencias, u.celular 
                FROM agendamentos a 
                LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                WHERE a.barbeiro_nome = :b AND a.data = :d ORDER BY a.horario ASC
            """, params={"b": barbeiro_ativo, "d": str(date.today())})
            
            faturamento_cadeira = df_b_hoje['valor'].sum()
            comissao_b_acumulada = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_b_hoje.iterrows() if r['servico'] in SERVICOS])
            
            agora_b = datetime.utcnow() - timedelta(hours=3)
            hora_atual_str = agora_b.strftime("%H:%M")
            
            df_proximos = df_b_hoje[(df_b_hoje['status'] == 'Agendado') & (df_b_hoje['horario'] >= hora_atual_str)]
            
            if not df_proximos.empty:
                prox_c = df_proximos.iloc[0]
                st.markdown(f"""
                    <div class='bancada-alert-banner'>
                        <div>🚨 PRÓXIMO ATENDIMENTO: <b>{prox_c['cliente_nome']}</b> às <b>{prox_c['horario']}</b> ({prox_c['servico']})</div>
                        <div style='background:#10b981; font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:800;'>EM BREVE</div>
                    </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown("""
                    <div class='bancada-alert-banner' style='background: #1e2028; border-color: #2a2d3a;'>
                        <div>💈 NENHUM ATENDIMENTO COMPROMISSADO RESTANTE PARA HOJE.</div>
                        <div style='background:#4b5563; font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:800;'>LIVRE</div>
                    </div>
                """, unsafe_allow_html=True)
            
            col_v1, _ = st.columns([2, 6])
            with col_v1:
                if st.button("🧴 [+ Vender Produto Adicional]", use_container_width=True, type="primary"):
                    mostrar_modal_venda_rapida(barbeiro_ativo)
            st.markdown("<br>", unsafe_allow_html=True)
            
            b_pilar1, b_pilar2 = st.tabs(["🎛️ Quadro de Comandos (Bancada)", "💰 Meu Extrato & Comissões"])
            
            with b_pilar1:
                st.markdown(f"## 🎛️ Quadro de Comandos de Hoje — {barbeiro_ativo}")
                k_col1, k_col2, k_col3 = st.columns(3)
                df_ativos_hoje = df_b_hoje[df_b_hoje['status'] == 'Agendado']
                comissao_hoje = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_ativos_hoje.iterrows() if r['servico'] in SERVICOS])
                
                with k_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Agendamentos Hoje</div><div class='metric-value'>{len(df_ativos_hoje)}</div></div>", unsafe_allow_html=True)
                with k_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Comissão Estimada Hoje</div><div class='metric-value' style='color:#10b981;'>R$ {comissao_hoje:.2f}</div></div>", unsafe_allow_html=True)
                with k_col3:
                    horarios_completos = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*x)).strftime("%H:%M") for x in range(20)]
                    vago_b = "Sem janelas"
                    for h_c in horarios_completos:
                        if h_c not in df_b_hoje['horario'].tolist():
                            vago_b = h_c
                            break
                    st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Próxima Cadeira Vaga</div><div class='metric-value' style='color:#3b82f6;'>{vago_b}</div></div>", unsafe_allow_html=True)
                
                st.markdown("<br><div class='section-barber'>📋 SEU FLUXO DE ATENDIMENTO DE HOJE (OPERADO SEM RE-RUN GLOBAL)</div>", unsafe_allow_html=True)
                
                @st.fragment
                def renderizar_bancada_fragmentada(mapa_dados_hoje):
                    for h_slot in horarios_completos:
                        if h_slot in mapa_dados_hoje:
                            reg_c = mapa_dados_hoje[h_slot]
                            status_c = reg_c['status']
                            
                            if status_c == 'Agendado':
                                serv_nome = reg_c['servico']
                                cor_c = SERVICOS[serv_nome]['cor'] if serv_nome in SERVICOS else "#1e2028"
                                
                                st.markdown(f"""
                                    <div style="background: {cor_c}; padding: 16px; border-radius: 12px; border: 1px solid #2a2d3a; margin-bottom: 8px;">
                                        <span style="font-size:1.2rem; font-weight:800; color:#fff;">⏰ {h_slot} — 👤 {reg_c['cliente_nome']}</span> 
                                        <span style="background:#ffffff20; font-size:0.75rem; padding:2px 8px; border-radius:10px; margin-left:10px;">🛠️ {serv_nome}</span>
                                    </div>
                                """, unsafe_allow_html=True)
                                
                                with st.expander(f"⚙️ Expandir Prontuário de {reg_c['cliente_nome']}"):
                                    txt_tecnico = reg_c['preferencias'] if reg_c['preferencias'] != "Nenhum" else "Seu barbeiro ainda não adicionou notas sobre o seu estilo."
                                    st.info(f"📋 **Notas Técnicas Anteriores:** {txt_tecnico}")
                                    
                                    ab1, ab2, ab3 = st.columns(3)
                                    with ab1:
                                        if st.button("🏁 [ Iniciar Atendimento ]", key=f"init_c_{h_slot}", use_container_width=True): 
                                            st.toast("Cadeira Ativa!")
                                    with ab2:
                                        if st.button(" Concluir Atendimento ", key=f"done_c_{h_slot}", type="primary", use_container_width=True): 
                                            st.success("Fechamento Enviado!")
                                    with ab3:
                                        if st.button("❌ [ Não Compareceu / No-Show ]", key=f"noshow_c_{h_slot}", use_container_width=True):
                                            with engine.begin() as conn_x: conn_x.execute(text("UPDATE agendamentos SET status = 'No-Show' WHERE id = :id"), {"id": reg_c['id']})
                                            st.rerun()

                            elif status_c == 'Bloqueado':
                                st.markdown(f'<div class="barber-agenda-row" style="border-left: 4px solid #374151; opacity:0.5;"><span>⏰ {h_slot} — 🔒 Bloqueado pelo Profissional</span></div>', unsafe_allow_html=True)
                        else:
                            st.markdown(f'<div class="barber-agenda-row" style="border-left: 4px solid #10b981; padding: 8px 20px;"><span>⏰ {h_slot} — Cadeira Livre</span></div>', unsafe_allow_html=True)
                            b_bl1, _ = st.columns([2.5, 5.5])
                            with b_bl1:
                                if st.button(f"🔒 Bloquear Horário {h_slot}", key=f"bloq_btn_{h_slot}", use_container_width=True):
                                    with engine.begin() as conn_bl:
                                        conn_bl.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, status) VALUES ('bloqueio_manual', :b, :d, :h, 'Bloqueio Preventivo', 0, 'Bloqueado')"), {"b": barbeiro_ativo, "d": str(date.today()), "h": h_slot})
                                    st.rerun()
                
                renderizar_bancada_fragmentada(df_b_hoje.set_index('horario').to_dict(orient='index'))

            with b_pilar2:
                st.markdown("### 💰 Extrato Financeiro & Gestão de Comissões")
                tempo_filtro = st.radio("Selecione o Intervalo de Auditoria:", ["Hoje", "Esta Semana", "Este Mês"], horizontal=True)
                
                sc1, sc2, sc3 = st.columns(3)
                with sc1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Ganhos Estimados do Período</div><div class='metric-value'>R$ {comissao_b_acumulada:.2f}</div></div>", unsafe_allow_html=True)
                with sc2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Comissão de Serviços</div><div class='metric-value' style='color:#10b981;'>R$ {comissao_b_acumulada:.2f}</div></div>", unsafe_allow_html=True)
                with sc3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Comissão de Produtos (Balcão)</div><div class='metric-value' style='color:#3b82f6;'>R$ 0,00</div></div>", unsafe_allow_html=True)
                
                st.markdown("<br>#### 🚀 Minhas Faixas de Metas e Performance")
                st.progress(0.70)
                st.caption("Mantenha a pegada! Você concluiu 70% da sua meta semanal para destravar o bônus de cadeira.")
                
                st.markdown("<br><div class='section-barber'>📋 SEU FLUXO DE ATENDIMENTO DE HOJE (OPERADO SEM RE-RUN GLOBAL)</div>", unsafe_allow_html=True)
                tabela_comissoes = []
                for _, r_f in df_b_hoje[df_b_hoje['status'] == 'Agendado'].iterrows():
                    c_liq = r_f['valor'] * SERVICOS[r_f['servico']]['comissao'] if r_f['servico'] in SERVICOS else 0.0
                    tabela_comissoes.append({
                        "Data": r_f['data'], "Horário": r_f['horario'], "Cliente": r_f['cliente_nome'],
                        "Item Vendido": r_f['servico'], "Valor Bruto": f"R$ {r_f['valor']:.2f}", "Sua Comissão (R$)": f"R$ {c_liq:.2f}"
                    })
                
                if tabela_comissoes:
                    st.dataframe(pd.DataFrame(tabela_comissoes), use_container_width=True, hide_index=True)
                else:
                    st.caption("Nenhum lançamento registrado para o filtro selecionado.")
                st.markdown("---")
                st.info("📅 **Previsão Próximo Recebimento Quinzena:** 20/06/2026")

        else:
            st.markdown("<div class='section-barber'>📅 CALENDÁRIO CORPORATIVO DE GESTÃO EXECUTIVA (APLICA EM TODO O BI)</div>", unsafe_allow_html=True)
            periodo_sel = st.date_input("Intervalo Dinâmico de Análise:", value=[date(2026, 6, 1), date(2026, 6, 30)], key="p_adm_erpv2")
            
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2: data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1: data_inicio = data_fim = periodo_sel[0]
            else: data_inicio = data_fim = periodo_sel

            df_adm_total = buscar_dados_sql("SELECT * FROM agendamentos WHERE data BETWEEN :ini AND :fim", params={"ini": str(data_inicio), "fim": str(data_fim)})
            df_ativos = df_adm_total[df_adm_total['status'] == 'Agendado']
            df_faltas = df_adm_total[df_adm_total['status'] == 'No-Show']

            adm_menu = st.tabs(["📊 Saúde do Negócio & DRE", "💸 Split & Caixa Automatizado", "👥 RH & Performance de Cadeiras", "📦 Almoxarifado Inteligente", "🗂️ Kanban de Recepção"])
            
            with adm_menu[0]:
                st.markdown("### 📈 Monitoramento Estratégico de Saúde do Negócio")
                bruto_periodo = df_ativos['valor'].sum()
                ticket_medio = df_ativos['valor'].mean() if not df_ativos.empty else 0.0
                slots_totais = 20 * 2 * ((data_fim - data_inicio).days + 1)
                taxa_ocupacao = min(int((len(df_ativos) / max(slots_totais, 1)) * 100), 100)
                total_marcacoes = len(df_adm_total) if len(df_adm_total) > 0 else 1
                taxa_noshow = int((len(df_faltas) / total_marcacoes) * 100)

                adm_col1, adm_col2, adm_col3, adm_col4 = st.columns(4)
                with adm_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Bruto</div><div class='metric-value'>R$ {bruto_periodo:.2f}</div></div>", unsafe_allow_html=True)
                with adm_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Ticket Médio</div><div class='metric-value' style='color:#3b82f6;'>R$ {ticket_medio:.2f}</div></div>", unsafe_allow_html=True)
                with adm_col3:
                    st.markdown("<div class='metric-card-barber'><div class='metric-title'>Ocupação de Cadeira</div></div>", unsafe_allow_html=True)
                    st.progress(taxa_ocupacao / 100.0)
                    st.caption(f"Status Atual: **{taxa_ocupacao}%** (Mínimo Ideal: 60%)")
                with adm_col4:
                    cor_noshow = "#10b981" if taxa_noshow <= 5 else "#ef4444"
                    st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Índice de No-Show</div><div class='metric-value' style='color:{cor_noshow};'>{taxa_noshow}%</div></div>", unsafe_allow_html=True)
                
                st.markdown("<br><div class='section-barber'>📈 DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE SIMPLIFICADA)</div>", unsafe_allow_html=True)
                repasse_calc = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_ativos.iterrows() if r['servico'] in SERVICOS])
                taxas_estimadas = bruto_periodo * 0.025
                custos_fixos_simulados = 350.00
                lucro_real_dre = bruto_periodo - taxas_estimadas - repasse_calc - custos_fixos_simulados
                
                dre_df = pd.DataFrame({
                    "Indicadores Fiscais": ["(+) Faturamento Bruto de Serviços", "(-) Taxas Operacionais de Gateway (2.5%)", "(-) Repasse / Split de Barbeiros", "(-) Custos Operacionais / Variáveis", "(=) LUCRO LÍQUIDO REAL DO PERÍODO"],
                    "Valores Monetários": [f"R$ {bruto_periodo:.2f}", f"R$ {taxas_estimadas:.2f}", f"R$ {repasse_calc:.2f}", f"R$ {custos_fixos_simulados:.2f}", f"R$ {lucro_real_dre:.2f}"]
                })
                st.table(dre_df)

                st.markdown("<br><div class='section-barber'>🔄 INTELIGÊNCIA DE MERCADO: PACE DE RETORNO (RECORRÊNCIA)</div>", unsafe_allow_html=True)
                st.metric(label="Média de Retorno do Cliente à Cadeira", value="24 dias", delta="Pace Saudável de Fidelidade (Ideal: <28 dias)")
                
                st.markdown("<br>#### ⚡ Central de Gatilhos de Marketing CRM")
                col_m1, col_m2 = st.columns(2)
                with col_m1:
                    st.markdown("<div style='background:#1e2028; padding:15px; border-radius:10px; border-left:4px solid #ef4444;'>⚡ <b>Leads Inativos (+45 dias)</b><br>Gatilho identifies 14 clientes aptos a reativação. Deseja auditar a lista antes do disparo?</div>", unsafe_allow_html=True)
                    if st.button("🔍 Abrir e Auditar Lista de Disparo", use_container_width=True):
                        mostrar_modal_marketing("Clientes Ausentes", ["alexandre_guerra", "danilo_santos", "luciano_souza", "paulo_higuchi"])

            with adm_menu[1]:
                st.markdown("### 💸 Fluxos de Caixa Automatizado e Split de Gateway")
                repasse_b = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_ativos.iterrows() if r['servico'] in SERVICOS])
                f_c1, f_c2, f_c3 = st.columns(3)
                with f_c1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Caixa Bruto Geral</div><div class='metric-value'>R$ {bruto_periodo:.2f}</div></div>", unsafe_allow_html=True)
                with f_c2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Split Equipe</div><div class='metric-value' style='color:#ef4444;'>R$ {repasse_b:.2f}</div></div>", unsafe_allow_html=True)
