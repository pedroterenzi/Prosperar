import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import hashlib
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine, text
import urllib.parse

# 1. CONFIGURAÇÃO DA PÁGINA (Experiência Mobile-First e Dark)
st.set_page_config(layout="wide", page_title="BarberFlow OS", page_icon="💈")

# =========================================================
# BANCO DE DADOS NA NUVEM (POSTGRESQL - NEON.TECH)
# =========================================================
CONNECTION_STRING = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
WHATSAPP_NOTIFICA = "5519971374936"  # Destinatário oficial das notificações

@st.cache_resource
def obter_engine():
    return create_engine(CONNECTION_STRING, pool_pre_ping=True)

def hash_senha(senha):
    return hashlib.sha256(str.encode(senha)).hexdigest()

def init_db():
    engine = obter_engine()
    with engine.begin() as conn:
        # Tabela de Usuários Unificada (Clientes e Barbeiros)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT
            )
        """))
        # Tabela de Barbeiros Cadastrados
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS barbeiros (
                id SERIAL PRIMARY KEY, nome TEXT UNIQUE, especialidade TEXT
            )
        """))
        # Tabela Central de Agendamentos
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY, cliente_login TEXT, barbeiro_nome TEXT,
                data TEXT, horario TEXT, servico TEXT, valor REAL, status TEXT DEFAULT 'Agendado'
            )
        """))
        
        # Carga Inicial de Dados (Se o banco estiver vazio)
        res = conn.execute(text("SELECT COUNT(*) FROM barbeiros")).fetchone()[0]
        if res == 0:
            conn.execute(text("INSERT INTO barbeiros (nome, especialidade) VALUES ('Gabriel', 'Especialista em Degradê & Visagismo')"))
            conn.execute(text("INSERT INTO barbeiros (nome, especialidade) VALUES ('Lucas', 'Mestre das Barbas & Toalha Quente')"))
            
            # Usuário do Barbeiro Gabriel para Acesso Administrativo
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
    servicos_fake = ["Corte Simples", "Corte + Sobrancelha", "Barba Completa", "Combo Premium (Corte + Barba + Sobrancelha)", "Luzes / Nevou"]
    
    precos_mapping = {
        "Corte Simples": 40.0, "Corte + Sobrancelha": 55.0, "Barba Completa": 35.0,
        "Combo Premium (Corte + Barba + Sobrancelha)": 85.0, "Luzes / Nevou": 90.0
    }
    
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
                    valor = precos_mapping[servico]
                    
                    conn.execute(text("""
                        INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, status)
                        VALUES (:u, :b, :d, :h, :s, :v, 'Agendado')
                    """), {"u": cliente, "b": barbeiro, "d": str(data_alvo), "h": hora, "s": servico, "v": valor})
                    contador += 1
    return contador

# --- CONTROLE DE ESTADOS DO STREAMLIT ---
if 'auth' not in st.session_state: st.session_state['auth'] = False
if 'user' not in st.session_state: st.session_state['user'] = None
if 'perfil' not in st.session_state: st.session_state['perfil'] = None
if 'nome_usuario' not in st.session_state: st.session_state['nome_usuario'] = None
if 'reg_sucesso' not in st.session_state: st.session_state['reg_sucesso'] = 0
if 'horario_confirmando' not in st.session_state: st.session_state['horario_confirmando'] = None

# --- ESTILIZAÇÃO CSS PREMIUM (Visual Moderno Cyber-Barber) ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    
    div[data-baseweb="popover"] { z-index: 999999 !important; }
    
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
    </style>
    """, unsafe_allow_html=True)

