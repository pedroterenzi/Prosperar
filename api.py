from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import psycopg2
from psycopg2.extras import RealDictCursor
import os

app = FastAPI()

# Permitir que o seu front-end da Vercel acesse a API do Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# String de conexão do seu Banco Neon (configurada nas variáveis de ambiente do Render)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://usuario:senha@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require")

# Modelo de dados que o banco Neon espera receber
class Agendamento(BaseModel):
    cliente: str
    servico: str
    barbeiro: str
    data: str
    hora: str
    pagamento: str

# Função para conectar ao Neon e criar a tabela se ela não existir
def inicializar_banco():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agendamentos (
            id SERIAL PRIMARY KEY,
            cliente VARCHAR(255) NOT NULL,
            servico VARCHAR(255) NOT NULL,
            barbeiro VARCHAR(255) NOT NULL,
            data VARCHAR(50) NOT NULL,
            hora VARCHAR(50) NOT NULL,
            pagamento VARCHAR(100) NOT NULL
        );
    """)
    conn.commit()
    cursor.close()
    conn.close()

inicializar_banco()

@app.post("/agendamentos")
def criar_agendamento(obj: Agendamento):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO agendamentos (cliente, servico, barbeiro, data, hora, pagamento) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;",
            (obj.cliente, obj.servico, obj.barbeiro, obj.data, obj.hora, obj.pagamento)
        )
        novo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "id": novo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no banco Neon: {str(e)}")

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

@app.delete("/agendamentos/{id}")
def deletar_agendamento(id: int):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM agendamentos WHERE id = %s;", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "deletado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
