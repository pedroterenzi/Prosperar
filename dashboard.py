import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import hashlib
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine, text
import urllib.parse

# 1. CONFIGURAÇÃO DA PÁGINA
st.set_page_config(layout="wide", page_title="BarberFlow OS", page_icon="💈")

# =========================================================
# BANCO DE DADOS NA NUVEM (POSTGRESQL - NEON.TECH)
# =========================================================
CONNECTION_STRING = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
WHATSAPP_NOTIFICA = "5519971374936" 

# =========================================================
# DICIONÁRIOS E PORTFÓLIO DE SERVIÇOS
# =========================================================
SERVICOS = {
    "Corte Simples": {"preco": 40.0, "tempo": 30},
    "Corte + Sobrancelha": {"preco": 55.0, "tempo": 30},
    "Barba Completa": {"preco": 35.0, "tempo": 30},
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0, "tempo": 30},
    "Luzes / Nevou": {"preco": 90.0, "tempo": 30}
}

@st.cache_resource
def obter_engine():
    return create_engine(CONNECTION_STRING, pool_pre_ping=True)

def hash_senha(senha):
    return hashlib.sha256(str.encode(senha)).hexdigest()

def init_db():
    engine = obter_engine()
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS barbeiros (
                id SERIAL PRIMARY KEY, nome TEXT UNIQUE, especialidade TEXT
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY, cliente_login TEXT, barbeiro_nome TEXT,
                data TEXT, horario TEXT, servico TEXT, valor REAL, status TEXT DEFAULT 'Agendado'
            )
        """))
        
        res = conn.execute(text("SELECT COUNT(*) FROM barbeiros")).fetchone()[0]
        if res == 0:
            conn.execute(text("INSERT INTO barbeiros (nome, especialidade) VALUES ('Gabriel', 'Especialista em Degradê & Visagismo')"))
            conn.execute(text("INSERT INTO barbeiros (nome, especialidade) VALUES ('Lucas', 'Mestre das Barbas & Toalha Quente')"))
            conn.execute(text("""
                INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) 
                VALUES ('gabriel', :senha, 'Gabriel Barber', 'barbeiro', '19971374936')
            """), {"senha": hash_senha("123456")})

try:
    init_db()
except Exception as e:
    st.error(f"⚠️ Erro de Banco de Dados: {e}")

# =========================================================
# 🧪 FUNÇÃO INJETORA PARA DEMONSTRAÇÃO
# =========================================================
def injetar_dados_demonstracao():
    engine = obter_engine()
    clientes_fake = ['alexandre_guerra', 'leonardo_arengue', 'bruno_felicio', 'danilo_santos', 'luciano_souza', 'paulo_higuchi']
    barbeiros_fake = ['Gabriel', 'Lucas']
    servicos_fake = list(SERVICOS.keys())
    
    hoje = date.today()
    
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM agendamentos;"))
        
        for cli in clientes_fake:
            nome_formatado = cli.replace('_', ' ').title()
            conn.execute(text("""
                INSERT INTO usuarios_barber (login, senha, nome, perfil, celular)
                VALUES (:l, 'sistema', :n, 'cliente', '19999999999')
                ON CONFLICT (login) DO NOTHING
            """), {"l": cli, "n": nome_formatado})
        
        contador = 0
        for i in range(-7, 15):  
            data_alvo = hoje + timedelta(days=i)
            for j, hora in enumerate(["09:30", "11:00", "14:30", "16:00", "17:30"]):
                if (i + j) % 2 == 0 or i == 0: 
                    cliente = clientes_fake[(i + j) % len(clientes_fake)]
                    barbeiro = barbeiros_fake[(i * j) % len(barbeiros_fake)]
                    servico = servicos_fake[(j) % len(servicos_fake)]
                    valor = SERVICOS[servico]["preco"]
                    
                    conn.execute(text("""
                        INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, status)
                        VALUES (:u, :b, :d, :h, :s, :v, 'Agendado')
                    """), {"u": cliente, "b": barbeiro, "d": str(data_alvo), "h": hora, "s": servico, "v": valor})
                    contador += 1
    return contador

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
    
    /* --- CUSTOMIZAÇÃO PREMIUM DA BARRA LATERAL --- */
    [data-testid="stSidebar"] { background-color: #111217; border-right: 1px solid #1e2028; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] label div[data-testid="stMarkdownContainer"] p img { display:none !important; }
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label [data-testid="stWidgetLabel"] { display: none !important; }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label {
        background-color: #1e2028 !important; border: 1px solid #2a2d3a !important;
        padding: 14px 18px !important; border-radius: 12px !important; margin-bottom: 2px !important; 
        color: #94a3b8 !important; cursor: pointer; font-weight: 600; font-size: 0.9rem;
        transition: all 0.25s ease-in-out; display: flex !important; align-items: center; 
        justify-content: flex-start; width: 100% !important; box-sizing: border-box !important;
    }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label > div:first-child { display: none !important; }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label:hover { 
        background-color: #262933 !important; border-color: #404557 !important; 
        color: #ffffff !important; transform: translateX(3px); 
    }
    
    [data-testid="stSidebar"] .stRadio div[role="radiogroup"] > label[data-checked="true"] {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important; 
        color: #ffffff !important; border: 1px solid #b45309 !important; font-weight: 700; 
        box-shadow: 0 4px 15px rgba(245, 158, 11, 0.25) !important;
    }
    
    /* --- COMPONENTES DO DASHBOARD --- */
    .metric-card-barber {
        background: linear-gradient(135deg, #1e2028 0%, #14151b 100%);
        padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a;
        text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    
    .time-slot-card {
        background: #1e2028; padding: 15px; border-radius: 12px;
        text-align: center; border: 1px solid #2a2d3a; margin-bottom: 12px;
    }
    .status-badge {
        display: inline-block; padding: 4px 10px; border-radius: 20px;
        font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;
    }
    .badge-livre { background: #10b98120; color: #34d399; border: 1px solid #10b981; }
    .badge-ocupado { background: #ef444420; color: #f87171; border: 1px solid #ef4444; }
    
    .section-barber {
        background: #1e2028; padding: 12px 20px; border-radius: 8px;
        color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px;
    }
    .product-card {
        background: #14151b; border: 1px solid #2a2d3a; padding: 15px;
        border-radius: 12px; text-align: center; margin-bottom: 15px;
    }
    
    .barber-agenda-row {
        background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px;
        padding: 15px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;
    }
    </style>
    """, unsafe_allow_html=True)

