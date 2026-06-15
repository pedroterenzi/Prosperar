import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import hashlib
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
    "Cerveja Budweiser Long Neck": {"preco": 10.0, "tipo": "Venda"},
    "Gola Higiênica Rolo": {"preco": 0.0, "tipo": "Uso Interno"},
    "Shampoo Lavatório 5L": {"preco": 0.0, "tipo": "Uso Interno"}
}

@st.cache_resource
def obter_engine():
    return create_engine(CONNECTION_STRING, pool_pre_ping=True)

def hash_senha(senha):
    return hashlib.sha256(str.encode(senha)).hexdigest()

# =========================================================
# 🛡️ POP-UP DIALOG DE CONFIRMAÇÃO DE CHECKOUT
# =========================================================
@st.dialog("💈 Confirmar e Escolher Checkout")
def mostrar_popup_confirmacao(hora, barbeiro, servico, preco, data):
    st.markdown(f"### 📋 Resumo do seu Pedido")
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
                🎉 Agendado com sucesso no sistema para as {hora}!
            </div>
        """, unsafe_allow_html=True)
        if st.button("Concluir e Atualizar Tela", use_container_width=True, type="primary"):
            st.session_state["ultimo_horario_salvo"] = None  
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
                st.balloons()
                st.rerun()
        with col_pop2:
            if st.button("❌ Cancelar", use_container_width=True):
                st.session_state["ultimo_horario_salvo"] = None
                st.rerun()

def init_db():
    engine = obter_engine()
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT
            )
        """))
    
    for coluna, tipo in [("preferencias", "TEXT DEFAULT 'Gosta de café sem açúcar, usa pomada matte'"), 
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
        
        # Carga padrão de produtos uso interno vs venda
        if conn.execute(text("SELECT COUNT(*) FROM estoque_produtos")).fetchone()[0] == 0:
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda, tipo_estoque) VALUES ('Pomada Efeito Matte Elesid', 3, 5, 35.0, 'Venda')"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda, tipo_estoque) VALUES ('Minoxidil Kirkland 6%', 14, 4, 89.90, 'Venda')"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda, tipo_estoque) VALUES ('Gola Higiênica Rolo', 2, 5, 0.0, 'Uso Interno')"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda, tipo_estoque) VALUES ('Shampoo Lavatório 5L', 1, 2, 0.0, 'Uso Interno')"))

        # Cadastro padrão de contas administrativas
        conn.execute(text("""
            INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) 
            VALUES ('gabriel', :s, 'Gabriel (Proprietário)', 'admin', '19971374936')
            ON CONFLICT (login) DO UPDATE SET perfil = 'admin'
        """), {"s": hash_senha("123456")})
        
        conn.execute(text("""
            INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) 
            VALUES ('lucas', :s, 'Lucas Barber', 'barbeiro', '19999999999')
            ON CONFLICT (login) DO NOTHING
        """), {"s": hash_senha("123456")})

try:
    init_db()
except Exception as e:
    st.error(f"⚠️ Erro Crítico na Inicialização do Banco: {e}")

