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

# Portfólio de Serviços e Configuração de Split de Comissão
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

# =========================================================
# 🛡️ POP-UP DIALOG DE CONFIRMAÇÃO
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
    
    if st.session_state["ultimo_horario_salvo"] == hora:
        st.markdown(f"""
            <div style="background-color:#10b98115; border:1px solid #10b981; color:#34d399; padding:15px; border-radius:10px; font-weight:bold; text-align:center; margin-top:15px; margin-bottom:15px;">
                🎉 Agendado com sucesso no sistema para as {hora}!
            </div>
        """, unsafe_allow_html=True)
        
        if st.button("Concluir e Fechar", use_container_width=True, type="primary"):
            st.session_state["ultimo_horario_salvo"] = None  
            st.rerun()
            
    else:
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
                    
                    # Concede ponto de fidelidade no Neon
                    conn.execute(text("UPDATE usuarios_barber SET pontos_fidelidade = pontos_fidelidade + 1 WHERE login = :u"), {"u": st.session_state['user']})
                
                st.session_state["ultimo_horario_salvo"] = hora
                st.balloons()
                st.rerun()
                
        with col_pop2:
            if st.button("❌ Cancelar", use_container_width=True):
                st.session_state["ultimo_horario_salvo"] = None
                st.rerun()