# =========================================================
# 🛡️ POP-UP DIALOG SEQUENCIAL COM INTERFACE DO WHATSAPP
# =========================================================
@st.dialog("🛡️ Confirmar seu Agendamento")
def mostrar_popup_confirmacao(hora, barbeiro, servico, preco, data):
    st.markdown(f"Você escolheu o horário das **{hora}**.")
    st.markdown(f"""
    * **Profissional:** {barbeiro}
    * **Serviço:** {servico}
    * **Preço:** <span style='color:#10b981; font-weight:bold;'>R$ {preco:.2f}</span>
    * **Data:** {data.strftime('%d/%m/%Y')}
    """, unsafe_allow_html=True)
    
    # Se o horário atual condiz com o que acabamos de salvar, exibe a tela de envio do WhatsApp
    if st.session_state["ultimo_horario_salvo"] == hora:
        msg_wpp = f"💈 *NOTIFICAÇÃO DE AGENDAMENTO* 💈\n\nFala, {barbeiro}! Entrou um novo cliente na sua linha do tempo:\n\n👤 *Cliente:* {st.session_state['nome_usuario']}\n📅 *Data:* {data.strftime('%d/%m/%Y')}\n⏰ *Horário:* {hora}\n✂️ *Serviço:* {servico}\n💵 *Valor:* R$ {preco:.2f}\n\n_Enviado automaticamente via BarberFlow OS_"
        url_wpp = f"https://api.whatsapp.com/send?phone={WHATSAPP_NOTIFICA}&text={urllib.parse.quote(msg_wpp)}"
        
        st.markdown(f"""
            <div style="background-color:#10b98115; border:1px solid #10b981; color:#34d399; padding:15px; border-radius:10px; font-weight:bold; text-align:center; margin-top:15px; margin-bottom:15px;">
                🎉 Vaga bloqueada! Agora avise o barbeiro pelo WhatsApp.
            </div>
        """, unsafe_allow_html=True)
        
        # Botão exclusivo e limpo para redirecionamento sequencial
        st.markdown(f"""
            <a href="{url_wpp}" target="_blank" style="text-decoration:none;">
                <div style="background-color:#25d366; color:white; padding:16px; text-align:center; border-radius:12px; font-weight:bold; box-shadow: 0 4px 14px rgba(37,211,102,0.4); font-size:1.05rem; transition: background 0.2s;">
                    💬 ENVIAR AGENDA PARA O WHATSAPP DO BARBEIRO
                </div>
            </a>
        """, unsafe_allow_html=True)
        
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("Concluir e Voltar para os Horários", use_container_width=True):
            st.session_state["ultimo_horario_salvo"] = None  
            st.rerun()
            
    else:
        # Tela inicial do pop-up para confirmar a gravação de dados
        st.markdown("Deseja confirmar a gravação do seu compromisso?")
        col_pop1, col_pop2 = st.columns(2)
        with col_pop1:
            if st.button("✅ Confirmar Vaga", type="primary", use_container_width=True):
                engine = obter_engine()
                with engine.begin() as conn:
                    conn.execute(text("""
                        INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor)
                        VALUES (:u, :b, :d, :h, :s, :v)
                    """), {"u": st.session_state['user'], "b": barbeiro, "d": str(data), "h": hora, "s": servico, "v": preco})
                
                # Seta o estado local indicando que a vaga deste horário específico foi salva
                st.session_state["ultimo_horario_salvo"] = hora
                st.balloons()
                st.rerun()
                
        with col_pop2:
            if st.button("❌ Cancelar", use_container_width=True):
                st.session_state["ultimo_horario_salvo"] = None
                st.rerun()

