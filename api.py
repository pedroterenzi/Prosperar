from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()

# Libera o acesso para o front-end hospedado na Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# STRING DE CONEXÃO REAL DO SEU BANCO NEON
DATABASE_URL = "postgresql://neondb_owner:npg_FB5WRUfgniD9@ep-calm-grass-ah0b366i.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def inicializar_banco():
    """Garante a existência da tabela operacional no Neon"""
    try:
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
        print("⚡ Banco Neon conectado e sincronizado com sucesso!")
    except Exception as e:
        print(f"❌ Erro na inicialização do banco: {str(e)}")

inicializar_banco()

class ModeloAgendamento(BaseModel):
    cliente: str
    servico: str
    barbeiro: str
    data: str
    hora: str
    pagamento: str

@app.post("/agendamentos")
def salvar_agendamento(obj: ModeloAgendamento):
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
        raise HTTPException(status_code=500, detail=f"Erro ao salvar no Neon: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Erro ao ler o Neon: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Erro ao deletar no Neon: {str(e)}")