SERVICOS = {
    "Corte Simples": {"preco": 40.0, "tempo": 30},
    "Corte + Sobrancelha": {"preco": 55.0, "tempo": 30},
    "Barba Completa": {"preco": 35.0, "tempo": 30},
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0, "tempo": 30},
    "Luzes / Nevou": {"preco": 90.0, "tempo": 30}
}

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
                            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, cellular) VALUES (:l, :s, :n, 'cliente', :c)"),
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
        if st.button("🚪 Encerrar Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.session_state['horario_confirmando'] = None
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
            
            # --- TRAVA DE SEGURANÇA E CONFIRMAÇÃO ---
            if st.session_state['horario_confirmando'] is not None:
                hora_conf = st.session_state['horario_confirmando']
                st.markdown("---")
                with st.chat_message("assistant"):
                    st.markdown(f"### 🛡️ Confirmar seu Agendamento para as **{hora_conf}**?")
                    st.markdown(f"• **Profissional:** {barbeiro_sel}\n• **Serviço:** {servico_sel}\n• **Preço:** R$ {preco_servico:.2f}\n• **Data:** {data_sel.strftime('%d/%m/%Y')}")
                    
                    cc_1, cc_2 = st.columns(2)
                    with cc_1:
                        if st.button("✅ Sim, Confirmar Horário", type="primary", use_container_width=True):
                            with engine.begin() as conn:
                                conn.execute(text("""
                                    INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor)
                                    VALUES (:u, :b, :d, :h, :s, :v)
                                """), {"u": st.session_state['user'], "b": barbeiro_sel, "d": str(data_sel), "h": hora_conf, "s": servico_sel, "v": preco_servico})
                            
                            msg_wpp = f"f'💈 *CONFIRMAÇÃO DE AGENDAMENTO* 💈\\n\\nOlá, o cliente *{st.session_state['nome_usuario']}* agendou um horário:\\n\\n📅 *Data:* {data_sel.strftime('%d/%m/%Y')}\\n⏰ *Horário:* {hora_conf}\\n👤 *Barbeiro:* {barbeiro_sel}\\n🛠️ *Serviço:* {servico_sel}\\n💵 *Valor:* R$ {preco_servico:.2f}'"
                            url_wpp = f"https://api.whatsapp.com/send?phone={WHATSAPP_NOTIFICA}&text={urllib.parse.quote(msg_wpp)}"
                            
                            st.session_state['horario_confirmando'] = None
                            st.success(f"🎉 Reservado com sucesso para as {hora_conf}!")
                            st.markdown(f'<a href="{url_wpp}" target="_blank" style="text-decoration:none;"><div style="background-color:#25d366; color:white; padding:16px; text-align:center; border-radius:12px; font-weight:bold; margin-top:12px; box-shadow: 0 4px 12px rgba(37,211,102,0.3);">💬 ENVIAR COMPROVANTE VIA WHATSAPP</div></a>', unsafe_allow_html=True)
                            st.balloons()
                            st.rerun()
                    with cc_2:
                        if st.button("❌ Mudar de Ideia / Cancelar", use_container_width=True):
                            st.session_state['horario_confirmando'] = None
                            st.rerun()
                st.markdown("---")

            # Geração da janela de horários (Grade Limpa)
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
                            st.session_state['horario_confirmando'] = hora
                            st.rerun()

            # --- GESTÃO DE MEUS COMPROMISSOS COM BOTÃO DE CANCELAR ---
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
        menu_b = st.sidebar.radio("Navegação do Negócio", ["📊 BI & Visão Estratégica", "📅 Painel de Controle Operacional"])
        
        st.sidebar.subheader("Segmentação")
        
        if menu_b == "📊 BI & Visão Estratégica":
            st.markdown("## 📊 Inteligência de Negócio & Insights Gerenciais")
            
            # --- FILTRO MOVIDO E CORRIGIDO PARA O CORPO PRINCIPAL ---
            st.markdown("<div class='section-barber'>📅 FILTRO DE JANELA TEMPORAL DO CONSOLIDADO</div>", unsafe_allow_html=True)
            
            col_data_filt, _ = st.columns([2, 2])
            with col_data_filt:
                periodo_sel = st.date_input(
                    "Selecione o Intervalo de Análise:",
                    value=[date(2026, 6, 1), date(2026, 6, 30)],  # Junho de 2026 cheio
                    key="periodo_bi_principal"
                )
            
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2:
                data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1:
                data_inicio = data_fim = periodo_sel[0]
            else:
                data_inicio = data_fim = periodo_sel
                
            st.markdown(f"**Análise ativa:** Gerenciando dados de `{data_inicio.strftime('%d/%m/%Y')}` até `{data_fim.strftime('%d/%m/%Y')}`")
            st.markdown("---")

            df_all_age = pd.read_sql_query(
                text("""
                    SELECT a.*, u.nome as cliente_nome 
                    FROM agendamentos a 
                    LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                    WHERE a.status = 'Agendado' AND a.data BETWEEN :ini AND :fim
                """), 
                engine, params={"ini": str(data_inicio), "fim": str(data_fim)}
            )
            
            if df_all_age.empty:
                st.warning("⚠️ Nenhum histórico operacional encontrado na janela temporal selecionada.")
            else:
                df_all_age['data_dt'] = pd.to_datetime(df_all_age['data'])
                df_all_age['dia_semana'] = df_all_age['data_dt'].dt.strftime('%A')
                
                traducao_dias = {
                    'Monday': 'Segunda-Feira', 'Tuesday': 'Terça-Feira', 'Wednesday': 'Quarta-Feira',
                    'Thursday': 'Quinta-Feira', 'Friday': 'Sexta-Feira', 'Saturday': 'Sábado', 'Sunday': 'Domingo'
                }
                df_all_age['dia_semana'] = df_all_age['dia_semana'].map(traducao_dias)

                f_barber = st.sidebar.multiselect("Filtrar por Profissionais:", df_all_age['barbeiro_nome'].unique(), default=df_all_age['barbeiro_nome'].unique())
                df_filtered = df_all_age[df_all_age['barbeiro_nome'].isin(f_barber)]

                # --- CORREÇÃO DA MÉTRICA DE ATENDIMENTOS ---
                tot_atendimentos = len(df_filtered)
                faturamento_total = df_filtered['valor'].sum()
                ticket_medio = df_filtered['valor'].mean() if not df_filtered.empty else 0
                
                st.markdown(f"""
                    <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px;">
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Total de Atendimentos</div><div class="metric-value">{tot_atendimentos}</div></div>
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Faturamento Bruto</div><div class="metric-value" style="color:#10b981">R$ {faturamento_total:.2f}</div></div>
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Ticket Médio</div><div class="metric-value" style="color:#3b82f6">R$ {ticket_medio:.2f}</div></div>
                    </div>
                """, unsafe_allow_html=True)
                
                # --- GRÁFICO DIÁRIO EXPANDIDO E EM DESTAQUE ---
                st.markdown("<div class='section-barber'>📈 ANÁLISE DE VOLUMETRIA: DIAS OPERACIONAIS MAIS ACIONADOS</div>", unsafe_allow_html=True)
                df_dias = df_filtered.groupby('dia_semana').size().reindex(list(traducao_dias.values())).fillna(0).reset_index(name='Atendimentos')
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
                    df_serv = df_filtered.groupby('servico').size().reset_index(name='Qtd')
                    fig_pizza = px.pie(df_serv, values='Qtd', names='servico', hole=0.45, color_discrete_sequence=px.colors.sequential.YlOrBr_r)
                    fig_pizza.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                    st.plotly_chart(fig_pizza, use_container_width=True)
                with col_g2:
                    st.markdown("### 🏆 Repartição de Market Share Financeiro")
                    df_rank = df_filtered.groupby('barbeiro_nome').agg({'valor':'sum'}).rename(columns={'valor':'Total (R$)'}).reset_index()
                    fig_rank = px.bar(df_rank, x='barbeiro_nome', y='Total (R$)', color='Total (R$)', color_continuous_scale='Blugrn')
                    fig_rank.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                    st.plotly_chart(fig_rank, use_container_width=True)

        elif menu_b == "📅 Painel de Controle Operacional":
            st.markdown("<div class='section-barber'>📅 SELEÇÃO DO PERÍODO DA AGENDA OPERACIONAL</div>", unsafe_allow_html=True)
            col_data_ops, _ = st.columns([2, 2])
            with col_data_ops:
                periodo_sel = st.date_input(
                    "Filtrar Agenda por Período:",
                    value=[date(2026, 6, 1), date(2026, 6, 30)],
                    key="periodo_ops_principal"
                )
                
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2:
                data_inicio, data_fim = periodo_sel
            elif isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 1:
                data_inicio = data_fim = periodo_sel[0]
            else:
                data_inicio = data_fim = periodo_sel

            df_all_age = pd.read_sql_query(
                text("""
                    SELECT a.*, u.nome as cliente_nome 
                    FROM agendamentos a 
                    LEFT JOIN usuarios_barber u ON a.cliente_login = u.login 
                    WHERE a.status = 'Agendado' AND a.data BETWEEN :ini AND :fim
                """), 
                engine, params={"ini": str(data_inicio), "fim": str(data_fim)}
            )

            st.markdown(f"## 📋 Prontuário Geral — Agenda de {data_inicio.strftime('%d/%m')} a {data_fim.strftime('%d/%m/%Y')}")
            st.caption("Visão detalhada da agenda contendo Nome do Cliente e o Tipo de Serviço Real prestado.")
            
            df_agenda_geral = df_all_age[['id', 'cliente_nome', 'barbeiro_nome', 'data', 'horario', 'servico', 'valor']].rename(columns={
                'id': 'ID', 'cliente_nome': 'Nome do Cliente', 'barbeiro_nome': 'Barbeiro',
                'data': 'Data', 'horario': 'Horário', 'servico': 'Serviço Solicitado', 'valor': 'Preço (R$)'
            })
            
            if df_agenda_geral.empty:
                st.info("Nenhum cliente agendado nesta faixa de tempo.")
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
