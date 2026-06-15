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

# --- CONTROLE DE ESTADOS DO STREAMLIT ---
if 'auth' not in st.session_state: st.session_state['auth'] = False
if 'user' not in st.session_state: st.session_state['user'] = None
if 'perfil' not in st.session_state: st.session_state['perfil'] = None
if 'nome_usuario' not in st.session_state: st.session_state['nome_usuario'] = None

# --- ESTILIZAÇÃO CSS PREMIUM (Visual Moderno Cyber-Barber) ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    
    .metric-card-barber {
        background: linear-gradient(135deg, #1e2028 0%, #14151b 100%);
        padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a;
        text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    
    .time-slot {
        padding: 15px; border-radius: 12px; text-align: center; font-weight: 700;
        margin-bottom: 10px; border: 1px solid transparent; transition: all 0.2s;
    }
    .slot-available { background-color: #10b98120; border-color: #10b981; color: #34d399; }
    .slot-booked { background-color: #ef444415; border-color: #ef4444; color: #f87171; text-decoration: line-through; }
    
    .section-barber {
        background: #1e2028; padding: 12px 20px; border-radius: 8px;
        color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px;
    }
    </style>
    """, unsafe_allow_html=True)

# PORTFÓLIO DE SERVIÇOS PONTUADOS (Fração Padrão: 30 Minutos)
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
                else: st.error("Usuário ou Senha incorretos para o perfil Cliente.")
                
        with aba_cad_c:
            st.markdown("<div class='section-barber'>Cadastro Rápido de Novo Cliente</div>", unsafe_allow_html=True)
            cad_nome_c = st.text_input("Nome Completo")
            cad_log_c = st.text_input("Escolha seu Nome de Usuário", key="cad_log_c").strip().lower()
            cad_cel_c = st.text_input("WhatsApp (Com DDD - Apenas números)", placeholder="Ex: 19971374936")
            cad_senha_c = st.text_input("Defina sua Senha", type="password", key="cad_senha_c")
            if st.button("🎯 FINALIZAR MEU CADASTRO", use_container_width=True):
                if cad_nome_c and cad_log_c and cad_senha_c:
                    engine = obter_engine()
                    try:
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO usuarios_barber (login, senha, nome, perfil, celular) VALUES (:l, :s, :n, 'cliente', :c)"),
                                         {"l": cad_log_c, "s": hash_senha(cad_senha_c), "n": cad_nome_c, "c": cad_cel_c})
                        st.success("Conta criada com sucesso! Acesse a aba de Login para entrar.")
                    except: st.error("Este nome de usuário já está sendo utilizado.")
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
    
    # Barra Superior Dinâmica
    col_h1, col_h2 = st.columns([4, 1])
    with col_h1:
        st.markdown(f"### ⚡ Conectado como: **{st.session_state['nome_usuario']}** <span style='color:#f59e0b'>[{st.session_state['perfil'].upper()}]</span>", unsafe_allow_html=True)
    with col_h2:
        if st.button("🚪 Encerrar Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.rerun()
            
    st.markdown("---")

    # =========================================================
    # AMBIENTE DO CLIENTE: VISUALIZAÇÃO E MARCAÇÃO DE AGENDA
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
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
        
        # Criação de Janelas Fixas de Atendimento (Passo de 30 minutos das 09h às 19h)
        horarios_janela = []
        base_time = datetime.strptime("09:00", "%H:%M")
        for i in range(20):
            slot = (base_time + timedelta(minutes=30*i)).strftime("%H:%M")
            horarios_janela.append(slot)
            
        # Cruzamento com registros existentes para o profissional no dia selecionado
        df_ocupados = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"),
                                        engine, params={"b": barbeiro_sel, "d": str(data_sel)})
        ocupados_list = df_ocupados['horario'].tolist()
        
        st.markdown("<div class='section-barber'>Horários Disponíveis para Reserva</div>", unsafe_allow_html=True)
        
        # Construção Visual Interativa dos Quadrantes Horários
        cols_grade = st.columns(5)
        for idx, hora in enumerate(horarios_janela):
            col_slot = cols_grade[idx % 5]
            if hora in ocupados_list:
                col_slot.markdown(f"<div class='time-slot slot-booked'>🛑 Ocupado {hora}</div>", unsafe_allow_html=True)
            else:
                col_slot.markdown(f"<div class='time-slot slot-available'>🟢 Livre {hora}</div>", unsafe_allow_html=True)
                if col_slot.button(f"Reservar {hora}", key=f"btn_{hora}"):
                    with engine.begin() as conn:
                        conn.execute(text("""
                            INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor)
                            VALUES (:u, :b, :d, :h, :s, :v)
                        """), {"u": st.session_state['user'], "b": barbeiro_sel, "d": str(data_sel), "h": hora, "s": servico_sel, "v": preco_servico})
                        
                    # Construção e Disparo da Mensagem Oficial via WhatsApp Web Link
                    msg_wpp = f"💈 *CONFIRMAÇÃO DE AGENDAMENTO* 💈\n\nOlá, o cliente *{st.session_state['nome_usuario']}* acabou de realizar um agendamento:\n\n📅 *Data:* {data_sel.strftime('%d/%m/%Y')}\n⏰ *Horário:* {hora}\n👤 *Barbeiro:* {barbeiro_sel}\n🛠️ *Serviço:* {servico_sel}\n💵 *Valor:* R$ {preco_servico:.2f}\n\n_Enviado via BarberFlow OS v2026_"
                    url_wpp = f"https://api.whatsapp.com/send?phone={WHATSAPP_NOTIFICA}&text={urllib.parse.quote(msg_wpp)}"
                    
                    st.success(f"🎉 Horário reservado com sucesso para as {hora}!")
                    st.markdown(f"""
                        <a href="{url_wpp}" target="_blank" style="text-decoration:none;">
                            <div style="background-color:#25d366; color:white; padding:16px; text-align:center; border-radius:12px; font-weight:bold; margin-top:12px; box-shadow: 0 4px 12px rgba(37,211,102,0.3);">
                                💬 CLIQUE AQUI PARA CONFIRMAR SEU HORÁRIO NO WHATSAPP
                            </div>
                        </a>
                    """, unsafe_allow_html=True)
                    st.balloons()
                    st.utility_mode = True
                    
        st.markdown("<br><br>", unsafe_allow_html=True)
        st.markdown("<div class='section-barber'>Meus Compromissos Agendados</div>", unsafe_allow_html=True)
        df_meus_cards = pd.read_sql_query(text("SELECT id as \"ID\", barbeiro_nome as \"Barbeiro\", data as \"Data\", horario as \"Horário\", servico as \"Serviço\", valor as \"Valor (R$)\" FROM agendamentos WHERE cliente_login = :u AND status = 'Agendado'"), engine, params={"u": st.session_state['user']})
        st.dataframe(df_meus_cards, use_container_width=True)

    # =========================================================
    # AMBIENTE ADMINISTRATIVO: GESTÃO COMPLETA E DASHBOARDS (BI)
    # =========================================================
    elif st.session_state['perfil'] == 'barbeiro':
        menu_b = st.sidebar.radio("Navegação do Negócio", ["📊 BI & Visão Estratégica", "📅 Painel de Controle Operacional"])
        
        df_all_age = pd.read_sql_query("SELECT * FROM agendamentos WHERE status = 'Agendado'", engine)
        
        if menu_b == "📊 BI & Visão Estratégica":
            st.markdown("## 📊 Inteligência de Negócio & Insights Gerenciais")
            
            if df_all_age.empty:
                st.info("Nenhum histórico operacional encontrado para compor as análises de BI.")
            else:
                # Engenharia de Atributos com Pandas
                df_all_age['data_dt'] = pd.to_datetime(df_all_age['data'])
                df_all_age['mes'] = df_all_age['data_dt'].dt.strftime('%B')
                df_all_age['dia_semana'] = df_all_age['data_dt'].dt.strftime('%A')
                
                traducao_dias = {
                    'Monday': 'Segunda-Feira', 'Tuesday': 'Terça-Feira', 'Wednesday': 'Quarta-Feira',
                    'Thursday': 'Quinta-Feira', 'Friday': 'Sexta-Feira', 'Saturday': 'Sábado', 'Sunday': 'Domingo'
                }
                df_all_age['dia_semana'] = df_all_age['dia_semana'].map(traducao_dias)

                # Sistema de Filtros Inteligentes Lateral
                st.sidebar.subheader("Segmentação por Profissionais")
                f_barber = st.sidebar.multiselect("Filtrar por Nome:", df_all_age['barbeiro_nome'].unique(), default=df_all_age['barbeiro_nome'].unique())
                df_filtered = df_all_age[df_all_age['barbeiro_nome'].isin(f_barber)]

                # Painel Executivo de Indicadores de Alta Resolução
                tot_clientes = df_filtered['cliente_login'].nunique()
                faturamento_total = df_filtered['valor'].sum()
                ticket_medio = df_filtered['valor'].mean()
                
                st.markdown(f"""
                    <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px;">
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Clientes Atendidos (Período)</div><div class="metric-value">{tot_clientes}</div></div>
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Faturamento Total Bruto</div><div class="metric-value" style="color:#10b981">R$ {faturamento_total:.2f}</div></div>
                        <div class="metric-card-barber" style="flex: 1;"><div class="metric-title">Ticket Médio por Atendimento</div><div class="metric-value" style="color:#3b82f6">R$ {ticket_medio:.2f}</div></div>
                    </div>
                """, unsafe_allow_html=True)
                
                # Renderização da Área Gráfica com Plotly High-Design
                col_g1, col_g2 = st.columns(2)
                
                with col_g1:
                    st.markdown("### 🛠️ Mix de Serviços (Market Share Interno)")
                    df_serv = df_filtered.groupby('servico').size().reset_index(name='Qtd')
                    fig_pizza = px.pie(df_serv, values='Qtd', names='servico', hole=0.42,
                                       color_discrete_sequence=px.colors.sequential.YlOrBr_r)
                    fig_pizza.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                    st.plotly_chart(fig_pizza, use_container_width=True)
                    
                with col_g2:
                    st.markdown("### 📈 Fluxo Volumétrico por Dias da Semana")
                    df_dias = df_filtered.groupby('dia_semana').size().reindex(list(traducao_dias.values())).fillna(0).reset_index(name='Atendimentos')
                    fig_barras = px.bar(df_dias, x='dia_semana', y='Atendimentos', color='Atendimentos', color_continuous_scale='YlOrBr')
                    fig_barras.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font={'color':'white'})
                    st.plotly_chart(fig_barras, use_container_width=True)
                    
                # Matriz Analítica Adicional: Desempenho Financeiro Individualizado
                st.markdown("### 🏆 Performance Financeira por Colaborador")
                df_rank = df_filtered.groupby('barbeiro_nome').agg({'valor':'sum', 'id':'count'}).rename(columns={'valor':'Faturamento Gerado (R$)', 'id':'Quantidade de Atendimentos'}).reset_index()
                st.dataframe(df_rank.sort_values(by="Faturamento Gerado (R$)", ascending=False), use_container_width=True)

        elif menu_b == "📅 Painel de Controle Operacional":
            st.markdown("## 📋 Gestão de Horários e Agenda Unificada")
            st.caption("Central de Cancelamento: Barbeiros têm autonomia total para remover agendamentos e organizar horários.")
            
            st.markdown("<div class='section-barber'>Linha de Tempo de Agendamentos Ativos</div>", unsafe_allow_html=True)
            df_agenda_geral = pd.read_sql_query("SELECT id as \"ID\", cliente_login as \"Cliente\", barbeiro_nome as \"Barbeiro\", data as \"Data\", horario as \"Horário\", servico as \"Serviço\", valor as \"Preço\" FROM agendamentos WHERE status = 'Agendado' ORDER BY data, horario ASC", engine)
            st.dataframe(df_agenda_geral, use_container_width=True)
            
            id_cancelar = st.number_input("Informe o ID do agendamento que deseja desmarcar:", min_value=1, step=1)
            if st.button("❌ CANCELAR HORÁRIO SELECIONADO", type="primary", use_container_width=True):
                if id_cancelar in df_agenda_geral['ID'].values:
                    with engine.begin() as conn:
                        conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_cancelar)})
                    st.success(f"💥 Agendamento ID #{id_cancelar} cancelado com sucesso. O horário já se encontra disponível para novos clientes!")
                    st.rerun()
                else:
                    st.error("O ID digitado não foi localizado ou não corresponde a um agendamento ativo.")
