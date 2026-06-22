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
        
        # Tabela de Agendamentos 
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
        
        try:
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_produtos NUMERIC DEFAULT 0.00;")
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_gorjeta NUMERIC DEFAULT 0.00;")
        except Exception:
            pass
            
        # Tabela de Usuários 
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

        # Tabela de Despesas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS despesas (
                id SERIAL PRIMARY KEY,
                descricao VARCHAR(255) NOT NULL,
                valor NUMERIC NOT NULL,
                data VARCHAR(50) NOT NULL
            );
        """)

        # Tabela de Serviços (NOVA)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS servicos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                preco NUMERIC NOT NULL,
                sub VARCHAR(255)
            );
        """)
        
        # Inserir serviços padrões se a tabela estiver vazia
        cursor.execute("SELECT COUNT(*) FROM servicos;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO servicos (nome, preco, sub) VALUES 
                ('Corte Simples', 40.00, 'Duração: 30 min'), 
                ('Corte + Sobrancelha', 55.00, 'Duração: 45 min'), 
                ('Barba Completa', 35.00, 'Duração: 30 min'), 
                ('Combo Premium', 85.00, 'Corte + Barba + Sobrancelha');
            """)

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
    status: Optional[str] = "Agendado"
    valor_produtos: Optional[float] = 0.0
    valor_gorjeta: Optional[float] = 0.0

class ModeloStatus(BaseModel):
    status: str

class ModeloDespesa(BaseModel):
    descricao: str
    valor: float
    data: str

class ModeloServico(BaseModel):
    nome: str
    preco: float
    sub: str

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
            "INSERT INTO agendamentos (cliente, servico, barbeiro, data, hora, pagamento, status, valor_produtos, valor_gorjeta) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;",
            (obj.cliente, obj.servico, obj.barbeiro, obj.data, obj.hora, obj.pagamento, obj.status, obj.valor_produtos, obj.valor_gorjeta)
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

@app.put("/agendamentos/{id}")
def editar_agendamento(id: int, obj: ModeloAgendamento):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE agendamentos SET servico = %s, barbeiro = %s, data = %s, hora = %s, pagamento = %s WHERE id = %s;",
            (obj.servico, obj.barbeiro, obj.data, obj.hora, obj.pagamento, id)
        )
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

# --- ROTAS DE DESPESAS ---
@app.post("/despesas")
def salvar_despesa(obj: ModeloDespesa):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO despesas (descricao, valor, data) VALUES (%s, %s, %s) RETURNING id;",
            (obj.descricao, obj.valor, obj.data)
        )
        novo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "id": novo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/despesas")
def listar_despesas():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM despesas ORDER BY data DESC;")
        dados = cursor.fetchall()
        cursor.close()
        conn.close()
        return dados
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/despesas/{id}")
def editar_despesa(id: int, obj: ModeloDespesa):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE despesas SET descricao = %s, valor = %s, data = %s WHERE id = %s;",
            (obj.descricao, obj.valor, obj.data, id)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "atualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/despesas/{id}")
def remover_despesa(id: int):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM despesas WHERE id = %s;", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ROTAS DE SERVIÇOS ---
@app.post("/servicos")
def salvar_servico(obj: ModeloServico):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO servicos (nome, preco, sub) VALUES (%s, %s, %s) RETURNING id;",
            (obj.nome, obj.preco, obj.sub)
        )
        novo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "id": novo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/servicos")
def listar_servicos():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM servicos ORDER BY preco ASC;")
        dados = cursor.fetchall()
        cursor.close()
        conn.close()
        return dados
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/servicos/{id}")
def editar_servico(id: int, obj: ModeloServico):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE servicos SET nome = %s, preco = %s, sub = %s WHERE id = %s;",
            (obj.nome, obj.preco, obj.sub, id)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "atualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/servicos/{id}")
def remover_servico(id: int):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM servicos WHERE id = %s;", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "removido"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