# =========================================================
# FLUXO DE AUTENTICAÇÃO SEPARADO (CLIENTE VS BARBEIRO)
# =========================================================
if not st.session_state['auth']:
    st.markdown("<h1 style='text-align:center; color:#f59e0b; font-weight:900; margin-top:30px;'>💈 BARBERFLOW OS</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center; color:#94a3b8;'>Gestão Inteligente & Agendamento de Alta Performance</p>", unsafe_allow_html=True)
    
    st.sidebar.markdown("### 🧪 Central de Testes")
    if st.sidebar.button("⚡ Injetar Dados de Demonstração", use_container_width=True):
        try:
            dados_gerados = injetar_dados_demonstracao()
            st.sidebar.success(f"🔥 {dados_gerados} agendamentos gerados!")
            st.balloons()
        except Exception as error_db:
            st.sidebar.error(f"Falha na injeção: {error_db}")
            
    portal_cliente, portal_barbeiro = st.tabs(["📱 PORTAL DO CLIENTE", "💼 ÁREA DO PROFISSIONAL"])
    
    with portal_cliente:
        aba_login_c, aba_cad_c = st.tabs(["🔐 Entrar", "📝 Criar Nova Conta"])
        with aba_login_c:
            st.markdown("<div class='section-barber'>Acesse sua conta para agendar</div>", unsafe_allow_html=True)
            log_c = st.text_input("Usuário (Login)", key="log_c").strip().lower()
            senha_c = st.text_input("Senha", type="password", key="senha_c")
            if st.button("🚀 ENTRAR COMO CLIENTE", use_container_width=True):
                engine = obter_engine()
                df_u = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'cliente'"), engine, params={"l": log_c, "s": hash_senha(senha_c)})
                if not df_u.empty:
                    st.session_state['auth'] = True
                    st.session_state['user'] = df_u.iloc[0]['login']
                    st.session_state['perfil'] = 'cliente'
                    st.session_state['nome_usuario'] = df_u.iloc[0]['nome']
                    st.rerun()
                else: st.error("Usuário ou Senha incorretos.")
                
        with aba_cad_c:
            st.markdown("<div class='section-barber'>Cadastro Rápido de Novo Cliente</div>", unsafe_allow_html=True)
            v_reg = st.session_state['reg_sucesso']
            cad_nome_c = st.text_input("Nome Completo", key=f"c_nome_{v_reg}")
            cad_log_c = st.text_input("Escolha seu Nome de Usuário", key=f"c_log_{v_reg}").strip().lower()
            cad_cel_c = st.text_input("WhatsApp (Com DDD - Apenas números)", placeholder="Ex: 19971374936", key=f"c_cel_{v_reg}")
            cad_senha_c = st.text_input("Defina sua Senha", type="password", key=f"c_pass_{v_reg}")
            
            if st.button("🎯 FINALIZAR MEU CADASTRO", use_container_width=True):
                if cad_nome_c and cad_log_c and cad_senha_c:
                    engine = obter_engine()
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES (:l, :s, :n, 'cliente', :c)"),
                                         {"l": cad_log_c, "s": hash_senha(cad_senha_c), "n": cad_nome_c, "c": cad_cel_c})
                        st.session_state['reg_sucesso'] += 1
                        st.success("🎉 Conta criada com sucesso! Acesse a aba 'Entrar' para fazer o seu agendamento.")
                        st.rerun()
                    except Exception: 
                        st.error("Este nome de usuário já está sendo utilizado.")
                else: st.warning("Por favor, preencha todos os campos do formulário.")

    with portal_barbeiro:
        st.markdown("<div class='section-barber'>Painel de Autenticação do Profissional</div>", unsafe_allow_html=True)
        log_b = st.text_input("Login Administrativo", key="log_b").strip().lower()
        senha_b = st.text_input("Senha Corporativa", type="password", key="senha_b")
        if st.button("🔑 ACESSAR PAINEL GERENCIAL", use_container_width=True):
            engine = obter_engine()
            df_b = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil = 'barbeiro'"), engine, params={"l": log_b, "s": hash_senha(senha_b)})
            if not df_b.empty:
                st.session_state['auth'] = True
                st.session_state['user'] = df_b.iloc[0]['login']
                st.session_state['perfil'] = 'barbeiro'
                st.session_state['nome_usuario'] = df_b.iloc[0]['nome']
                st.rerun()
            else: st.error("Credenciais administrativas inválidas.")