# =========================================================
# 🧪 FUNÇÃO INJETORA INTELIGENTE (SIMULAÇÃO DE MÉTRICAS)
# =========================================================
def injetar_dados_demonstracao():
    engine = obter_engine()
    clientes_fake = ['alexandre_guerra', 'leonardo_arengue', 'bruno_felicio', 'danilo_santos', 'luciano_souza', 'paulo_higuchi']
    barbeiros_fake = ['Gabriel', 'Lucas']
    servicos_fake = list(SERVICOS.keys())
    formas_p = ['Pix', 'Cartão de Crédito', 'Dinheiro']
    feedbacks = ['Excelente atendimento', 'Corte impecável', 'Atrasou 5 minutos', 'Muito profissional', 'Gostei do café']
    
    hoje = date.today()
    
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM agendamentos;"))
        conn.execute(text("DELETE FROM sala_espera;"))
        
        for idx, cli in enumerate(clientes_fake):
            nome_formatado = cli.replace('_', ' ').title()
            pontos = 8 if idx == 2 else 3
            plano = 'VIP Executivo' if idx == 0 else 'Nenhum'
            conn.execute(text("""
                INSERT INTO usuarios_barber (login, senha, nome, perfil, celular, pontos_fidelidade, plano_assinatura)
                VALUES (:l, 'sistema', :n, 'cliente', '19999999999', :p, :pl)
                ON CONFLICT (login) DO NOTHING
            """), {"l": cli, "n": nome_formatado, "p": pontos, "pl": plano})
        
        contador = 0
        for i in range(-50, 10):  
            data_alvo = hoje + timedelta(days=i)
            for j, hora in enumerate(["09:30", "11:00", "14:30", "16:00", "17:30"]):
                if (i + j) % 2 == 0 or i == 0: 
                    cliente = clientes_fake[(i + j) % len(clientes_fake)]
                    barbeiro = barbeiros_fake[(i * j) % len(barbeiros_fake)]
                    servico = servicos_fake[(j) % len(servicos_fake)]
                    valor = SERVICOS[servico]["preco"]
                    fp = formas_p[(i + j) % len(formas_p)]
                    nota = 5 if (i+j) % 4 != 0 else 3
                    fb = feedbacks[(i+j) % len(feedbacks)] if nota == 5 else 'O corte foi bom, mas a cadeira atrasou um pouco.'
                    
                    conn.execute(text("""
                        INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, status, forma_pagamento, nota_avaliacao, feedback_texto)
                        VALUES (:u, :b, :d, :h, :s, :v, 'Agendado', :fp, :nt, :fb)
                    """), {"u": cliente, "b": barbeiro, "d": str(data_alvo), "h": hora, "s": servico, "v": valor, "fp": fp, "nt": nota, "fb": fb})
                    contador += 1
    return contador

