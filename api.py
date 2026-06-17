from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import hashlib

app = FastAPI(
    title="Barbearia Prosperidade API",
    description="Backend para conectar o banco Neon ao site/app do Vercel",
    version="1.0.0"
)

# Permite que o site do Vercel consiga conversar com essa API sem bloqueios de segurança
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sua string de conexão oficial do Neon
CONNECTION_STRING = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
engine = create_engine(CONNECTION_STRING, pool_pre_ping=True)

# Tabela de preços e serviços herdada do seu sistema
SERVICOS = {
    "Corte Simples": {"preco": 40.0},
    "Corte + Sobrancelha": {"preco": 55.0},
    "Barba Completa": {"preco": 35.0},
    "Combo Premium (Corte + Barba + Sobrancelha)": {"preco": 85.0},
    "Luzes / Nevou": {"preco": 90.0}
}

def hash_senha(senha: str):
    return hashlib.sha256(str.encode(senha)).hexdigest()

# Modelos de dados para a API entender o que o site está enviando
class LoginSchema(BaseModel):
    login: str
    senha: str

class AgendamentoSchema(BaseModel):
    cliente_login: str
    barbeiro_nome: str
    data: str  # YYYY-MM-DD
    horario: str  # HH:MM
    servico: str
    forma_pagamento: str

# 🔐 ROTA 1: LOGIN
@app.post("/api/auth/login")
def login_usuario(dados: LoginSchema):
    with engine.connect() as conn:
        query = text("SELECT login, nome, perfil FROM usuarios_barber WHERE login = :l AND senha = :s")
        result = conn.execute(query, {"l": dados.login.strip().lower(), "s": hash_senha(dados.senha)}).fetchone()
        
        if not result:
            raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
            
        return {
            "status": "sucesso",
            "usuario": {"login": result[0], "nome": result[1], "perfil": result[2]}
        }

# 📅 ROTA 2: VER HORÁRIOS LIVRES
@app.get("/api/agenda/disponibilidade")
def obter_disponibilidade(barbeiro: str, dia: str):
    todos_horarios = [
        "09:00", "09:30", "11:00", "11:30", "12:00", "12:30", 
        "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", 
        "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
    ]
    
    agora_brasil = datetime.utcnow() - timedelta(hours=3)
    hora_atual_str = agora_brasil.strftime("%H:%M")
    data_hoje_str = agora_brasil.strftime("%Y-%m-%d")
    
    with engine.connect() as conn:
        query = text("SELECT horario FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND status = 'Agendado'")
        dados_oc = conn.execute(query, {"b": barbeiro, "d": dia}).fetchall()
        ocupados = [row[0] for row in dados_oc]
        
    horarios_livres = []
    for h in todos_horarios:
        if h in ocupados:
            continue
        if dia == data_hoje_str and h < hora_atual_str:
            continue
        horarios_livres.append(h)
        
    return {"barbeiro": barbeiro, "data": dia, "horarios_disponiveis": horarios_livres}

# 🚀 ROTA 3: MARCAR AGENDAMENTO
@app.post("/api/agenda/marcar")
def marcar_cadeira(agendamento: AgendamentoSchema):
    if agendamento.servico not in SERVICOS:
        raise HTTPException(status_code=400, detail="Serviço inválido.")
        
    preco = SERVICOS[agendamento.servico]["preco"]
    fator_pontos = 2 if "Pix" in agendamento.forma_pagamento else 1
    
    try:
        with engine.begin() as conn:
            check = conn.execute(text(
                "SELECT id FROM agendamentos WHERE barbeiro_nome = :b AND data = :d AND horario = :h AND status = 'Agendado'"
            ), {"b": agendamento.barbeiro_nome, "d": agendamento.data, "h": agendamento.horario}).fetchone()
            
            if check:
                raise HTTPException(status_code=409, detail="Horário já preenchido!")

            conn.execute(text("""
                INSERT INTO agendamentos (cliente_login, barbeiro_nome, data, horario, servico, valor, forma_pagamento, status)
                VALUES (:u, :b, :d, :h, :s, :v, :fp, 'Agendado')
            """), {
                "u": agendamento.cliente_login, "b": agendamento.barbeiro_nome,
                "d": agendamento.data, "h": agendamento.horario, "s": agendamento.servico,
                "v": preco, "fp": agendamento.forma_pagamento
            })
            
            conn.execute(text(
                "UPDATE usuarios_barber SET pontos_fidelidade = pontos_fidelidade + :f WHERE login = :u"
            ), {"f": fator_pontos, "u": agendamento.cliente_login})
            
        return {"status": "sucesso", "mensagem": "Agendamento confirmado!"}
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))
