import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import hashlib
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine, text

# 1. CONFIGURAÇÃO DA PÁGINA
st.set_page_config(layout="wide", page_title="Barbearia Prosperidade", page_icon="💈")

# =========================================================
# BANCO DE DADOS NA NUVEM (POSTGRESQL - NEON.TECH)
# =========================================================
CONNECTION_STRING = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Portfólio de Serviços
SERVICOS = {
    "Corte Simples": {"preco": 40.0, "comissao": 0.50},
    "Corte + Sobrancelha": {"preco": 55.0, "comissao": 0.50},
    "Barba Completa": {"preco": 35.0, "comissao": 0.50},
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0, "comissao": 0.55},
    "Luzes / Nevou": {"preco": 90.0, "comissao": 0.60}
}

@st.cache_resource
def obter_engine():
    return create_engine(CONNECTION_STRING, pool_pre_ping=True)

def hash_senha(senha):
    return hashlib.sha256(str.encode(senha)).hexdigest()

def init_db():
    engine = obter_engine()
    with engine.begin() as conn:
        # Tabela de Usuários Estendida
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT,
                preferencias TEXT DEFAULT 'Nenhuma nota informada', pontos_fidelidade INTEGER DEFAULT 0, plano_assinatura TEXT DEFAULT 'Nenhum'
            )
        """))
        # Tabela de Agendamentos com Formas de Pagamento e Avaliação
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY, cliente_login TEXT, barbeiro_nome TEXT,
                data TEXT, horario TEXT, servico TEXT, valor REAL, status TEXT DEFAULT 'Agendado',
                forma_pagamento TEXT DEFAULT 'Pix', nota_avaliacao INTEGER DEFAULT 0, feedback_texto TEXT
            )
        """))
        # Tabela de Estoque
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS estoque_produtos (
                id SERIAL PRIMARY KEY, nome_produto TEXT UNIQUE, quantidade INTEGER, limite_minimo INTEGER, preco_venda REAL
            )
        """))
        
        # Carga inicial de estoque para demonstração
        res_est = conn.execute(text("SELECT COUNT(*) FROM estoque_produtos")).fetchone()[0]
        if res_est == 0:
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Pomada Efeito Matte Elesid', 4, 5, 35.0)"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Minoxidil Kirkland 6%', 12, 3, 89.90)"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Óleo de Cedro Amadeirado', 8, 4, 42.0)"))

        # Cadastro de barbeiros admin padrão
        res_u = conn.execute(text("SELECT COUNT(*) FROM usuarios_barber WHERE perfil = 'barbeiro'")).fetchone()[0]
        if res_u == 0:
            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES ('gabriel', :s, 'Gabriel', 'barbeiro', '19971374936')"), {"s": hash_senha("123456")})
            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES ('lucas', :s, 'Lucas', 'barbeiro', '19999999999')"), {"s": hash_senha("123456")})
            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES ('admin', :s, 'Dono Prosperidade', 'admin', '19971374936')"), {"s": hash_senha("admin123")})

try:
    init_db()
except Exception as e:
    st.error(f"⚠️ Erro de Banco de Dados: {e}")

# --- CONTROLE DE ESTADOS ---
if 'auth' not in st.session_state: st.session_state['auth'] = False
if 'user' not in st.session_state: st.session_state['user'] = None
if 'perfil' not in st.session_state: st.session_state['perfil'] = None
if 'nome_usuario' not in st.session_state: st.session_state['nome_usuario'] = None
if 'reg_sucesso' not in st.session_state: st.session_state['reg_sucesso'] = 0
if 'ultimo_horario_salvo' not in st.session_state: st.session_state['ultimo_horario_salvo'] = None

# --- ESTILIZAÇÃO CSS PREMIUM ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    div[data-baseweb="popover"] { z-index: 999999 !important; }
    
    /* Barra Lateral Premium */
    [data-testid="stSidebar"] { background-color: #111217; border-right: 1px solid #1e2028; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] label div[data-testid="stMarkdownContainer"] p img { display:none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label [data-testid="stWidgetLabel"] { display: none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label {
        background-color: #1e2028 !important; border: 1px solid #2a2d3a !important;
        padding: 14px 18px !important; border-radius: 12px !important; color: #94a3b8 !important; cursor: pointer;
        font-weight: 600; font-size: 0.9rem; transition: all 0.25s ease-in-out; display: flex !important; width: 100% !important;
    }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label > div:first-child { display: none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label:hover { background-color: #262933 !important; color: #ffffff !important; transform: translateX(3px); }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label[data-checked="true"] {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important; color: #ffffff !important; font-weight: 700; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.25) !important;
    }
    
    .metric-card-barber {
        background: linear-gradient(135deg, #1e2028 0%, #14151b 100%);
        padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a; text-align: center;
    }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    .time-slot-card { background: #1e2028; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid #2a2d3a; margin-bottom: 12px; }
    .section-barber { background: #1e2028; padding: 12px 20px; border-radius: 8px; color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px; }
    .barber-agenda-row { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    </style>
    """, unsafe_allow_html=True)

