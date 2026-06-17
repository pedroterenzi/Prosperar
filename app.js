const API_URL = "https://prosperar.onrender.com"; 

let usuarioLogado = null;
let perfilLogado = null;
let horarioSelecionado = null;

// Elementos de Login
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');

// Elementos de Telas
const telaLogin = document.getElementById('tela-login');
const telaAgendamento = document.getElementById('tela-agendamento');
const telaBarbeiro = document.getElementById('tela-barbeiro');

// ==========================================
// FUNÇÃO DE LOGIN (CONEXÃO REAL COM A API)
// ==========================================
btnEntrar.addEventListener('click', async () => {
    const login = inputUser.value.trim();
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        erroLogin.innerText = "Preencha todos os campos!";
        return;
    }

    erroLogin.innerText = "Autenticando...";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, senha: senha })
        });

        const dados = await response.json();

        if (response.ok) {
            usuarioLogado = dados.usuario.login;
            perfilLogado = dados.usuario.perfil;
            const nomeExibicao = dados.usuario.nome;

            // Esconde tela de login
            telaLogin.classList.add('escondido');

            // Redireciona com base no perfil do banco Neon
            if (perfilLogado === 'Barbeiro' || perfilLogado === 'admin') {
                document.getElementById('boas-vistas-barbeiro').innerText = `💈 Olá, Barbeiro ${nomeExibicao}!`;
                telaBarbeiro.classList.remove('escondido');
                // Aqui depois chamaremos a função de carregar o faturamento e o kanban
            } else {
                document.getElementById('boas-vistas-cliente').innerText = `👋 Olá, ${nomeExibicao}!`;
                telaAgendamento.classList.remove('escondido');
                configurarTelaAgendamento();
            }
        } else {
            erroLogin.innerText = dados.detail || "Erro ao fazer login.";
        }
    } catch (error) {
        erroLogin.innerText = "Erro ao conectar com o servidor do Render.";
    }
});

function deslogar() {
    usuarioLogado = null;
    perfilLogado = null;
    telaAgendamento.classList.add('escondido');
    telaBarbeiro.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    inputPass.value = "";
}

// ==========================================
// FUNÇÕES DE AGENDAMENTO (SUA TELA ATUAL)
// ==========================================
const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const containerHorarios = document.getElementById('container-horarios');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

function configurarTelaAgendamento() {
    const hoje = new Date().toISOString().split('T')[0];
    campoData.value = hoje;
    buscarHorarios();
}

campoBarbeiro.addEventListener('change', buscarHorarios);
campoData.addEventListener('change', buscarHorarios);

async function buscarHorarios() {
    const barbeiro = campoBarbeiro.value;
    const data = campoData.value;
    horarioSelecionado = null;
    containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center;'>Buscando vagas...</p>";

    if (!data) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(barbeiro)}&dia=${data}`);
        const dados = await response.json();
        containerHorarios.innerHTML = "";

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Nenhum horário disponível.</p>";
            return;
        }

        dados.horarios_disponiveis.forEach(hora => {
            const botao = document.createElement('button');
            botao.className = 'btn-horario';
            botao.innerText = hora;
            botao.onclick = () => {
                document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                botao.classList.add('selecionado');
                horarioSelecionado = hora;
            };
            containerHorarios.appendChild(botao);
        });
    } catch (error) {
        containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Erro ao carregar horários.</p>";
    }
}

btnConfirmar.addEventListener('click', async () => {
    if (!horarioSelecionado) {
        alert("Por favor, selecione um horário!");
        return;
    }

    const payload = {
        cliente_login: usuarioLogado, // Usa o usuário que fez o login real
        barbeiro_nome: campoBarbeiro.value,
        data: campoData.value,
        horario: horarioSelecionado,
        servico: document.getElementById('servico').value,
        forma_pagamento: document.getElementById('pagamento').value
    };

    msgStatus.style.color = "orange";
    msgStatus.innerText = "Processando agendamento...";

    try {
        const response = await fetch(`${API_URL}/api/agenda/marcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json();

        if (response.ok) {
            msgStatus.style.color = "green";
            msgStatus.innerText = "✨ Agendamento feito com sucesso!";
            buscarHorarios();
        } else {
            msgStatus.style.color = "red";
            msgStatus.innerText = `Erro: ${resultado.detail}`;
        }
    } catch (error) {
        msgStatus.style.color = "red";
        msgStatus.innerText = "Erro ao conectar com o servidor.";
    }
});