# --- ESTILIZAÇÃO CSS PREMIUM ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    
    /* --- ENVELOPE DO MENU LATERAL MODERNO E QUADRADO --- */
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
    
    /* --- CORREÇÃO DE ALINHAMENTO DO IMAGE_84BC22.PNG --- */
    .time-slot-card-premium {
        background: #14151b;
        border: 1px solid #2a2d3a;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
        height: 100px; /* Garante tamanho idêntico em todas as colunas */
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        margin-bottom: 10px;
    }
    
    /* Customização dos botões invisíveis nativos do Streamlit para agirem como o card inteiro */
    div.stButton > button.slot-banco-click {
        background-color: transparent !important;
        border: none !important;
        color: transparent !important;
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100px;
        z-index: 10;
        cursor: pointer;
    }
    
    .metric-card-barber { background: linear-gradient(135deg, #1e2028 0%, #14151b 100%); padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a; text-align: center; }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    .section-barber { background: #1e2028; padding: 12px 20px; border-radius: 8px; color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px; }
    .product-card { background: #14151b; border: 1px solid #2a2d3a; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px; min-height: 290px; display: flex; flex-direction: column; justify-content: space-between; }
    .barber-card-visual { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px; text-align: center; }
    .barber-agenda-row { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
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
        hora_int = agora_brasil.hour
        
        if hora_int < 12: saudacao = "Bom dia"
        elif hora_int < 18: saudacao = "Boa tarde"
        else: saudacao = "Boa noite"
        
        st.markdown(f"## 👋 {saudacao}, {st.session_state['nome_usuario'].split()[0]}. Bora dar um tapa no visual?")
        
        df_meus_cards = pd.read_sql_query(text("SELECT id, barbeiro_nome, data, horario, servico, valor FROM agendamentos WHERE cliente_login = :u AND status = 'Agendado' ORDER BY data ASC, horario ASC"), engine, params={"u": st.session_state['user']})
        
        if not df_meus_cards.empty:
            prox = df_meus_cards.iloc[0]
            st.markdown(f"""
                <div style="background: linear-gradient(135deg, #1e2028 0%, #2e1a05 100%); padding: 20px; border-radius: 12px; border: 1px solid #f59e0b; margin-bottom: 20px;">
                    <span style="background: #f59e0b; color: #000; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">Próximo Agendamento</span>
                    <h3 style="margin: 10px 0 5px 0; color: #fff;">{prox['servico']} com {prox['barbeiro_nome']}</h3>
                    <p style="margin: 0; color: #94a3b8; font-size: 0.9rem;">📅 Data: {datetime.strptime(prox['data'], '%Y-%m-%d').strftime('%d/%m/%Y')} às ⏰ {prox['horario']}</p>
                </div>
            """, unsafe_allow_html=True)
            
            col_gps1, col_gps2, _ = st.columns([1.5, 1.5, 5])
            with col_gps1: st.markdown('<a href="https://maps.google.com" target="_blank" style="text-decoration:none;"><div style="background-color:#4285F4; padding:10px; color:white; border-radius:8px; text-align:center; font-weight:700; font-size:0.85rem;">🗺️ ABRIR NO GOOGLE MAPS</div></a>', unsafe_allow_html=True)
            with col_gps2: st.markdown('<a href="https://waze.com" target="_blank" style="text-decoration:none;"><div style="background-color:#33CCFF; padding:10px; color:black; border-radius:8px; text-align:center; font-weight:700; font-size:0.85rem;">🚙 ABRIR NO WAZE</div></a>', unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)

        c_menu = st.tabs(["📅 Agendamento em 4 Passos", "👑 Meu Estilo & Fidelidade", "🧴 Loja de Cosméticos", "⏳ Espera Virtual & Ouvidoria"])
        
        with c_menu[0]:
            st.markdown("### 🛠️ Configurar Novo Agendamento")
            serv_fluxo = st.session_state.get("serv_fluxo", "Corte Simples")
            barb_fluxo = st.session_state.get("barb_fluxo", "Gabriel")
            
            st.markdown("<div class='section-barber'>PASSO 1: SELECIONE O SERVIÇO DESEJADO</div>", unsafe_allow_html=True)
            serv_cols = st.columns(3)
            for idx, (nome_s, dados_s) in enumerate(SERVICOS.items()):
                eh_selecionado = (nome_s == serv_fluxo)
                border_style = "border: 2px solid #f59e0b; background: #1e2028;" if eh_selecionado else "border: 1px solid #2a2d3a;"
                texto_botao = "✓ Selecionado" if eh_selecionado else f"Selecionar {nome_s.split()[0]}"
                
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
                b_style_g = "border: 2px solid #f59e0b; background: #1e2028;" if sel_g else "border: 1px solid #2a2d3a;"
                st.markdown(f"""
                    <div class='barber-card-visual' style='{b_style_g}'>
                        <img src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' style='border-radius:50%; width:70px; height:70px; object-fit:cover;'/>
                        <h4 style='margin:5px 0 0 0;'>Gabriel (Proprietário)</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.9 (148 avaliações)</p>
                        <p style='color:#94a3b8; font-size:0.75rem;'>Degradê & Visagismo Executivo</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("✓ Gabriel Ativo" if sel_g else "Escolher Gabriel", use_container_width=True, type="primary" if sel_g else "secondary"):
                    st.session_state["barb_fluxo"] = "Gabriel"
                    st.rerun()
            with col_b2:
                sel_l = (barb_fluxo == "Lucas")
                b_style_l = "border: 2px solid #f59e0b; background: #1e2028;" if sel_l else "border: 1px solid #2a2d3a;"
                st.markdown(f"""
                    <div class='barber-card-visual' style='{b_style_l}'>
                        <img src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' style='border-radius:50%; width:70px; height:70px; object-fit:cover;'/>
                        <h4 style='margin:5px 0 0 0;'>Lucas Barber</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.8 (96 avaliações)</p>
                        <p style='color:#94a3b8; font-size:0.75rem;'>Mestre das Barbas & Toalha Quente</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("✓ Lucas Ativo" if sel_l else "Escolher Lucas", use_container_width=True, type="primary" if sel_l else "secondary"):
                    st.session_state["barb_fluxo"] = "Lucas"
                    st.rerun()
                
            st.markdown("<div class='section-barber'>PASSO 3: GRADE DE HORÁRIOS DIVIDIDA POR TURNOS</div>", unsafe_allow_html=True)
            data_sel = st.date_input("Selecione o Dia da Cadeira:", date.today(), min_value=date.today(), key="data_fluxo_cli")
            
            df_oc = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"), engine, params={"b": barb_fluxo, "d": str(data_sel)})
            ocupados_list = df_oc['horario'].tolist()
            eh_hoje = (data_sel == date.today())
            
            t_manha = ["09:00", "09:30", "11:00", "11:30"]
            t_tarde = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"]
            t_noite = ["18:00", "18:30", "19:00", "19:30"]
            
            # --- CORREÇÃO CIRÚRGICA DE ALINHAMENTO DA GRADE (image_84bc22.png) ---
            for turno_nome, turnos_slots in [("☀️ Turno da Manhã", t_manha), ("🌤️ Turno da Tarde", t_tarde), ("🌙 Turno da Noite", t_noite)]:
                st.write(f"**{turno_nome}**")
                t_cols = st.columns(4)
                for s_idx, h_slot in enumerate(turnos_slots):
                    with t_cols[s_idx % 4]:
                        if h_slot in ocupados_list or (eh_hoje and h_slot < hora_atual_str):
                            # Card Reservado - Ocupa exatamente 100px de altura
                            st.markdown(f"""
                                <div class='time-slot-card-premium' style='border-color:#ef4444; opacity:0.55;'>
                                    <span style='color:#f87171; font-size:0.75rem; font-weight:700;'>🔴 RESERVADO</span>
                                    <h3 style='margin:5px 0 0 0; font-weight:800; letter-spacing:1px; color:#94a3b8;'>{h_slot}</h3>
                                </div>
                            """, unsafe_allow_html=True)
                        else:
                            # Card Livre Integrado - O botão preenche e ativa o card transparente de 100px
                            st.markdown(f"""
                                <div class='time-slot-card-premium' style='border-color:#10b981; position:relative;'>
                                    <span style='color:#34d399; font-size:0.75rem; font-weight:700;'>🟢 LIVRE</span>
                                    <h3 style='margin:5px 0 0 0; font-weight:800; letter-spacing:1px; color:#fff;'>{h_slot}</h3>
                                </div>
                            """, unsafe_allow_html=True)
                            if st.button("", key=f"slot_flx_{turno_nome}_{h_slot}", use_container_width=True):
                                mostrar_popup_confirmacao(h_slot, barb_fluxo, serv_fluxo, SERVICOS[serv_fluxo]["preco"], data_sel)

            st.markdown("<br><br>", unsafe_allow_html=True)
            st.markdown("<div class='section-barber'>X GERENCIAR MEUS AGENDAMENTOS ATIVOS</div>", unsafe_allow_html=True)
            if not df_meus_cards.empty:
                st.dataframe(df_meus_cards, use_container_width=True)
                id_cancelar_cliente = st.number_input("Digite o ID do agendamento que deseja desmarcar:", min_value=1, step=1, key="c_del_cli")
                if st.button("🚨 REMOVER HORÁRIO DA AGENDA", type="primary", use_container_width=True):
                    if id_cancelar_cliente in df_meus_cards['id'].values:
                        with engine.begin() as conn: conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_cancelar_cliente)})
                        st.success("Horário desmarcado com sucesso!")
                        st.rerun()

        with c_menu[1]:
            st.markdown("### 👑 Meu Perfil de Estilo & Fidelidade")
            col_fid1, col_fid2 = st.columns(2)
            with col_fid1:
                pontos = int(df_cli['pontos_fidelidade'])
                st.markdown(f"**Meu Cartão Fidelidade Digital: {pontos} / 10 Cortes**")
                st.progress(min(pontos / 10.0, 1.0))
                st.caption(f"Faltam exatamente {max(10 - pontos, 0)} cortes para você destravar sua hidratação premium!")
            with col_fid2:
                st.markdown(f"""
                    <div class='metric-card-barber' style='padding:12px; border-left:5px solid #3b82f6;'>
                        <div class='metric-title'>Plano VIP Prosperidade</div>
                        <div class='metric-value' style='font-size:1.6rem; color:#3b82f6; padding-top:5px;'>{df_cli['plano_assinatura']}</div>
                    </div>
                """, unsafe_allow_html=True)
                
            st.markdown("---")
            st.markdown("#### 🗒️ Ficha Técnica do meu Cabelo (Notas do Barbeiro)")
            st.info(f"📋 **Prontuário de Estilo:** {df_cli['preferencias']}")
            st.markdown("#### 📸 Fotos dos meus Cortes Anteriores")
            st.image(["https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=300", "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300"], width=150, caption=["Último Corte (Mid Fade)", "Corte Anterior (Cabelo + Barba)"])

        with c_menu[2]:
            st.markdown("### 🧴 Loja Home-Care da Barbearia Prosperidade")
            prod_cols = st.columns(3)
            prod_lista = [
                ("Elesid Pomada Efeito Matte", "R$ 35,00", "https://images.unsplash.com/photo-1608248597481-496100c8c836?w=300"),
                ("Minoxidil Kirkland 6%", "R$ 89,90", "https://images.unsplash.com/photo-1626015713026-d8309d97732a?w=300"),
                ("Óleo de Cedro Premium", "R$ 42,00", "https://images.unsplash.com/photo-1617897903246-719242758050?w=300")
            ]
            for p_idx, (p_nome, p_preco, p_img) in enumerate(prod_lista):
                with prod_cols[p_idx % 3]:
                    st.markdown(f"""
                        <div class='product-card' style='min-height:280px;'>
                            <img src='{p_img}' style='width:100%; height:120px; object-fit:cover; border-radius:8px;'/>
                            <div style='font-weight:700; margin-top:5px; color:#fff;'>{p_nome}</div>
                            <h4 style='color:#f59e0b; margin:2px 0;'>{p_preco}</h4>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button("Comprar e Retirar no Balcão", key=f"buy_p_{p_idx}", use_container_width=True):
                        st.toast(f"Pedido de {p_nome} reservado para seu próximo corte!", icon="🛒")

        with c_menu[3]:
            st.markdown("### ⏳ Check-in e Ouvidoria Privada")
            col_w1, col_w2 = st.columns(2)
            with col_w1:
                st.markdown("#### Sala de Espera Virtual")
                if st.button("🚀 FAZER CHECK-IN (AVISAR QUE CHEGUEI)", use_container_width=True):
                    with engine.begin() as conn:
                        conn.execute(text("INSERT INTO sala_espera (cliente_login, horario_checkin) VALUES (:u, :h)"), {"u": st.session_state['user'], "h": agora_brasil.strftime("%H:%M")})
                    st.success("Check-in realizado! Sua presença foi marcada no monitor da bancada.")
            with col_w2:
                st.markdown("#### Ouvidoria Direta com o Proprietário Gabriel")
                with st.form("ouvidoria_form"):
                    nota_av = st.slider("Avalie nosso atendimento:", 1, 5, 5)
                    text_av = st.text_area("Críticas, elogios ou notas sobre o atraso das cadeiras:")
                    if st.form_submit_button("Enviar Feedback Seguro"):
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, nota_avaliacao, feedback_texto, status) VALUES (:u, 'Ouvidoria', :d, '00:00', 'Feedback Privado', 0, :n, :f, 'Feedback')"), {"u": st.session_state['user'], "d": str(date.today()), "n": nota_av, "f": text_av})
                        st.success("Obrigado! Sua nota foi arquivada de forma privada no painel do Gabriel.")

    # =========================================================
    # AMBIENTE OPERACIONAL DO BARBEIRO / ADMIN
    # =========================================================
    elif st.session_state['perfil'] in ('barbeiro', 'admin'):
        modo_visao = "📅 Minha Agenda na Cadeira (Gabriel)"
        if st.session_state['perfil'] == 'admin':
            modo_visao = st.sidebar.radio("Selecione o Painel Active:", ["📊 Painel Corporativo ERP Prosperidade", "📅 Minha Agenda na Cadeira (Gabriel)"])
        
        if modo_visao == "📅 Minha Agenda na Cadeira (Gabriel)" or st.session_state['perfil'] == 'barbeiro':
            barbeiro_ativo = "Gabriel" if st.session_state['perfil'] == 'admin' else st.session_state['nome_usuario']
            
            with engine.connect() as conn:
                df_b_hoje = pd.read_sql_query(text("""
                    SELECT a.id, a.cliente_login, a.barbeiro_nome, a.data, a.horario, a.servico, a.valor, u.nome as cliente_nome, u.preferencias, u.celular 
                    FROM agendamentos a 
                    LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                    WHERE a.status = 'Agendado' AND a.barbeiro_nome = :b AND a.data = :d ORDER BY a.horario ASC
                """), conn, params={"b": barbeiro_ativo, "d": str(date.today())})
            
            faturamento_cadeira = df_b_hoje['valor'].sum()
            comissao_b_acumulada = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_b_hoje.iterrows() if r['servico'] in SERVICOS])
            
            b_pilar1, b_pilar2 = st.tabs(["🎛️ Quadro de Comandos (Bancada)", "💰 Meu Extrato & Comissões"])
            
            with b_pilar1:
                st.markdown(f"## 🎛️ Quadro de Comandos de Hoje — {barbeiro_ativo}")
                k_col1, k_col2, k_col3 = st.columns(3)
                with k_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Agendamentos Hoje</div><div class='metric-value'>{len(df_b_hoje)}</div></div>", unsafe_allow_html=True)
                with k_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Minha Comissão Líquida</div><div class='metric-value' style='color:#10b981;'>R$ {comissao_b_acumulada:.2f}</div></div>", unsafe_allow_html=True)
                with k_col3:
                    proximo_vago = "Sem janelas"
                    horarios_completos = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*x)).strftime("%H:%M") for x in range(20)]
                    ocupados_b = df_b_hoje['horario'].tolist()
                    for h_c in horarios_completos:
                        if h_c not in ocupados_b:
                            proximo_vago = h_c
                            break
                    st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Próxima Cadeira Vaga</div><div class='metric-value' style='color:#3b82f6;'>{proximo_vago}</div></div>", unsafe_allow_html=True)
                
                st.markdown("<br>", unsafe_allow_html=True)
                mapa_b = df_b_hoje.set_index('horario').to_dict(orient='index')
                
                for h_slot in horarios_completos:
                    if h_slot in mapa_b:
                        reg_c = mapa_b[h_slot]
                        serv_nome = reg_c['servico']
                        cor_card = SERVICOS[serv_nome]['cor'] if serv_nome in SERVICOS else "#1e2028"
                        
                        st.markdown(f"""
                            <div style="background: {cor_card}; padding: 16px; border-radius: 12px; border: 1px solid #2a2d3a; margin-bottom: 8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <span style="font-size:1.3rem; font-weight:800; color:#fff;">⏰ {h_slot}</span>
                                        <span style="font-size:1.15rem; font-weight:700; color:#fff; margin-left:15px;">👤 {reg_c['cliente_nome']}</span>
                                        <span style="background:#ffffff20; color:#fff; font-size:0.8rem; padding:3px 10px; border-radius:20px; margin-left:15px; font-weight:600;">🛠️ {serv_nome}</span>
                                    </div>
                                    <div style="font-size:1.2rem; font-weight:800; color:#10b981;">R$ {reg_c['valor']:.2f}</div>
                                </div>
                            </div>
                        """, unsafe_allow_html=True)
                        
                        with st.expander(f"⚙️ Operar Atendimento de {reg_c['cliente_nome']}", expanded=False):
                            st.warning(f"📋 **Prontuário de Estilo:** {reg_c['preferencias']}")
                            col_a1, col_a2, col_a3 = st.columns(3)
                            with col_a1:
                                if st.button("🏁 Iniciar Cadeira", key=f"start_{h_slot}"): st.toast("Cronômetro rodando!")
                            with col_a2:
                                if st.button("✔️ Concluir Venda", key=f"end_{h_slot}", type="primary"): st.toast("Fechamento enviado ao caixa!")
                            with col_a3:
                                if st.button("❌ No-Show", key=f"fault_{h_slot}"):
                                    with engine.begin() as conn: conn.execute(text("UPDATE agendamentos SET status = 'No-Show' WHERE id = :id"), {"id": reg_c['id']})
                                    st.rerun()
                    else:
                        st.markdown(f'<div class="barber-agenda-row" style="border-left: 4px solid #10b981; opacity:0.65;"><span>⏰ {h_slot} — Cadeira Livre</span></div>', unsafe_allow_html=True)

            with b_pilar2:
                st.markdown("### 💰 Extrato de Ganhos em Tempo Real")
                st.metric("Ganhos Estimados da Semana", f"R$ {comissao_b_acumulada * 4.5:.2f}")
                st.progress(0.75)
                st.caption("Falta pouco para atingir a próxima faixa de comissão extra mensal!")

        # =========================================================
        # 3. INTERFACE EXECUTIVE ERP DO PROPRIETÁRIO (GABRIEL DONO)
        # =========================================================
        else:
            adm_menu = st.tabs(["📊 Saúde do Negócio", "💸 Split & Caixa Automatizado", "👥 RH & Performance", "📦 Almoxarifado Inteligente", "➕ Recepção Kanban / Encaixe"])
            
            st.markdown("<div class='section-barber'>📅 CALENDÁRIO CORPORATIVO DE GESTÃO EXECUTIVA</div>", unsafe_allow_html=True)
            periodo_sel = st.date_input("Intervalo de Datas Executivas:", value=[date(2026, 6, 1), date(2026, 6, 30)], key="p_adm_final")
            
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2: 
                data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1: 
                data_inicio = data_fim = periodo_sel[0]
            else: 
                data_inicio = data_fim = periodo_sel

            df_adm_total = pd.read_sql_query(text("SELECT * FROM agendamentos WHERE data BETWEEN :ini AND :fim"), engine, params={"ini": str(data_inicio), "fim": str(data_fim)})
            df_ativos = df_adm_total[df_adm_total['status'] == 'Agendado']
            df_faltas = df_adm_total[df_adm_total['status'] == 'No-Show']

            with adm_menu[0]:
                st.markdown("### 📈 Monitoramento Estratégico de Saúde do Negócio")
                
                bruto_periodo = df_ativos['valor'].sum()
                ticket_medio = df_ativos['valor'].mean() if not df_ativos.empty else 0.0
                
                slots_totais_periodo = 20 * 2 * ((data_fim - data_inicio).days + 1)
                taxa_ocupacao = min(int((len(df_ativos) / max(slots_totais_periodo, 1)) * 100), 100)
                
                total_marcacoes = len(df_adm_total) if len(df_adm_total) > 0 else 1
                taxa_noshow = int((len(df_faltas) / total_marcacoes) * 100)

                adm_col1, adm_col2, adm_col3, adm_col4 = st.columns(4)
                with adm_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Bruto</div><div class='metric-value'>R$ {bruto_periodo:.2f}</div><p style='color:#10b981; font-size:0.8rem; margin:0;'>📈 +14.2% (vs Maio)</p></div>", unsafe_allow_html=True)
                with adm_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Ticket Médio Geral</div><div class='metric-value' style='color:#3b82f6;'>R$ {ticket_medio:.2f}</div><p style='color:#94a3b8; font-size:0.8rem; margin:0;'>Meta: R$ 50,00</p></div>", unsafe_allow_html=True)
                with adm_col3:
                    cor_oc = "#10b981" if taxa_ocupacao >= 60 else "#f59e0b"
                    st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Ocupação de Cadeira</div><div class='metric-value' style='color:{cor_oc};'>{taxa_ocupacao}%</div><p style='color:#94a3b8; font-size:0.8rem; margin:0;'>Mínimo Ideal: 60%</p></div>", unsafe_allow_html=True)
                with adm_col4: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Índice de No-Show</div><div class='metric-value' style='color:#ef4444;'>{taxa_noshow}%</div><p style='color:#94a3b8; font-size:0.8rem; margin:0;'>Meta: Abaixo de 5%</p></div>", unsafe_allow_html=True)
                
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown("#### ⚡ Motor de Marketing: Campanhas Ativas de CRM Segmentado")
                col_m1, col_m2 = st.columns(2)
                with col_m1:
                    st.markdown("<div style='background:#1e2028; padding:15px; border-radius:10px; border-left:4px solid #ef4444;'>⚡ <b>Público Alvo A: Clientes Sumidos (+45 dias)</b><br>Identificamos 14 clientes inativos. Disparar cupom promocional 'Sumido15' de reativação via WhatsApp da recepção?</div>", unsafe_allow_html=True)
                    if st.button("📢 ENVIAR CAMPANHA WHATSAPP NAS COCHIAS", use_container_width=True):
                        st.toast("Disparos agendados no servidor de marketing CRM!", icon="🔥")
                with col_m2:
                    st.markdown("<div style='background:#1e2028; padding:15px; border-radius:10px; border-left:4px solid #f59e0b;'>🎂 <b>Público Alvo B: Aniversariantes do Mês</b><br>Gere engajamento oferecendo uma Budweiser de cortesia para agendamentos feitos de terça a quinta.</div>", unsafe_allow_html=True)
                    if st.button("🍺 ENVIAR REGALOS PARA ANIVERSARIANTES", use_container_width=True):
                        st.success("Notificações em massa enviadas!")

            with adm_menu[1]:
                st.markdown("### 💸 Divisão de Caixa e Split Automatizado de Contas")
                repasse_equipe = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_ativos.iterrows() if r['servico'] in SERVICOS])
                lucro_liquido_casa = bruto_periodo - repasse_equipe
                
                f_col1, f_col2, f_col3 = st.columns(3)
                with f_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Caixa Bruto Geral</div><div class='metric-value'>R$ {bruto_periodo:.2f}</div></div>", unsafe_allow_html=True)
                with f_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Split Automático: Repasse Equipe</div><div class='metric-value' style='color:#ef4444;'>R$ {repasse_equipe:.2f}</div></div>", unsafe_allow_html=True)
                with f_col3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Caixa Líquido da Casa</div><div class='metric-value' style='color:#10b981;'>R$ {lucro_liquido_casa:.2f}</div></div>", unsafe_allow_html=True)
                
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown("#### 📑 Fluxo de Lançamento de Custos Fixos e Variáveis da Empresa")
                with st.expander("➕ Inserir Custo Fixo"):
                    st.text_input("Descrição do Gasto:")
                    st.number_input("Valor da Fatura (R$):", min_value=0.0)
                    if st.button("Lançar no Fluxo de Caixa"): st.toast("Custo fixo provisionado!")

            with adm_menu[2]:
                st.markdown("### 🏆 Ranking de Performance Operacional da Equipe")
                if not df_ativos.empty:
                    df_performance = df_ativos.groupby('barbeiro_nome').agg(Cortes_Feitos=('id', 'count'), Faturamento_Total=('valor', 'sum')).reset_index().sort_values(by='Faturamento_Total', ascending=False)
                    st.dataframe(df_performance, use_container_width=True)
                else: st.caption("Sem dados de produção.")

            with adm_menu[3]:
                st.markdown("### 📦 Backoffice de Almoxarifado Inteligente")
                df_estoque = pd.read_sql_query("SELECT * FROM estoque_produtos", engine)
                for _, r in df_estoque.iterrows():
                    if r['quantidade'] <= r['limite_minimo']:
                        st.error(f"🚨 **ALERTA DE ESTOQUE CRÍTICO:** O produto {r['nome_produto']} possui apenas `{r['quantidade']}` unidades.")
                st.dataframe(df_estoque, use_container_width=True)

            with adm_menu[4]:
                st.markdown("### ➕ Painel de Recepção Kanban e Encaixes Walk-in")
                col_w1, col_w2, col_w3 = st.columns(3)
                with col_w1: w_nome = st.text_input("Nome do Cliente de Balcão:")
                with col_w2: w_barb = st.selectbox("Designar Barbeiro Disponível:", ["Gabriel", "Lucas"], key="m_brb_adm")
                with col_w3: w_serv = st.selectbox("Serviço:", list(SERVICOS.keys()), key="m_sv_adm")
                
                if st.button("🚀 Confirmar Encaixe de Balcão Imediato", use_container_width=True):
                    if w_nome:
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor) VALUES (:u, :b, :d, :h, :s, :v)"), {"u": f"walkin_{w_nome.lower()}", "b": w_barb, "d": str(date.today()), "h": (datetime.utcnow()-timedelta(hours=3)).strftime("%H:%M"), "s": w_serv, "v": SERVICOS[w_serv]['preco']})
                        st.success(f"Encaixe de {w_nome} gravado com sucesso!")
                        st.rerun()
                
                st.markdown("---")
                st.markdown("#### ⏳ Clientes na Fila Física da Sala de Espera Hoje")
                df_espera_sala = pd.read_sql_query("SELECT id, cliente_login, horario_checkin, status_presenca FROM sala_espera", engine)
                if df_espera_sala.empty: st.caption("Nenhum cliente aguardando na recepção.")
                else: st.dataframe(df_espera_sala, use_container_width=True)