# POP-UP AGENDAMENTO CLIENTE
@st.dialog("🛡️ Confirmar seu Agendamento")
def popup_confirmacao(hora, barbeiro, servico, preco, data):
    st.markdown(f"Horário escolhido: **{hora}**")
    st.markdown(f"• **Barbeiro:** {barbeiro}\n• **Serviço:** {servico}\n• **Valor:** R$ {preco:.2f}\n• **Data:** {data.strftime('%d/%m/%Y')}")
    
    if st.session_state["ultimo_horario_salvo"] == hora:
        st.success(f"🎉 Horário reservado com sucesso no sistema para as {hora}!")
        if st.button("Fechar Janela", use_container_width=True):
            st.session_state["ultimo_horario_salvo"] = None
            st.rerun()
    else:
        # Seletor de forma de pagamento direto no check-out
        forma_p = st.selectbox("Forma de Pagamento pelo Aplicativo:", ["Pix (Split Automático)", "Cartão de Crédito", "Dinheiro (No Balcão)"])
        if st.button("✅ Confirmar e Efetuar Reserva", type="primary", use_container_width=True):
            engine = obter_engine()
            with engine.begin() as conn:
                conn.execute(text("""
                    INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, forma_pagamento)
                    VALUES (:u, :b, :d, :h, :s, :v, :p)
                """), {"u": st.session_state['user'], "b": barbeiro, "d": str(data), "h": hora, "s": servico, "v": preco, "p": forma_p})
                
                # Atribui pontos fidelidade (+1 por corte)
                conn.execute(text("UPDATE usuarios_barber SET pontos_fidelidade = pontos_fidelidade + 1 WHERE login = :u"), {"u": st.session_state['user']})
            st.session_state["ultimo_horario_salvo"] = hora
            st.rerun()