def init_db():
    engine = obter_engine()
    
    # Criação de Tabelas Base
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usuarios_barber (
                id SERIAL PRIMARY KEY, login TEXT UNIQUE, senha TEXT, nome TEXT, perfil TEXT, celular TEXT
            )
        """))
    
    # Injeção Isolada de Novas Colunas
    for coluna, tipo in [("preferencias", "TEXT DEFAULT 'Gosta de café sem açúcar, usa pomada matte'"), 
                         ("pontos_fidelidade", "INTEGER DEFAULT 0"), 
                         ("plano_assinatura", "TEXT DEFAULT 'Nenhum'")]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE usuarios_barber ADD COLUMN {coluna} {tipo};"))
        except:
            pass

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY, cliente_login TEXT, barbeiro_nome TEXT,
                data TEXT, horario TEXT, servico TEXT, valor REAL, status TEXT DEFAULT 'Agendado'
            )
        """))
        
    for col_ag, tipo_ag in [("forma_pagamento", "TEXT DEFAULT 'Pix'"), 
                            ("nota_avaliacao", "INTEGER DEFAULT 0"), 
                            ("feedback_texto", "TEXT")]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE agendamentos ADD COLUMN {col_ag} {tipo_ag};"))
        except:
            pass

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sala_espera (
                id SERIAL PRIMARY KEY, cliente_login TEXT, horario_checkin TEXT, status_presenca TEXT DEFAULT 'A caminho'
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS estoque_produtos (
                id SERIAL PRIMARY KEY, nome_produto TEXT UNIQUE, quantidade INTEGER, limite_minimo INTEGER, preco_venda REAL
            )
        """))
        
        # Carga padrão de produtos
        if conn.execute(text("SELECT COUNT(*) FROM estoque_produtos")).fetchone()[0] == 0:
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Pomada Efeito Matte Elesid', 3, 5, 35.0)"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Minoxidil Kirkland 6%', 14, 4, 89.90)"))
            conn.execute(text("INSERT INTO estoque_produtos (nome_produto, quantidade, limite_minimo, preco_venda) VALUES ('Cerveja Budweiser Long Neck', 25, 10, 10.0)"))

        # --- PERMISSÃO ATUALIZADA: Gabriel definido diretamente como Administrador Master ---
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

# --- CONTROLE DE ESTADOS ---
if 'auth' not in st.session_state: st.session_state['auth'] = False
if 'user' not in st.session_state: st.session_state['user'] = None
if 'perfil' not in st.session_state: st.session_state['perfil'] = None
if 'nome_usuario' not in st.session_state: st.session_state['nome_usuario'] = None
if 'reg_sucesso' not in st.session_state: st.session_state['reg_sucesso'] = 0
if 'ultimo_horario_salvo' not in st.session_state: st.session_state['ultimo_horario_salvo'] = None

# --- FLUXO DE TELA INICIAL ---
if not st.session_state['auth']:
    st.markdown("<h1 style='text-align:center; color:#f59e0b; font-weight:900; margin-top:30px;'>💈 BARBEARIA PROSPERIDADE</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center; color:#94a3b8;'>PROSPERIDADE OS — Gestão Operacional, CRM & Finanças Integradas</p>", unsafe_allow_html=True)
    
    st.sidebar.markdown("### 🧪 Central de Testes")
    if st.sidebar.button("⚡ Injetar Dados da Barbearia Prosperidade", use_container_width=True):
        try:
            dados_gerados = injetar_dados_demonstracao()
            st.sidebar.success(f"🔥 {dados_gerados} registros operacionais criados!")
            st.balloons()
        except Exception as err: st.sidebar.error(f"Erro: {err}")
            
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
        if st.button("🔑 SOLICITAR ENTRADA NO SISTEMA", use_container_width=True):
            engine = obter_engine()
            df_b = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :l AND senha = :s AND perfil IN ('barbeiro', 'admin')"), engine, params={"l": l_b, "s": hash_senha(s_b)})
            if not df_b.empty:
                st.session_state['auth'], st.session_state['user'], st.session_state['perfil'], st.session_state['nome_usuario'] = True, df_b.iloc[0]['login'], df_b.iloc[0]['perfil'], df_b.iloc[0]['nome']
                st.rerun()
            else: st.error("Credenciais inválidas.")

else:
    engine = obter_engine()
    col_h1, col_h2 = st.columns([4, 1])
    with col_h1: st.markdown(f"### 💈 **{st.session_state['nome_usuario']}** @ Prosperidade <span style='color:#f59e0b'>[{st.session_state['perfil'].upper()}]</span>", unsafe_allow_html=True)
    with col_h2:
        if st.button("🚪 Encerrar Sessão", use_container_width=True):
            st.session_state['auth'] = False
            st.rerun()
    st.markdown("---")

    # =========================================================
    # 1. AMBIENTE DO CLIENTE
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
        df_cli = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :u"), engine, params={"u": st.session_state['user']}).iloc[0]
        c_menu = st.tabs(["📅 Agendamento 3 Passos", "👑 Meu Estilo & Fidelidade", "⏳ Check-in & Espera Virtual", "⭐ Avaliar Atendimento"])
        
        with c_menu[0]:
            st.markdown("### 📅 Reserve sua vaga na linha do tempo")
            col_c1, col_c2, col_c3 = st.columns(3)
            with col_c1: serv_sel = st.selectbox("1. Escolha o Serviço Real:", list(SERVICOS.keys()))
            with col_c2: barb_sel = st.selectbox("2. Selecione o Barbeiro:", ["Gabriel", "Lucas"])
            with col_c3: data_sel = st.date_input("3. Escolha o Dia:", date.today(), min_value=date.today())
            
            horarios_janela = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*i)).strftime("%H:%M") for i in range(20)]
            df_oc = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"), engine, params={"b": barb_sel, "d": str(data_sel)})
            ocupados_list = df_oc['horario'].tolist()
            
            agora_br = datetime.utcnow() - timedelta(hours=3)
            hora_atual_str = agora_br.strftime("%H:%M")
            eh_hoje = (data_sel == date.today())

            cols_grade = st.columns(4)
            for idx, hora in enumerate(horarios_janela):
                with cols_grade[idx % 4]:
                    if hora in ocupados_list or (eh_hoje and hora < hora_atual_str):
                        st.markdown(f"<div class='time-slot-card' style='border-color:#ef4444;'><span class='status-badge badge-ocupado'>🛑 Reservado</span><h4>{hora}</h4></div>", unsafe_allow_html=True)
                        st.button("Ocupado", key=f"ind_{hora}", disabled=True, use_container_width=True)
                    else:
                        st.markdown(f"<div class='time-slot-card' style='border-color:#10b981;'><span class='status-badge badge-livre'>🟢 Livre</span><h4>{hora}</h4></div>", unsafe_allow_html=True)
                        if st.button("Agendar Vaga", key=f"av_{hora}", use_container_width=True):
                            mostrar_popup_confirmacao(hora, barb_sel, serv_sel, SERVICOS[serv_sel]["preco"], data_sel)

        with c_menu[1]:
            st.markdown("### 👑 Meu Perfil de Estilo & Fidelidade")
            f_col1, f_col2 = st.columns(2)
            with f_col1:
                st.markdown(f"""
                    <div class='metric-card-barber' style='border-left:6px solid #f59e0b;'>
                        <div class='metric-title'>Meus Pontos Acumulados</div>
                        <div class='metric-value'>{df_cli['pontos_fidelidade']} / 10</div>
                        <p style='color:#94a3b8; font-size:0.8rem; margin-top:5px;'>Ganhe 1 ponto por corte. Ao atingir 10 pontos você ganha uma Hidratação Premium de graça!</p>
                    </div>
                """, unsafe_allow_html=True)
            with f_col2:
                st.markdown(f"""
                    <div class='metric-card-barber' style='border-left:6px solid #3b82f6;'>
                        <div class='metric-title'>Plano de Assinatura Ativo</div>
                        <div class='metric-value' style='font-size:1.6rem; padding-top:12px; color:#3b82f6;'>{df_cli['plano_assinatura']}</div>
                    </div>
                """, unsafe_allow_html=True)
                if df_cli['plano_assinatura'] == "Nenhum":
                    if st.button("Assinar Plano Prosperidade Ilimitado (R$ 149,90/mês)", use_container_width=True):
                        with engine.begin() as conn: conn.execute(text("UPDATE usuarios_barber SET plano_assinatura = 'VIP Prosperidade' WHERE login = :u"), {"u": st.session_state['user']})
                        st.success("Plano ativado! Agora você tem cortes livres.")
                        st.rerun()

            st.markdown("#### 🗒️ Minha Ficha de Estilo (Visualizado pelo Barbeiro)")
            st.info(df_cli['preferencias'])
            st.markdown("#### 📸 Fotos dos meus Cortes Anteriores (Histórico de Cadeira)")
            st.image(["https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=300", "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300"], width=150, caption=["Último Corte (Mid Fade)", "Corte Anterior (Cabelo + Barba)"])

        with c_menu[2]:
            st.markdown("### ⏳ Check-in e Sala de Espera Virtual")
            st.write("A caminho da barbearia? Faça o check-in e entre na fila virtual para agilizar sua recepção!")
            if st.button("🚀 FAZER CHECK-IN AGORA"):
                with engine.begin() as conn: 
                    conn.execute(text("INSERT INTO sala_espera (cliente_login, horario_checkin) VALUES (:u, :h)"), {"u": st.session_state['user'], "h": (datetime.utcnow()-timedelta(hours=3)).strftime("%H:%M")})
                st.toast("Check-in computado! Os profissionais foram alertados na bancada.")
            
            st.markdown("#### Tempo de Espera Estimado da Barbearia")
            st.metric(label="Tempo na Sala de Espera Física para Encaixes", value="12 min", delta="Cadeiras Otimizadas")

        with c_menu[3]:
            st.markdown("### ⭐ Avaliação Interna Direta ao Proprietário")
            with st.form("form_feedback"):
                nota = st.slider("Nota do Atendimento:", 1, 5, 5)
                comentario = st.text_area("O que achou do serviço e do atendimento?")
                if st.form_submit_button("Enviar Avaliação"):
                    with engine.begin() as conn: conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, nota_avaliacao, feedback_texto, status) VALUES (:u, 'Ouvidoria', :d, '00:00', 'Feedback Direto', 0, :n, :f, 'Feedback')"), {"u": st.session_state['user'], "d": str(date.today()), "n": nota, "f": comentario})
                    st.success("Obrigado pelo feedback! Ele foi enviado diretamente à administração.")

    # =========================================================
    # 2. AMBIENTE DO BARBEIRO (LUCAS OU GABRIEL OPERANDO CADEIRA)
    # =========================================================
    elif st.session_state['perfil'] == 'barbeiro':
        b_menu = st.tabs(["📅 Agenda de Bancada", "📊 Minhas Comissões & Metas"])
        
        with b_menu[0]:
            st.markdown("### 📅 Linha de Trabalho Diária")
            with engine.connect() as conn:
                df_cortes = pd.read_sql_query(text("SELECT a.id, a.cliente_login, a.barbeiro_nome, a.data, a.horario, a.servico, a.valor, u.nome as cliente_nome, u.preferencias FROM agendamentos a LEFT JOIN usuarios_barber u ON a.cliente_login = u.login WHERE a.status = 'Agendado' AND a.barbeiro_nome = :b_nome AND a.data = :d_alvo"), conn, params={"b_nome": st.session_state['nome_usuario'], "d_alvo": str(date.today())})
            
            st.metric("Atendimentos Confirmados Hoje", len(df_cortes))
            
            horarios_trabalho = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*i)).strftime("%H:%M") for i in range(20)]
            df_cortes = df_cortes.drop_duplicates(subset=['horario'])
            mapa_agenda = df_cortes.set_index('horario').to_dict(orient='index')
            
            for h in horarios_trabalho:
                if h in mapa_agenda:
                    reg = mapa_agenda[h]
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 6px solid #ef4444; background: #ef444408;">
                            <div>
                                <span style="font-size:1.3rem; font-weight:800; color:#ef4444;">⏰ {h}</span>
                                <span style="margin-left:20px; font-weight:700; color:#fff;">👤 Cliente: {reg['cliente_nome']}</span>
                                <span style="margin-left:20px; color:#94a3b8; font-size:0.85rem;"> 🛠️ {reg['servico']}</span>
                            </div>
                            <div style='color:#f59e0b; font-weight:700;'>R$ {reg['valor']:.2f}</div>
                        </div>
                    """, unsafe_allow_html=True)
                    with st.expander(f"⚙️ Prontuário de {reg['cliente_nome']}"):
                        st.write(f"**Preferências de Cadeira:** {reg['preferencias']}")
                        st.file_uploader("📸 Adicionar Foto ao Portfólio / Estilo do Cliente", type=['png','jpg'], key=f"f_{h}")
                else:
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 4px solid #10b981; opacity:0.7;">
                            <div><span style="font-size:1.1rem; font-weight:700; color:#34d399;">⏰ {h}</span><span style="margin-left:20px; color:#94a3b8; font-style:italic;">Disponível</span></div>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button("Bloquear Horário", key=f"bloq_{h}"):
                        with engine.begin() as conn: conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor) VALUES ('bloqueio_manual', :b, :d, :h, 'Bloqueio', 0)"), {"b": st.session_state['nome_usuario'], "d": str(date.today()), "h": h})
                        st.rerun()

        with b_menu[1]:
            st.markdown("### 📊 Painel de Comissões & Metas do Profissional")
            fat_bruto = df_cortes['valor'].sum()
            comissao = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_cortes.iterrows() if r['servico'] in SERVICOS])
            
            mc1, mc2, mc3 = st.columns(3)
            with mc1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Gerado Hoje</div><div class='metric-value'>R$ {fat_bruto:.2f}</div></div>", unsafe_allow_html=True)
            with mc2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Minha Comissão Líquida</div><div class='metric-value' style='color:#10b981;'>R$ {comissao:.2f}</div></div>", unsafe_allow_html=True)
            with mc3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Meta Diária (R$ 300)</div><div class='metric-value' style='color:#3b82f6;'>{min(int((fat_bruto/300)*100), 100)}%</div></div>", unsafe_allow_html=True)

    # =========================================================
    # 3. AMBIENTE ADMINISTRATIVO MASTER (GERENCIAL DO DONO GABRIEL)
    # =========================================================
    elif st.session_state['perfil'] == 'admin':
        st.markdown("### 🛠️ Infraestrutura de Lançamento e Controle Gerencial")
        
        # O Gabriel pode alternar entre a visão de Gestão do Negócio e a sua própria Agenda de Cortes
        modo_visao = st.sidebar.radio("Selecione o Painel Ativo:", ["📊 Visão Proprietário (Admin)", "📅 Minha Agenda na Cadeira (Gabriel)"])
        
        if modo_visao == "📅 Minha Agenda na Cadeira (Gabriel)":
            st.markdown("### 📅 Minha Grade Pessoal de Atendimentos — Gabriel")
            with engine.connect() as conn:
                df_cortes_gab = pd.read_sql_query(text("SELECT a.id, a.cliente_login, a.barbeiro_nome, a.data, a.horario, a.servico, a.valor, u.nome as cliente_nome, u.preferencias FROM agendamentos a LEFT JOIN usuarios_barber u ON a.cliente_login = u.login WHERE a.status = 'Agendado' AND a.barbeiro_nome = 'Gabriel' AND a.data = :d_alvo"), conn, params={"d_alvo": str(date.today())})
            
            horarios_trabalho = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*i)).strftime("%H:%M") for i in range(20)]
            df_cortes_gab = df_cortes_gab.drop_duplicates(subset=['horario'])
            mapa_agenda_gab = df_cortes_gab.set_index('horario').to_dict(orient='index')
            
            for h in horarios_trabalho:
                if h in mapa_agenda_gab:
                    reg = mapa_agenda_gab[h]
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 6px solid #ef4444; background: #ef444408;">
                            <div>
                                <span style="font-size:1.3rem; font-weight:800; color:#ef4444;">⏰ {h}</span>
                                <span style="margin-left:20px; font-weight:700; color:#fff;">👤 Cliente: {reg['cliente_nome']}</span>
                                <span style="margin-left:20px; color:#94a3b8; font-size:0.85rem;"> 🛠️ {reg['servico']}</span>
                            </div>
                            <div style='color:#f59e0b; font-weight:700;'>R$ {reg['valor']:.2f}</div>
                        </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                        <div class="barber-agenda-row" style="border-left: 4px solid #10b981; opacity:0.7;">
                            <div><span style="font-size:1.1rem; font-weight:700; color:#34d399;">⏰ {h}</span><span style="margin-left:20px; color:#94a3b8; font-style:italic;">Disponível</span></div>
                        </div>
                    """, unsafe_allow_html=True)
        
        else:
            adm_menu = st.tabs(["💰 Split & Finanças", "📦 Controle de Estoque Inteligente", "🎯 CRM: Retenção & Avaliações", "➕ Agendamento Manual"])
            
            st.markdown("<div class='section-barber'>📅 JANELA TEMPORAL DE ANÁLISE CONSOLIDADA DO DONO</div>", unsafe_allow_html=True)
            periodo_sel = st.date_input("Intervalo de Dates:", value=[date(2026, 6, 1), date(2026, 6, 30)], key="p_adm")
            if isinstance(periodo_sel, (list, tuple)) and len(periodo_sel) == 2: d_i, d_f = periodo_sel
            else: d_i = d_f = date.today()

            df_adm = pd.read_sql_query(text("SELECT * FROM agendamentos WHERE status = 'Agendado' AND data BETWEEN :ini AND :fim"), engine, params={"ini": str(d_i), "fim": str(d_f)})

            with adm_menu[0]:
                st.markdown("### 💰 Receita & Split de Pagamento Automático")
                if df_adm.empty: st.info("Nenhuma movimentação no período.")
                else:
                    bruto = df_adm['valor'].sum()
                    repasse_b = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_adm.iterrows() if r['servico'] in SERVICOS])
                    lucro_casa = bruto - repasse_b
                    
                    ac1, ac2, ac3 = st.columns(3)
                    with ac1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Bruto</div><div class='metric-value'>R$ {bruto:.2f}</div></div>", unsafe_allow_html=True)
                    with ac2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Repasse Equipe</div><div class='metric-value' style='color:#ef4444;'>R$ {repasse_b:.2f}</div></div>", unsafe_allow_html=True)
                    with ac3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Lucro Líquido Casa</div><div class='metric-value' style='color:#10b981;'>R$ {lucro_casa:.2f}</div></div>", unsafe_allow_html=True)
                    
                    df_meios = df_adm.groupby('forma_pagamento')['valor'].sum().reset_index()
                    st.plotly_chart(px.bar(df_meios, x='forma_pagamento', y='valor', color='forma_pagamento', title="Faturamento por Meios de Pagamento"), use_container_width=True)

            with adm_menu[1]:
                st.markdown("### 📦 Controle de Estoque Inteligente")
                df_estoque = pd.read_sql_query("SELECT * FROM estoque_produtos", engine)
                for _, r in df_estoque.iterrows():
                    if r['quantidade'] <= r['limite_minimo']:
                        st.error(f"🚨 **ALERTA DE REPOSIÇÃO:** {r['nome_produto']} atingiu o limite mínimo crítico! Qtd: `{r['quantidade']}` (Mínimo: {r['limite_minimo']})")
                st.dataframe(df_estoque, use_container_width=True)

            with adm_menu[2]:
                st.markdown("### 🎯 CRM: Clientes Sumidos & Sistema de Avaliações")
                col_crm1, col_crm2 = st.columns(2)
                with col_crm1:
                    st.markdown("#### 🏃‍♂️ Clientes Ausentes (+45 dias)")
                    st.table(pd.DataFrame({"Cliente": ["Danilo Santos", "Alexandre Guerra"], "Última Visita": ["12/04/2026", "24/04/2026"], "WhatsApp": ["(19) 97137-4936", "(19) 98888-2233"]}))
                    if st.button("Disparar Cupons de Retenção em Massa"): st.toast("Campanha enviada via Push!")
                with col_crm2:
                    st.markdown("#### ⭐ Feedbacks e Avaliações Privadas")
                    df_fb = pd.read_sql_query("SELECT cliente_login, nota_avaliacao, feedback_texto FROM agendamentos WHERE nota_avaliacao > 0", engine)
                    st.dataframe(df_fb, use_container_width=True)

            with adm_menu[3]:
                st.markdown("### ➕ Agendamento Direto de Balcão (Lançamento Rápido)")
                col_b_man1, col_b_man2, col_b_man3 = st.columns(3)
                with col_b_man1: 
                    m_cli = st.text_input("Nome do Cliente de Balcão:")
                    m_barb = st.selectbox("Designar Barbeiro:", ["Gabriel", "Lucas"], key="m_brb_adm")
                with col_b_man2:
                    m_data = st.date_input("Data do Corte:", date.today(), key="m_dt_adm")
                    m_serv = st.selectbox("Serviço Escolhido:", list(SERVICOS.keys()), key="m_sv_adm")
                
                df_man_oc = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"), engine, params={"b": m_barb, "d": str(m_data)})
                man_ocupados = df_man_oc['horario'].tolist()
                horarios_gerais = [(datetime.strptime("09:00", "%H:%M") + timedelta(minutes=30*k)).strftime("%H:%M") for k in range(20)]
                horarios_livres = [h for h in horarios_gerais if h not in man_ocupados]
                
                with col_b_man3:
                    m_hora = st.selectbox("Horários Livres:", horarios_livres, key="m_hr_adm")
                    m_preco = SERVICOS[m_serv]["preco"]
                    st.markdown(f"Valor: `R$ {m_preco:.2f}`")
                
                if st.button("🚀 Efetuar Agendamento Manual de Balcão", use_container_width=True, type="primary"):
                    if m_cli and m_hora:
                        with engine.begin() as conn:
                            conn.execute(text("INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor) VALUES (:u, :b, :d, :h, :s, :v)"), {"u": f"manual_{m_cli.lower().replace(' ', '_')}", "b": m_barb, "d": str(m_data), "h": m_hora, "s": m_serv, "v": m_preco})
                        st.success("Horário agendado com sucesso no balcão!")
                        st.rerun()