# =========================================================
# ECOSSISTEMA DO USUÁRIO CONECTADO
# =========================================================
else:
    engine = obter_engine()
    
    col_h1, col_h2 = st.columns([4, 1])
    with col_h1:
        st.markdown(f"### 💈 **{st.session_state['nome_usuario']}** <span style='color:#f59e0b'>[{st.session_state['perfil'].upper()}]</span>", unsafe_allow_html=True)
    with col_h2:
        if st.button("Encerra Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.rerun()
            
    st.markdown("---")

    # =========================================================
    # AMBIENTE DO CLIENTE
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
        menu_c = st.tabs(["📅 Agendamento de Horários", "✨ Promoções & Combos", "🧴 Vitrine de Produtos"])
        
        with menu_c[0]:
            st.markdown("## 📅 Agende seu Horário na Linha do Tempo")
            
            df_barbers = pd.read_sql_query("SELECT nome FROM barbeiros", engine)
            list_barbers = df_barbers['nome'].tolist()
            
            col_c1, col_c2, col_c3 = st.columns(3)
            with col_c1:
                barbeiro_sel = st.selectbox("Escolha seu Barbeiro de Preferência:", list_barbers)
            with col_c2:
                data_sel = st.date_input("Escolha o Dia do Atendimento:", date.today(), min_value=date.today())
            with col_c3:
                servico_sel = st.selectbox("Selecione o Serviço Desejado:", list(SERVICOS.keys()))
                
            preco_servico = SERVICOS[servico_sel]["preco"]
            st.markdown(f"💵 **Investimento do Serviço:** <span style='color:#10b981; font-size:1.2rem; font-weight:800;'>R$ {preco_servico:.2f}</span>", unsafe_allow_html=True)

            horarios_janela = []
            base_time = datetime.strptime("09:00", "%H:%M")
            for i in range(20):
                slot = (base_time + timedelta(minutes=30*i)).strftime("%H:%M")
                horarios_janela.append(slot)
                
            df_ocupados = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"),
                                            engine, params={"b": barbeiro_sel, "d": str(data_sel)})
            ocupados_list = df_ocupados['horario'].tolist()
            
            st.markdown("<div class='section-barber'>Horários Disponíveis</div>", unsafe_allow_html=True)
            
            cols_grade = st.columns(4)
            for idx, hora in enumerate(horarios_janela):
                col_slot = cols_grade[idx % 4]
                with col_slot:
                    if hora in ocupados_list:
                        st.markdown(f"""
                            <div class='time-slot-card' style='border-color: #ef4444;'>
                                <span class='status-badge badge-ocupado'>🛑 Ocupado</span>
                                <h4 style='margin:5px 0; color:#94a3b8;'>{hora}</h4>
                            </div>
                        """, unsafe_allow_html=True)
                        st.button("Indisponível", key=f"ind_btn_{hora}", disabled=True, use_container_width=True)
                    else:
                        st.markdown(f"""
                            <div class='time-slot-card' style='border-color: #10b981;'>
                                <span class='status-badge badge-livre'>🟢 Disponível</span>
                                <h4 style='margin:5px 0; color:#fff;'>{hora}</h4>
                            </div>
                        """, unsafe_allow_html=True)
                        
                        if st.button("Solicitar Vaga", key=f"av_btn_{hora}", use_container_width=True, type="secondary"):
                            mostrar_popup_confirmacao(
                                hora=hora, 
                                barbeiro=barbeiro_sel, 
                                servico=servico_sel, 
                                preco=preco_servico, 
                                data=data_sel
                            )

            st.markdown("<br><br>", unsafe_allow_html=True)
            st.markdown("<div class='section-barber'>Meus Compromissos & Opção de Cancelamento</div>", unsafe_allow_html=True)
            df_meus_cards = pd.read_sql_query(text("SELECT id as \"ID\", barbeiro_nome as \"Barbeiro\", data as \"Data\", horario as \"Horário\", servico as \"Serviço\", valor as \"Preço\" FROM agendamentos WHERE cliente_login = :u AND status = 'Agendado'"), engine, params={"u": st.session_state['user']})
            
            if df_meus_cards.empty:
                st.caption("Você não possui horários marcados ativos.")
            else:
                st.dataframe(df_meus_cards, use_container_width=True)
                id_cancelar_cliente = st.number_input("Digite o ID do agendamento que deseja Desmarcar/Cancelar:", min_value=1, step=1, key="c_del_cli")
                
                if st.button("🚨 SOLICITAR CANCELAMENTO DO HORÁRIO", type="primary", use_container_width=True):
                    if id_cancelar_cliente in df_meus_cards['ID'].values:
                        linha_c = df_meus_cards[df_meus_cards['ID'] == id_cancelar_cliente].iloc[0]
                        
                        with engine.begin() as conn:
                            conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_cancelar_cliente)})
                            
                        msg_cancel_wpp = f"⚠️ *ALERTA DE CANCELAMENTO DE CLIENTE* ⚠️\n\nO cliente *{st.session_state['nome_usuario']}* cancelou um horário:\n\n📅 *Data:* {linha_c['Data']}\n⏰ *Horário:* {linha_c['Horário']}\n👤 *Barbeiro:* {linha_c['Barbeiro']}\n❌ *Serviço Removido:* {linha_c['Serviço']}"
                        url_cancel_wpp = f"https://api.whatsapp.com/send?phone={WHATSAPP_NOTIFICA}&text={urllib.parse.quote(msg_cancel_wpp)}"
                        
                        st.success("Horário cancelado no sistema!")
                        st.markdown(f'<a href="{url_cancel_wpp}" target="_blank" style="text-decoration:none;"><div style="background-color:#ef4444; color:white; padding:15px; text-align:center; border-radius:10px; font-weight:bold; margin-top:10px;">💬 NOTIFICAR CANCELAMENTO AO BARBEIRO NO WHATSAPP</div></a>', unsafe_allow_html=True)
                        st.rerun()
                    else:
                        st.error("ID informado inválido ou não pertence aos seus agendamentos.")

        with menu_c[1]:
            st.markdown("## ✨ Campanhas Especiais e Clubes de Assinatura")
            p_c1, p_c2, p_c3 = st.columns(3)
            with p_c1:
                st.markdown("<div class='product-card'><h3 style='color:#f59e0b;'>🔥 Terça Maluca</h3><p>Corte Simples com 25% de Desconto direto no balcão!</p><h2 style='color:#10b981;'>R$ 30,00</h2></div>", unsafe_allow_html=True)
            with p_c2:
                st.markdown("<div class='product-card'><h3 style='color:#f59e0b;'>👑 Plano VIP Mensal</h3><p>Cortes Ilimitados + 2 Barbas por mês com direito a Chopp livre.</p><h2 style='color:#10b981;'>R$ 149,90 / mes</h2></div>", unsafe_allow_html=True)
            with p_c3:
                st.markdown("<div class='product-card'><h3 style='color:#f59e0b;'>⚡ Combo Alinhado</h3><p>Corte + Sobrancelha + Lavagem Especial com Shampoos Premium.</p><h2 style='color:#10b981;'>R$ 60,00</h2></div>", unsafe_allow_html=True)

        with menu_c[2]:
            st.markdown("## 🧴 Vitrine de Produtos Home-Care")
            pr_c1, pr_c2, pr_c3, pr_c4 = st.columns(4)
            with pr_c1:
                st.markdown("<div class='product-card'><h4>Elesid Pomada Efeito Matte</h4><p>Fixação Forte de Alta Performance (150g)</p><h3 style='color:#f59e0b;'>R$ 35,00</h3></div>", unsafe_allow_html=True)
            with pr_c2:
                st.markdown("<div class='product-card'><h4>Minoxidil Kirkland 6%</h4><p>Tratamento Científico para Barba e Cabelo (60ml)</p><h3 style='color:#f59e0b;'>R$ 89,90</h3></div>", unsafe_allow_html=True)
            with pr_c3:
                st.markdown("<div class='product-card'><h4>Óleo Hidratante de Barba</h4><p>Maciez Extrema com Essência de Cedro Amadeirado</p><h3 style='color:#f59e0b;'>R$ 42,00</h3></div>", unsafe_allow_html=True)
            with pr_c4:
                st.markdown("<div class='product-card'><h4>Gel Cola Blindado Extra-Forte</h4><p>Fixação Extrema para Penteados Modernos (500g)</p><h3 style='color:#f59e0b;'>R$ 22,00</h3></div>", unsafe_allow_html=True)

    # =========================================================
    # AMBIENTE DO BARBEIRO
    # =========================================================
    elif st.session_state['perfil'] == 'barbeiro':
        menu_b = st.sidebar.radio("Navegação do Negócio", ["📈 BI & Visão Estratégica", "📅 Painel de Controle Operacional"])
        
        st.sidebar.subheader("Segmentação")
        
        if menu_b == "📈 BI & Visão Estratégica":
            st.markdown("## 📊 Inteligência de Negócio & Insights Gerenciais")
            st.markdown("<div class='section-barber'>📅 PAINEL DE CONTROLE TÁTICO: FILTROS OPERACIONAIS</div>", unsafe_allow_html=True)
            
            col_data_filt, col_prof_filt = st.columns([2, 2])
            
            with col_data_filt:
                periodo_sel = st.date_input(
                    "Selecione o Intervalo de Análise:",
                    value=[date(2026, 6, 1), date(2026, 6, 30)],  
                    key="periodo_bi_principal"
                )
                
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2:
                data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1:
                data_inicio = data_fim = periodo_sel[0]
            else:
                data_inicio = data_fim = periodo_sel

            df_barbeiros_lista = pd.read_sql_query("SELECT nome FROM barbeiros", engine)
            lista_barbeiros_sistema = df_barbeiros_lista['nome'].tolist()

            with col_prof_filt:
                barbeiros_selecionados = st.segmented_control(
                    "Filtrar Equipe de Profissionais:",
                    options=lista_barbeiros_sistema,
                    default=lista_barbeiros_sistema,
                    selection_mode="multi",
                    key="filtro_segmentado_profissionais"
                )
                
            if not barbeiros_selecionados:
                st.warning("⚠️ Selecione ao menos um profissional nos botões acima para renderizar os dados.")
            else:
                df_all_age = pd.read_sql_query(
                    text("""
                        SELECT a.*, u.nome as cliente_nome 
                        FROM agendamentos a 
                        LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                        WHERE a.status = 'Agendado' 
                        AND a.data BETWEEN :ini AND :fim
                        AND a.barbeiro_nome IN :barbeiros
                    """), 
                    engine, 
                    params={
                        "ini": str(data_inicio), 
                        "fim": str(data_fim), 
                        "barbeiros": tuple(barbeiros_selecionados)
                    }
                )
                
                st.markdown(f"**Análise ativa:** Monitorando `{', '.join(barbeiros_selecionados)}` de `{data_inicio.strftime('%d/%m/%Y')}` até `{data_fim.strftime('%d/%m/%Y')}`")
                st.markdown("---")
                
                if df_all_age.empty:
                    st.info("Nenhum histórico operacional encontrado para os parâmetros selecionados.")
                else:
                    df_all_age['data_dt'] = pd.to_datetime(df_all_age['data'])
                    df_all_age['dia_semana'] = df_all_age['data_dt'].dt.strftime('%A')
                    
                    traducao_dias = {
                        'Monday': 'Segunda-Feira', 'Tuesday': 'Terça-Feira', 'Wednesday': 'Quarta-Feira',
                        'Thursday': 'Quinta-Feira', 'Friday': 'Sexta-Feira', 'Saturday': 'Sábado', 'Sunday': 'Domingo'
                    }
                    df_all_age['dia_semana'] = df_all_age['dia_semana'].map(traducao_dias)

                    tot_atendimentos = len(df_all_age)
                    faturamento_total = df_all_age['valor'].sum()
                    ticket_medio = df_all_age['valor'].mean() if not df_all_age.empty else 0
                    
                    st.markdown(f"""
                        <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px;">
                            <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Total de Atendimentos</div><div class="metric-value">{tot_atendimentos}</div></div>
                            <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Faturamento Bruto</div><div class="metric-value" style="color:#10b981">R$ {faturamento_total:.2f}</div></div>
                            <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Ticket Médio</div><div class="metric-value" style="color:#3b82f6">R$ {ticket_medio:.2f}</div></div>
                        </div>
                    """, unsafe_allow_html=True)
                    
                    st.markdown("<div class='section-barber'>📈 ANÁLISE DE VOLUMETRIA: DIAS OPERACIONAIS MAIS ACIONADOS</div>", unsafe_allow_html=True)
                    df_dias = df_all_age.groupby('dia_semana').size().reindex(list(traducao_dias.values())).fillna(0).reset_index(name='Atendimentos')
                    fig_barras = px.bar(df_dias, x='dia_semana', y='Atendimentos', color='Atendimentos', 
                                        color_continuous_scale='YlOrBr', text_auto=True)
                    fig_barras.update_layout(
                        height=450, paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', 
                        font={'color':'white', 'size': 13}, xaxis_title="Dia da Semana", yaxis_title="Total de Cortes Marcados"
                    )
                    st.plotly_chart(fig_barras, use_container_width=True)
                    
                    col_g1, col_g2 = st.columns(2)
                    with col_g1:
                        st.markdown("### 🛠️ Mix de Serviços Solicitados")
                        df_serv = df_all_age.groupby('servico').size().reset_index(name='Qtd')
                        fig_pizza = px.pie(df_serv, values='Qtd', names='servico', hole=0.45, color_discrete_sequence=px.colors.sequential.YlOrBr_r)
                        fig_pizza.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                        st.plotly_chart(fig_pizza, use_container_width=True)
                    with col_g2:
                        st.markdown("### 🏆 Repartição de Market Share Financeiro")
                        df_rank = df_all_age.groupby('barbeiro_nome').agg({'valor':'sum'}).rename(columns={'valor':'Total (R$)'}).reset_index()
                        fig_rank = px.bar(df_rank, x='barbeiro_nome', y='Total (R$)', color='Total (R$)', color_continuous_scale='Blugrn')
                        fig_rank.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                        st.plotly_chart(fig_rank, use_container_width=True)

        elif menu_b == "📅 Painel de Controle Operacional":
            st.markdown("<div class='section-barber'>📅 MINHA AGENDA DIÁRIA (VISÃO VISUAL DO BARBEIRO)</div>", unsafe_allow_html=True)
            
            col_b_data, col_b_name = st.columns(2)
            with col_b_data:
                data_agenda_diaria = st.date_input("Filtrar Agenda do Dia:", date.today(), key="agenda_dia_b")
            with col_b_name:
                barbeiro_agenda_sel = st.selectbox("Visualizar Agenda do Profissional:", ["Gabriel", "Lucas"], key="nome_b_agenda")
            
            df_agenda_dia_real = pd.read_sql_query(
                text("""
                    SELECT a.*, u.nome as cliente_nome 
                    FROM agendamentos a 
                    LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                    WHERE a.status = 'Agendado' AND a.barbeiro_nome = :b_nome AND a.data = :d_alvo
                """), engine, params={"b_nome": barbeiro_agenda_sel, "d_alvo": str(data_agenda_diaria)}
            )
            
            atendimentos_hoje = len(df_agenda_dia_real)
            st.markdown(f"""
                <div class="metric-card-barber" style="margin-bottom:20px; padding:15px; border-left: 5px solid #3b82f6;">
                    <div class="metric-title">Volume de Trabalho para o dia {data_agenda_diaria.strftime('%d/%m/%Y')}</div>
                    <div class="metric-value" style="color:#3b82f6; font-size: 1.8rem;">{atendimentos_hoje} Atendimentos Confirmados</div>
                </div>
            """, unsafe_allow_html=True)
            
            horarios_trabalho = []
            b_time = datetime.strptime("09:00", "%H:%M")
            for i in range(20):
                horarios_trabalho.append((b_time + timedelta(minutes=30*i)).strftime("%H:%M"))
                
            mapa_agenda_dia = df_agenda_dia_real.set_index('horario').to_dict(orient='index')
            
            for h_slot in horarios_trabalho:
                if h_slot in mapa_agenda_dia:
                    reg_slot = mapa_agenda_dia[h_slot]
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 6px solid #ef4444; background: #ef444408;">
                            <div style="display:flex; gap:25px; align-items:center;">
                                <span style="font-size:1.3rem; font-weight:800; color:#ef4444;">⏰ {h_slot}</span>
                                <div>
                                    <h4 style="margin:0; color:#fff; font-weight:700;">👤 Cliente: {reg_slot['cliente_nome']}</h4>
                                    <p style="margin:2px 0 0 0; font-size:0.85rem; color:#94a3b8;">🛠️ Serviço: {reg_slot['servico']}</p>
                                </div>
                            </div>
                            <span style="background:#ef444420; color:#f87171; font-weight:800; padding:6px 12px; border-radius:8px; font-size:0.9rem;">
                                💵 Caixa: R$ {reg_slot['valor']:.2f} (ID #{reg_slot['id']})
                            </span>
                        </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 4px solid #10b981; opacity: 0.65;">
                            <div style="display:flex; gap:25px; align-items:center;">
                                <span style="font-size:1.1rem; font-weight:700; color:#34d399;">⏰ {h_slot}</span>
                                <span style="color:#94a3b8; font-size:0.9rem; font-style:italic;">✨ Horário Vago / Sem Agendamento</span>
                            </div>
                            <span style="color:#10b981; font-weight:600; font-size:0.8rem; text-transform:uppercase;">Disponível</span>
                        </div>
                    """, unsafe_allow_html=True)

            st.markdown("<br><br>", unsafe_allow_html=True)
            st.markdown("<div class='section-barber'>📅 SELEÇÃO DEL PERÍODO DA TABELA GERAL DA AGENDA</div>", unsafe_allow_html=True)
            col_data_ops, _ = st.columns([2, 2])
            with col_data_ops:
                periodo_sel = st.date_input(
                    "Filtrar Tabela Geral por Período:",
                    value=[date(2026, 6, 1), date(2026, 6, 30)],
                    key="periodo_ops_principal"
                )
                
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2:
                data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1:
                data_inicio = data_fim = periodo_sel[0]
            else:
                data_inicio = data_fim = periodo_sel

            df_all_age_table = pd.read_sql_query(
                text("""
                    SELECT a.*, u.nome as cliente_nome 
                    FROM agendamentos a 
                    LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                    WHERE a.status = 'Agendado' AND a.data BETWEEN :ini AND :fim
                """), 
                engine, params={"ini": str(data_inicio), "fim": str(data_fim)}
            )

            st.markdown(f"### 📋 Tabela Cadastral Completa — {data_inicio.strftime('%d/%m')} a {data_fim.strftime('%d/%m/%Y')}")
            
            df_agenda_geral = df_all_age_table[['id', 'cliente_nome', 'barbeiro_nome', 'data', 'horario', 'servico', 'valor']].rename(columns={
                'id': 'ID', 'cliente_nome': 'Nome do Cliente', 'barbeiro_nome': 'Barbeiro',
                'data': 'Data', 'horario': 'Horário', 'servico': 'Serviço Solicitado', 'valor': 'Preço (R$)'
            })
            
            if df_agenda_geral.empty:
                st.info("Nenhum cliente agendado nesta faixa de tempo na tabela.")
            else:
                st.dataframe(df_agenda_geral, use_container_width=True)
                
                id_cancelar = st.number_input("Informe o ID do agendamento que deseja remover administrativamente:", min_value=1, step=1)
                if st.button("❌ DESMARCAR AGENDAMENTO AGORA", type="primary", use_container_width=True):
                    if id_cancelar in df_agenda_geral['ID'].values:
                        with engine.begin() as conn:
                            conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_cancelar)})
                        st.success(f"O agendamento ID #{id_cancelar} foi removido e o horário foi liberado com sucesso.")
                        st.rerun()
                    else:
                        st.error("ID não localizado na lista ativa.")
