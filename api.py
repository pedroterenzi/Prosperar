from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        # Tabela de Agendamentos Atualizada com Coluna de Status
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id SERIAL PRIMARY KEY,
                cliente VARCHAR(255) NOT NULL,
                servico VARCHAR(255) NOT NULL,
                barbeiro VARCHAR(255) NOT NULL,
                data VARCHAR(50) NOT NULL,
                hora VARCHAR(50) NOT NULL,
                pagamento VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'Agendado'
            );
        """)
        # Tabela de Usuários com a estrutura oficial solicitada
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                login VARCHAR(100) UNIQUE NOT NULL,
                senha VARCHAR(100) NOT NULL,
                nome VARCHAR(255) NOT NULL,
                perfil VARCHAR(50) DEFAULT 'cliente',
                celular VARCHAR(50),
                preferencias TEXT,
                pontos_fidelidade INT DEFAULT 0,
                plano_assinatura VARCHAR(100) DEFAULT 'Nenhum'
            );
        """)
        # Garante a existência do usuário administrador padrão para testes se não existir
        cursor.execute("SELECT * FROM usuarios WHERE login = 'gabriel';")
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO usuarios (login, senha, nome, perfil, celular, plano_assinatura) 
                VALUES ('gabriel', '123456', 'Gabriel Proprietário', 'admin', '11999999999', 'Premium');
            """)
        conn.commit()
        cursor.close()
        conn.close()
        print("⚡ Tabelas estruturadas e sincronizadas no Neon!")
    except Exception as e:
        print(f"❌ Erro ao estruturar banco: {str(e)}")

inicializar_banco()

# Schemas Pydantic
class ModeloCadastro(BaseModel):
    login: str
    senha: str
    nome: str
    celular: str
    plano_assinatura: Optional[str] = "Nenhum"

class ModeloAgendamento(BaseModel):
    cliente: str
    servico: str
    barbeiro: str
    data: str
    hora: str
    pagamento: str

class ModeloStatus(BaseModel):
    status: str

# --- ROTAS DE AUTENTICAÇÃO E USUÁRIOS ---
@app.post("/usuarios/cadastro")
def cadastrar_usuario(obj: ModeloCadastro):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO usuarios (login, senha, nome, perfil, celular, plano_assinatura) VALUES (%s, %s, %s, 'cliente', %s, %s);",
            (obj.login.strip().lower(), obj.senha, obj.nome, obj.celular, obj.plano_assinatura)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=400, detail="Este login já está cadastrado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/usuarios/login")
def login_usuario(obj: dict):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM usuarios WHERE login = %s AND senha = %s;", (obj.get("login").strip().lower(), obj.get("senha")))
        usuario = cursor.fetchone()
        cursor.close()
        conn.close()
        if usuario:
            return usuario
        raise HTTPException(status_code=404, detail="Usuário ou senha incorretos.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/usuarios")
def listar_usuarios():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id, login, nome, perfil, celular, pontos_fidelidade, plano_assinatura FROM usuarios;")
        usuarios = cursor.fetchall()
        cursor.close()
        conn.close()
        return usuarios
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ROTAS DE AGENDAMENTOS ---
@app.post("/agendamentos")
def salvar_agendamento(obj: ModeloAgendamento):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO agendamentos (cliente, servico, barbeiro, data, hora, pagamento, status) VALUES (%s, %s, %s, %s, %s, %s, 'Agendado') RETURNING id;",
            (obj.cliente, obj.servico, obj.barbeiro, obj.data, obj.hora, obj.pagamento)
        )
        novo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "id": novo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agendamentos")
def listar_agendamentos():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM agendamentos;")
        dados = cursor.fetchall()
        cursor.close()
        conn.close()
        return dados
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/agendamentos/{id}/status")
def atualizar_status(id: int, obj: ModeloStatus):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("UPDATE agendamentos SET status = %s WHERE id = %s;", (obj.status, id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "atualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/agendamentos/{id}")
def remover_agendamento(id: int):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM agendamentos WHERE id = %s;", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