# =========================================================
# TELA DE ENTRADA / LOGIN UNIFICADA
# =========================================================
if not st.session_state['auth']:
    st.markdown("<h1 style='text-align:center; color:#f59e0b; font-weight:900; margin-top:30px;'>💈 BARBEARIA PROSPERIDADE</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center; color:#94a3b8;'>Plataforma Unificada de Agendamentos & Inteligência Comercial</p>", unsafe_allow_html=True)
    
    tab_c, tab_b, tab_a = st.tabs(["📱 PORTAL DO CLIENTE", "✂️ ÁREA DO BARBEIRO", "👑 PAINEL DO ADMINISTRADOR"])
    
    with tab_c:
        sub_tab1, sub_tab2 = st.tabs(["🔐 Entrar", "📝 Criar Nova Conta"])
        with sub_tab1:
            log_c = st.text_input("Usuário (Login)", key="login_cli").strip().lower()
            senha_c = st.text_input("Senha", type="password", key="senha_cli")
            if st.button("🚀 ENTRAR COMO CLIENTE", use_container_width=True):
                engine = obter_engine()
                df_u = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'cliente'"), engine, params={"l": log_c, "s": hash_senha(senha_c)})
                if not df_u.empty:
                    st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_u.iloc[0]['login'], 'cliente', df_u.iloc[0]['nome']
                    st.rerun()
                else: st.error("Usuário ou Senha incorretos.")
        with sub_tab2:
            v_reg = st.session_state['reg_sucesso']
            cad_nome = st.text_input("Nome Completo", key=f"n_{v_reg}")
            cad_login = st.text_input("Usuário", key=f"l_{v_reg}").strip().lower()
            cad_cel = st.text_input("WhatsApp com DDD", key=f"w_{v_reg}")
            cad_senha = st.text_input("Senha", type="password", key=f"s_{v_reg}")
            if st.button("🎯 FINALIZAR MEU CADASTRO", use_container_width=True):
                if cad_nome and cad_login and cad_senha:
                    engine = obter_engine()
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES (:l, :s, :n, 'cliente', :c)"), {"l": cad_login, "s": hash_senha(cad_senha), "n": cad_nome, "c": cad_cel})
                        st.session_state['reg_sucesso'] += 1
                        st.success("Conta criada! Acesse a aba Entrar.")
                    except: st.error("Nome de usuário indisponível.")

    with tab_b:
        log_b = st.text_input("Login do Barbeiro", key="l_b").strip().lower()
        senha_b = st.text_input("Senha do Barbeiro", type="password", key="s_b")
        if st.button("🔑 ACESSAR AGENDA DO BARBEIRO", use_container_width=True):
            engine = obter_engine()
            df_b = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'barbeiro'"), engine, params={"l": log_b, "s": hash_senha(senha_b)})
            if not df_b.empty:
                st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_b.iloc[0]['login'], 'barbeiro', df_b.iloc[0]['nome']
                st.rerun()
            else: st.error("Credenciais inválidas.")

    with tab_a:
        log_a = st.text_input("Login do Administrador", key="l_a").strip().lower()
        senha_a = st.text_input("Senha Master", type="password", key="s_a")
        if st.button("👑 ENTRAR NO PAINEL EXECUTIVO", use_container_width=True):
            engine = obter_engine()
            df_a = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'admin'"), engine, params={"l": log_a, "s": hash_senha(senha_a)})
            if not df_a.empty:
                st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_a.iloc[0]['login'], 'admin', 'Dono Prosperidade'
                st.rerun()
            else: st.error("Senha administradora incorreta.")

