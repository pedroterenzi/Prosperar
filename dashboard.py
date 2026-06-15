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
    "Corte Simples": {"preco": 40.0, "comissao": 0.50, "tempo": "30 min", "foto": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400"},
    "Corte + Sobrancelha": {"preco": 55.0, "comissao": 0.50, "tempo": "45 min", "foto": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400"},
    "Barba Completa": {"preco": 35.0, "comissao": 0.50, "tempo": "30 min", "foto": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400"},
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0, "comissao": 0.55, "tempo": "60 min", "foto": "https://images.unsplash.com/photo-1512864084360-7c0c4d0a0845?w=400"},
    "Luzes / Nevou": {"preco": 90.0, "comissao": 0.60, "tempo": "90 min", "foto": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400"}
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
                forma_f = "Pix Antecipado" if "Pix" in tipo_pagamento else "Presencial"
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
                id SERIAL PRIMARY KEY, nome_produto TEXT UNIQUE, quantidade INTEGER, limite_minimo INTEGER, preco_venda REAL
            )
        """))
        
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

# --- ESTILIZAÇÃO CSS PREMIUM ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Plus Jakarta Sans', sans-serif; }
    .stApp { background-color: #0d0e12; color: #e2e8f0; }
    
    /* Elementos Visuais das Abas e Cards */
    .metric-card-barber {
        background: linear-gradient(135deg, #1e2028 0%, #14151b 100%);
        padding: 22px; border-radius: 16px; border: 1px solid #2a2d3a; text-align: center;
    }
    .metric-title { color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { color: #f59e0b; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }
    
    .time-slot-card { background: #1e2028; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #2a2d3a; margin-bottom: 8px; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
    .badge-livre { background: #10b98120; color: #34d399; border: 1px solid #10b981; }
    .badge-ocupado { background: #ef444420; color: #f87171; border: 1px solid #ef4444; }
    
    .section-barber { background: #1e2028; padding: 12px 20px; border-radius: 8px; color: #fff; font-weight: 700; border-left: 5px solid #f59e0b; margin-bottom: 15px; }
    
    .product-card {
        background: #14151b; border: 1px solid #2a2d3a; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px;
        min-height: 290px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .barber-card-visual { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px; text-align: center; }
    .barber-agenda-row { background: #14151b; border: 1px solid #2a2d3a; border-radius: 12px; padding: 15px 20px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    </style>
    """, unsafe_allow_html=True)

# =========================================================
# FLUXO DE TELA INICIAL
# =========================================================
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
    # 1. AMBIENTE DO CLIENTE (UX TOTALMENTE REDESENHADA)
    # =========================================================
    if st.session_state['perfil'] == 'cliente':
        df_cli = pd.read_sql_query(text("SELECT * FROM usuarios_barber WHERE login = :u"), engine, params={"u": st.session_state['user']}).iloc[0]
        
        # --- 1. SAUDAÇÃO SAUDÁVEL DINÂMICA ---
        agora_brasil = datetime.utcnow() - timedelta(hours=3)
        hora_int = agora_brasil.hour
        if hora_int < 12: saudacao = "Bom dia"
        elif hora_int < 18: saudacao = "Boa tarde"
        else: saudacao = "Boa noite"
        
        st.markdown(f"## 👋 {saudacao}, {st.session_state['nome_usuario'].split()[0]}. Bora dar um tapa no visual?")
        
        # --- 2. CARD DE DESTAQUE SUPERIOR (ÚLTIMO AGENDAMENTO ACTIVO) ---
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

        c_menu = st.tabs(["📅 Agendamento em 4 Passos", "📸 Ficha de Estilo & Galeria", "🧴 Loja de Cosméticos", "⏳ Espera Virtual & Ouvidoria"])
        
        # --- FLUXO DE AGENDAMENTO INTELIGENTE ---
        with c_menu[0]:
            st.markdown("### 🛠️ Configurar Novo Agendamento")
            
            # Passo 1: Menu Visual de Serviços
            st.markdown("<div class='section-barber'>PASSO 1: SELECIONE O SERVIÇO DESEJADO</div>", unsafe_allow_html=True)
            serv_cols = st.columns(3)
            servico_escolhido = None
            for idx, (nome_s, dados_s) in enumerate(SERVICOS.items()):
                with serv_cols[idx % 3]:
                    st.markdown(f"""
                        <div class='product-card' style='min-height:310px;'>
                            <img src='{dados_s["foto"]}' style='width:100%; height:130px; object-fit:cover; border-radius:8px; margin-bottom:8px;'/>
                            <div style='font-weight:700; color:#fff;'>{nome_s}</div>
                            <div style='color:#94a3b8; font-size:0.8rem;'>⏱️ Duração: {dados_s["tempo"]}</div>
                            <h3 style='color:#10b981; margin:5px 0;'>R$ {dados_s["preco"]:.2f}</h3>
                        </div>
                    """, unsafe_allow_html=True)
                    if st.button(f"Selecionar {nome_s.split()[0]}", key=f"sel_ser_{idx}", use_container_width=True):
                        st.session_state["serv_fluxo"] = nome_s
            
            serv_fluxo = st.session_state.get("serv_fluxo", "Corte Simples")
            st.success(f"Serviço Selecionado: **{serv_fluxo}**")
            
            # Passo 2: Seleção do Profissional
            st.markdown("<div class='section-barber'>PASSO 2: ESCOLHA O PROFISSIONAL (BARBEIRO)</div>", unsafe_allow_html=True)
            col_b1, col_b2 = st.columns(2)
            with col_b1:
                st.markdown("""
                    <div class='barber-card-visual'>
                        <img src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' style='border-radius:50%; width:70px; height:70px; object-fit:cover;'/>
                        <h4 style='margin:5px 0 0 0;'>Gabriel (Proprietário)</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.9 (148 avaliações)</p>
                        <p style='color:#94a3b8; font-size:0.75rem;'>Degradê & Visagismo Executivo</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("Escolher Gabriel", use_container_width=True): st.session_state["barb_fluxo"] = "Gabriel"
            with col_b2:
                st.markdown("""
                    <div class='barber-card-visual'>
                        <img src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' style='border-radius:50%; width:70px; height:70px; object-fit:cover;'/>
                        <h4 style='margin:5px 0 0 0;'>Lucas Barber</h4>
                        <p style='color:#f59e0b; margin:0;'>⭐ 4.8 (96 avaliações)</p>
                        <p style='color:#94a3b8; font-size:0.75rem;'>Mestre das Barbas & Toalha Quente</p>
                    </div>
                """, unsafe_allow_html=True)
                if st.button("Escolher Lucas", use_container_width=True): st.session_state["barb_fluxo"] = "Lucas"
                
            barb_fluxo = st.session_state.get("barb_fluxo", "Gabriel")
            st.success(f"Barbeiro Selecionado: **{barb_fluxo}**")
            
            # Passo 3: Grade de Horários Inteligente Dividida por Turnos
            st.markdown("<div class='section-barber'>PASSO 3: GRADE DE HORÁRIOS DIVIDIDA POR TURNOS</div>", unsafe_allow_html=True)
            data_sel = st.date_input("Selecione o Dia da Cadeira:", date.today(), min_value=date.today(), key="data_fluxo_cli")
            
            df_oc = pd.read_sql_query(text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'"), engine, params={"b": barb_fluxo, "d": str(data_sel)})
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
                            st.markdown(f"<div class='time-slot-card' style='border-color:#ef4444; opacity:0.5; padding:6px;'><span style='color:#f87171; font-size:0.7rem;'>🛑 Ocupado</span><h5 style='margin:2px 0;'>{h_slot}</h5></div>", unsafe_allow_html=True)
                        else:
                            if st.button(f"🟢 {h_slot}", key=f"slot_flx_{turno_nome}_{h_slot}", use_container_width=True):
                                mostrar_popup_confirmacao(h_slot, barb_fluxo, serv_fluxo, SERVICOS[serv_fluxo]["preco"], data_sel)

            st.markdown("<br><br>", unsafe_allow_html=True)
            st.markdown("<div class='section-barber'>❌ GERENCIAR MEUS AGENDAMENTOS ATIVOS</div>", unsafe_allow_html=True)
            if not df_meus_cards.empty:
                st.dataframe(df_meus_cards, use_container_width=True)
                id_cancelar_cliente = st.number_input("Digite o ID do agendamento que deseja desmarcar:", min_value=1, step=1, key="c_del_cli")
                if st.button("🚨 REMOVER HORÁRIO DA AGENDA", type="primary", use_container_width=True):
                    if id_cancelar_cliente in df_meus_cards['id'].values:
                        with engine.begin() as conn: conn.execute(text("UPDATE agendamentos SET status = 'Cancelado' WHERE id = :id"), {"id": int(id_cancelar_cliente)})
                        st.success("Horário desmarcado com sucesso!")
                        st.rerun()

        # --- ÁREA MEU ESTILO ---
        with c_menu[1]:
            st.markdown("### 👑 Ficha de Estilo do Cliente & Clube Fidelidade Gamificado")
            
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
            
            st.markdown("#### 📸 Galeria Antes e Depois (Linha do Tempo Capilar)")
            img_cols = st.columns(3)
            with img_cols[0]: st.image("https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=300", caption="Última Visita (Gabriel Barber)")
            with img_cols[1]: st.image("https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300", caption="Visita Anterior (Lucas Barber)")

        # --- LOJA DE COSMÉTICOS ---
        with c_menu[2]:
            st.markdown("### 🧴 Loja Home-Care da Barbearia Prosperidade")
            st.caption("Mantenha o penteado impecável em casa. Compre pelo app e retire na sua próxima visita!")
            
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

        # --- SALA DE ESPERA E OUVIDORIA ---
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
    # 2. AMBIENTE DO BARBEIRO (LUCAS OPERANDO)
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
                        <div class="barber-agenda-row" style="border-left: 6px solid #ef4444; background: #ef444405;">
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

        with b_menu[1]:
            st.markdown("### 📊 Painel de Comissões & Metas do Profissional")
            fat_bruto = df_cortes['valor'].sum()
            comissao = sum([r['valor'] * SERVICOS[r['servico']]['comissao'] for _, r in df_cortes.iterrows() if r['servico'] in SERVICOS])
            
            mc1, mc2, mc3 = st.columns(3)
            with mc1: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Faturamento Gerado Hoje</div><div class='metric-value'>R$ {fat_bruto:.2f}</div></div>", unsafe_allow_html=True)
            with mc2: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Minha Comissão Líquida</div><div class='metric-value' style='color:#10b981;'>R$ {comissao:.2f}</div></div>", unsafe_allow_html=True)
            with mc3: st.markdown(f"<div class='metric-card-barber'><div class='metric-title'>Meta Diária (R$ 300)</div><div class='metric-value' style='color:#3b82f6;'>{min(int((fat_bruto/300)*100), 100)}%</div></div>", unsafe_allow_html=True)

    # =========================================================
    # 3. AMBIENTE ADMINISTRATIVO MASTER (PROPRIETÁRIO GABRIEL)
    # =========================================================
    elif st.session_state['perfil'] == 'admin':
        modo_visao = st.sidebar.radio("Selecione o Painel Ativo:", ["📊 Painel Corporativo (Faturamento/CRM)", "📅 Minha Agenda na Cadeira (Gabriel)"])
        
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
            periodo_sel = st.date_input("Intervalo de Datas:", value=[date(2026, 6, 1), date(2026, 6, 30)], key="p_adm")
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