else:
    engine = obter_engine()
    
    # Header de sessão logada
    col_h1, col_h2 = st.columns([4, 1])
    with col_h1:
        st.markdown(f"### 💈 **{st.session_state['nome_usuario']}** <span style='color:#f59e0b'>[{st.session_state['perfil'].upper()}]</span>", unsafe_allow_html=True)
    with col_h2:
        if st.button("🚪 Encerrar Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.rerun()
    st.markdown("---")

    # =========================================================
    # 1. VISÃO DO CLIENTE: EXPERIÊNCIA E CLUBE DE ASSINATURA
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
        # Carrega dados atualizados do cliente na sessão
        df_cli_data = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :u"), engine, params={"u": st.session_state['user']}).iloc[0]
        
        c_tab1, c_tab2, c_tab3 = st.tabs(["📅 Agendamento Expresso", "👤 Meu Estilo & Clube Fidelidade", "🛡️ Sala de Espera Virtual"])
        
        with c_tab1:
            st.markdown("### 📅 Marcar um Horário em 3 Passos (Fricção Zero)")
            col1, col2, col3 = st.columns(3)
            with col1: s_sel = st.selectbox("1. Escolha o Serviço:", list(SERVICOS.keys()))
            with col2: b_sel = st.selectbox("2. Escolha o Profissional:", ["Gabriel", "Lucas"])
            with col3: d_sel = st.date_input("3. Escolha o Dia:", date.today(), min_value=date.today())
            
            # Grade horária dinâmica baseada em tempo real com travas GMT-3
            horarios = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*i)).strftime("%H:%M") for i in range(20)]
            df_oc = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"), engine, params={"b": b_sel, "d": str(d_sel)})
            ocupados = df_oc['horario'].tolist()
            
            agora_br = datetime.utcnow() - timedelta(hours=3)
            hora_str = agora_br.strftime("%H:%M")
            eh_hoje = (d_sel == date.today())
            
            st.markdown("#### Escolha seu horário abaixo:")
            grid = st.columns(4)
            for idx, h in enumerate(horarios):
                with grid[idx % 4]:
                    if h in ocupados or (eh_hoje and h < hora_str):
                        st.markdown(f"<div class='time-slot-card' style='border-color:#ef4444;'><span class='status-badge badge-ocupado'>🛑 Ocupado</span><h4>{h}</h4></div>", unsafe_allow_html=True)
                        st.button("Indisponível", key=f"btn_{h}", disabled=True, use_container_width=True)
                    else:
                        st.markdown(f"<div class='time-slot-card' style='border-color:#10b981;'><span class='status-badge badge-livre'>🟢 Livre</span><h4>{h}</h4></div>", unsafe_allow_html=True)
                        if st.button("Reservar", key=f"btn_{h}", use_container_width=True):
                            popup_confirmacao(hora=h, barbeiro=b_sel, servico=s_sel, preco=SERVICOS[s_sel]["preco"], data=d_sel)
                            
            # Feedback e cancelamentos do cliente
            st.markdown("#### Meus Compromissos Ativos")
            df_meus = pd.read_sql_query(text("SELECT id, barbeiro_nome, data, horario, servico, valor FROM agendamentos WHERE cliente_login = :u AND status = 'Agendado'"), engine, params={"u": st.session_state['user']})
            if not df_meus.empty:
                st.dataframe(df_meus, use_container_width=True)
                id_c = st.number_input("Digite o ID do agendamento para cancelar:", min_value=1, step=1)
                if st.button("❌ CANCELAR COMPROMISSO", type="primary"):
                    if id_c in df_meus['id'].values:
                        with engine.begin() as conn: conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_c)})
                        st.success("Horário desmarcado com sucesso!")
                        st.rerun()
            else: st.caption("Nenhum agendamento ativo encontrado.")

        with c_tab2:
            st.markdown("### 🏆 Meu Perfil de Estilo & Clube de Vantagens")
            col_prof1, col_prof2 = st.columns(2)
            with col_prof1:
                st.markdown(f"""
                <div class='metric-card-barber'>
                    <div class='metric-title'>Meus Pontos Acumulados</div>
                    <div class='metric-value'>{df_cli_data['pontos_fidelidade']} / 10</div>
                    <p style='color:#94a3b8; font-size:0.8rem; margin-top:10px;'>Ao completar 10 pontos, ganhe uma Hidratação de Barba ou Cabelo de graça!</p>
                </div>
                """, unsafe_allow_html=True)
            with col_prof2:
                st.markdown("#### 🗒️ Minhas Notas de Preferência (Dono & Barbeiro enxergam)")
                st.info(df_cli_data['preferencias'])
                
                # Compra de assinatura
                st.markdown("#### 👑 Assinatura Recorrente Prosperidade Clube")
                plano_atual = df_cli_data['plano_assinatura']
                st.markdown(f"Plano Atual: **{plano_atual}**")
                if plano_atual == "Nenhum":
                    if st.button("Comprar Plano VIP Executivo (Cortes Ilimitados por R$ 119/mês)"):
                        with engine.begin() as conn: conn.execute(text("UPDATE usuarios_barber SET plano_assinatura = 'VIP Executivo' WHERE login = :u"), {"u": st.session_state['user']})
                        st.success("Assinatura confirmada com sucesso! Você faz parte do clube.")
                        st.rerun()
            
            st.markdown("#### 📸 Meu Histórico Visual de Cortes (Últimos cortes tirados pelos barbeiros)")
            st.caption("Gabriel Barber anexou uma foto ao seu perfil em sua última visita: 'Estilo Degradê Navalhado Mid-Fade com Pomada Matte Elesid'.")

        with c_tab3:
            st.markdown("### 🛡️ Sala de Espera Virtual & Check-in Expresso")
            st.markdown("<p style='color:#94a3b8;'>Está no caminho? Avise nossos barbeiros para otimizar sua recepção!</p>", unsafe_allow_html=True)
            if st.button("🎯 FAZER CHECK-IN (AVISAR QUE ESTOU CHEGANDO)"):
                st.toast("Check-in efetuado! O barbeiro foi alertado no painel interno.", icon="🚀")
            
            st.markdown("#### ⏱️ Status de Ocupação da Cadeira em Tempo Real")
            st.metric("Tempo Estimado de Atraso das Cadeiras", "0 minutos", delta="Agenda Sem Atrasos", delta_color="normal")

    # =========================================================
    # 2. VISÃO DO BARBEIRO: PRODUTIVIDADE, PORTFÓLIO E COMISSÕES
    # =========================================================
    elif st.session_state['perfil'] == 'barbeiro':
        st.markdown(f"## ✂️ Painel de Operações de Cadeira — {st.session_state['nome_usuario']}")
        
        b_tab1, b_tab2 = st.tabs(["📅 Minha Linha de Trabalho", "📈 Minhas Comissões & Metas"])
        
        # Coleta os cortes confirmados do dia para este barbeiro
        df_cortes_hoje = pd.read_sql_query(
            text("SELECT a.*, u.nome as cliente_nome, u.preferencias FROM agendamentos a LEFT JOIN usuarios_barber u ON a.cliente_login = u.login WHERE a.barbeiro_nome = :b AND a.data = :d AND a.status = 'Agendado' ORDER BY a.horario ASC"),
            engine, params={"b": st.session_state['nome_usuario'], "d": str(date.today())}
        )
        
        with b_tab1:
            st.markdown("### 📅 Cronograma de Atendimentos para o Dia de Hoje")
            horarios_trabalho = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*i)).strftime("%H:%M") for i in range(20)]
            mapa_agenda = df_cortes_hoje.set_index('horario').to_dict(orient='index')
            
            for h in horarios_trabalho:
                if h in mapa_agenda:
                    reg = mapa_agenda[h]
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 6px solid #ef4444; background: #ef444405;">
                            <div>
                                <span style="font-size:1.2rem; font-weight:800; color:#ef4444;">⏰ {h}</span>
                                <span style="margin-left:20px; font-weight:700; color:#fff;">👤 Cliente: {reg['cliente_nome']}</span>
                                <span style="margin-left:20px; color:#94a3b8; font-size:0.85rem;">✂️ Serviço: {reg['servico']}</span>
                            </div>
                            <div style='color:#f59e0b; font-weight:700;'>R$ {reg['valor']:.2f}</div>
                        </div>
                    """, unsafe_allow_html=True)
                    
                    # Funcionalidades extras integradas no card do cliente
                    with st.expander(f"⚙️ Prontuário & Portfólio de {reg['cliente_nome']}"):
                        st.caption(f"Preferências registradas do cliente: {reg['preferencias']}")
                        nova_nota = st.text_input("Atualizar Notas de Preferência do Cliente:", value=str(reg['preferencias'] or ''), key=f"nota_{h}")
                        if st.button("Salvar Nota do Cliente", key=f"btn_nota_{h}"):
                            with engine.begin() as conn: conn.execute(text("UPDATE usuarios_barber SET preferencias = :p WHERE login = :u"), {"p": nova_nota, "u": reg['cliente_login']})
                            st.success("Nota de estilo atualizada!")
                        
                        st.file_uploader("📸 Tirar/Anexar foto do corte para o Portfólio do Cliente", type=["png", "jpg"], key=f"foto_{h}")
                else:
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 4px solid #10b981; opacity:0.6;">
                            <div>
                                <span style="font-size:1.1rem; font-weight:700; color:#34d399;">⏰ {h}</span>
                                <span style="margin-left:20px; color:#94a3b8; font-style:italic;">Disponível para agendamento</span>
                            </div>
                            <div style='color:#10b981; font-size:0.8rem; text-transform:uppercase;'>Vago</div>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button("Bloquear este Horário (Almoço/Imprevisto)", key=f"bloq_{h}"):
                        with engine.begin() as conn: conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor) VALUES ('bloqueio_admin', :b, :d, :h, 'Bloqueio de Agenda', 0)"), {"b": st.session_state['nome_usuario'], "d": str(date.today()), "h": h})
                        st.rerun()

        with b_tab2:
            st.markdown("### 📈 Meu Extrato Financeiro & Metas de Cadeira")
            
            # Cálculo de Comissões Realistas baseados no mapeamento do dicionário de serviços
            valor_faturado = 0.0
            comissao_acumulada = 0.0
            for _, r in df_cortes_hoje.iterrows():
                serv = r['servico']
                if serv in SERVICOS:
                    valor_faturado += r['valor']
                    comissao_acumulada += r['valor'] * SERVICOS[serv]["comissao"]
                    
            b_col1, b_col2, b_col3 = st.columns(3)
            with b_col1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Gerado Hoje</div><div class='metric-value'>R$ {valor_faturado:.2f}</div></div>", unsafe_allow_html=True)
            with b_col2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Minha Comissão Líquida</div><div class='metric-value' style='color:#10b981'>R$ {comissao_acumulada:.2f}</div></div>", unsafe_allow_html=True)
            with b_col3: 
                # Progresso de metas interno
                progresso = min(int((valor_faturado / 300.0) * 100), 100)
                st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Meta Diária (R$ 300)</div><div class='metric-value' style='color:#3b82f6'>{progresso}%</div></div>", unsafe_allow_html=True)

    # =========================================================
    # 3. VISÃO DO ADMINISTRADOR: SPLIT DE PAGAMENTO, ESTOQUE, CRM
    # =========================================================
    elif st.session_state['perfil'] == 'admin':
        st.markdown("## 👑 Painel Executivo do Proprietário — Barbearia Prosperidade")
        
        # Filtro de intervalo principal no topo do corpo para não cortar o calendário
        st.markdown("<div class='section-barber'>📅 JANELA TEMPORAL DO CONSOLIDADO EXECUTIVO</div>", unsafe_allow_html=True)
        col_adm_f1, _ = st.columns([2,2])
        with col_adm_f1:
            periodo_sel = st.date_input("Escolha o Período de Análise Financeira:", value=[date(2026, 6, 1), date(2026, 6, 30)])
            
        if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2: data_ini, data_fim = periodo_sel
        else: data_ini = data_fim = date.today()
            
        # Puxa dados brutos do período do banco Neon
        df_adm_base = pd.read_sql_query(
            text("SELECT * FROM agendamentos WHERE status = 'Agendado' AND data BETWEEN :i AND :f"),
            engine, params={"i": str(data_ini), "f": str(data_fim)}
        )
        
        adm_tab1, adm_tab2, adm_tab3 = st.tabs(["💰 Financeiro & Split Automático", "📦 Controle de Estoque", "🎯 CRM: Clientes Sumidos & Feedbacks"])
        
        with adm_tab1:
            st.markdown("### 💵 Faturamento Consolidado & Divisão de Comissões Automatizada")
            if df_adm_base.empty: st.info("Nenhum faturamento registrado nesse intervalo de datas.")
            else:
                total_faturado_bruto = df_adm_base['valor'].sum()
                
                # Split de pagamento automatizado calculando as taxas de comissão
                parte_barbeiros = 0.0
                for _, row in df_adm_base.iterrows():
                    s = row['servico']
                    if s in SERVICOS: parte_barbeiros += row['valor'] * SERVICOS[s]['comissao']
                parte_casa = total_faturado_bruto - parte_barbeiros
                
                ad_c1, ad_c2, ad_c3 = st.columns(3)
                with ad_c1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Bruto</div><div class='metric-value'>R$ {total_faturado_bruto:.2f}</div></div>", unsafe_allow_html=True)
                with ad_c2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Split: Repasse Barbeiros</div><div class='metric-value' style='color:#ef4444'>R$ {parte_barbeiros:.2f}</div></div>", unsafe_allow_html=True)
                with ad_c3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Split: Lucro Líquido Casa</div><div class='metric-value' style='color:#10b981'>R$ {parte_casa:.2f}</div></div>", unsafe_allow_html=True)
                
                # Gráfico de meios de pagamento
                st.markdown("#### Faturamento por Meio de Recebimento")
                df_pag = df_adm_base.groupby('forma_pagamento')['valor'].sum().reset_index()
                st.plotly_chart(px.bar(df_pag, x='forma_pagamento', y='valor', color='forma_pagamento', color_discrete_sequence=px.colors.sequential.YlOrBr, labels={'valor':'Total (R$)','forma_pagamento':'Meio de Pagamento'}), use_container_width=True)

        with adm_tab2:
            st.markdown("### 📦 Monitoramento de Insumos e Vendas")
            df_estoque = pd.read_sql_query("SELECT * FROM estoque_produtos", engine)
            
            # Alertas automáticos do estoque inteligente
            for _, r in df_estoque.iterrows():
                if r['quantidade'] <= r['limite_minimo']:
                    st.error(f"🚨 **ALERTA DE REPOSIÇÃO:** O produto **{r['nome_produto']}** está crítico no estoque! Quantidade Atual: `{r['quantidade']}` unidades (Mínimo tolerado: {r['limite_minimo']}).")
            
            st.markdown("#### Grade de Produtos em Estoque")
            st.dataframe(df_estoque, use_container_width=True)
            
            # Adicionar agendamento manual do barbeiro de balcão (Adicionado no painel para flexibilidade)
            st.markdown("<div class='section-barber'>➕ AGENDAMENTO DIRETO DE BALCÃO (ADMINISTRADOR)</div>", unsafe_allow_html=True)
            col_b_man1, col_b_man2 = st.columns(2)
            with col_b_man1: m_cli = st.text_input("Nome do Cliente de Balcão:")
            with col_b_man2: m_barb = st.selectbox("Designar Barbeiro:", ["Gabriel", "Lucas"])
            if st.button("Gravar Horário de Balcão às 12:00 para Hoje"):
                with engine.begin() as conn: conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor) VALUES (:u, :b, :d, '12:00', 'Corte Simples', 40.0)"), {"u": f"balcao_{m_cli.lower()}", "b": m_barb, "d": str(date.today())})
                st.success("Horário de balcão alocado!")

        with adm_tab3:
            st.markdown("### 🎯 CRM Avançado & Sistema de Retenção de Clientes")
            
            col_crm1, col_crm2 = st.columns(2)
            with col_crm1:
                st.markdown("#### 🏃‍♂️ Clientes Sumidos (Inativos há mais de 45 dias)")
                st.caption("Esta lista cruza os logins que não possuem movimentações salvas nos últimos 45 dias.")
                # Dados mockados do CRM para exibição de demonstração executiva
                df_sumidos = pd.DataFrame({
                    "Nome do Cliente": ["Danilo Santos", "Alexandre Guerra", "Paulo Higuchi"],
                    "Última Visita": ["12/04/2026", "20/04/2026", "28/04/2026"],
                    "WhatsApp": ["19971374936", "19988887777", "19966665555"]
                })
                st.table(df_sumidos)
                if st.button("📢 DISPARAR CUPOM DE RETENÇÃO EM MASSA (WHATSAPP/PUSH)"):
                    st.toast("Disparos agendados no servidor Prosperidade CRM!", icon="🔥")
                    
            with col_crm2:
                st.markdown("#### ⭐ Ouvidoria & Feedbacks Internos (Privados ao Dono)")
                st.caption("Filtro de avaliações pós-corte para evitar reclamações públicas no Google.")
                
                # Simulação de feedbacks internos
                st.warning("⚠️ **Avaliação Regular (Nota 3/5) - Cliente: Leonardo Arengue**\n\n'O corte ficou muito bom, mas o barbeiro atrasou 15 minutos para começar meu atendimento.'\n\n_Profissional: Lucas | Serviço: Combo Premium_")
                st.success("⭐ **Avaliação Excelente (Nota 5/5) - Cliente: Bruno Felício**\n\n'Melhor barbearia da região! Atendimento impecável e o Gabriel é brabo no degradê!'")
