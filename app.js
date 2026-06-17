// 🔥 CONEXÃO COM O SEU BACKEND NO RENDER
const API_URL = "https://prosperar.onrender.com"; 

// Variáveis de controle de estado do usuário
let usuarioLogado = null;
let perfilLogado = null;
let horarioSelecionado = null;

// Captura de Elementos da Tela de Login
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');

// Captura de Elementos de Navegação de Telas
const telaLogin = document.getElementById('tela-login');
const telaAgendamento = document.getElementById('tela-agendamento');
const telaBarbeiro = document.getElementById('tela-barbeiro');

// Captura de Elementos da Tela de Agendamento
const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const containerHorarios = document.getElementById('container-horarios');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

// ========================================================
// 🔐 SISTEMA DE AUTENTICAÇÃO E REDIRECIONAMENTO DE TELAS
// ========================================================

btnEntrar.addEventListener('click', async () => {
    // .toLowerCase() impede erros se o cliente digitar "Gabriel" ou "GABRIEL"
    const login = inputUser.value.trim().toLowerCase(); 
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        erroLogin.style.color = "red";
        erroLogin.innerText = "Por favor, preencha todos os campos!";
        return;
    }

    erroLogin.style.color = "orange";
    erroLogin.innerText = "Autenticando no sistema...";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, senha: senha })
        });

        const dados = await response.json();

        if (response.ok) {
            usuarioLogado = dados.usuario.login;
            // Força o perfil para minúsculo para bater certinho com o banco Neon ('barbeiro' / 'admin')
            perfilLogado = dados.usuario.perfil.toLowerCase(); 
            const nomeExibicao = dados.usuario.nome;

            // Limpa rastros de login e esconde o formulário
            erroLogin.innerText = "";
            telaLogin.classList.add('escondido');

            // Verifica o nível de acesso e joga para a tela correta
            if (perfilLogado === 'barbeiro' || perfilLogado === 'admin') {
                document.getElementById('boas-vistas-barbeiro').innerText = `💈 Olá, Barbeiro ${nomeExibicao}!`;
                telaBarbeiro.classList.remove('escondido');
                // (O painel financeiro e o Kanban serão acoplados aqui no próximo passo)
            } else {
                document.getElementById('boas-vistas-cliente').innerText = `👋 Olá, ${nomeExibicao}!`;
                telaAgendamento.classList.remove('escondido');
                configurarTelaAgendamento();
            }
        } else {
            erroLogin.style.color = "red";
            erroLogin.innerText = dados.detail || "Usuário ou senha incorretos.";
        }
    } catch (error) {
        erroLogin.style.color = "red";
        erroLogin.innerText = "Erro ao conectar com o servidor do Render. Verifique o backend.";
    }
});

// Reseta o estado do app ao clicar em Sair
function deslogar() {
    usuarioLogado = null;
    perfilLogado = null;
    horarioSelecionado = null;
    
    telaAgendamento.classList.add('escondido');
    telaBarbeiro.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    
    inputUser.value = "";
    inputPass.value = "";
    erroLogin.innerText = "";
    if (msgStatus) msgStatus.innerText = "";
}

// ========================================================
// 📅 SISTEMA DE AGENDAMENTO (FLUXO DO CLIENTE)
// ========================================================

function configurarTelaAgendamento() {
    // Define o dia de hoje automaticamente no input de data
    const hoje = new Date().toISOString().split('T')[0];
    campoData.value = hoje;
    buscarHorarios();
}

// Fica de olho se o cliente mudar de profissional ou de dia para atualizar as vagas
campoBarbeiro.addEventListener('change', buscarHorarios);
campoData.addEventListener('change', buscarHorarios);

async function buscarHorarios() {
    const barbeiro = campoBarbeiro.value;
    const data = campoData.value;
    horarioSelecionado = null;
    containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center;'>Buscando vagas livres...</p>";

    if (!data) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(barbeiro)}&dia=${data}`);
        const dados = await response.json();
        containerHorarios.innerHTML = ""; // Remove o texto de carregamento

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Nenhum horário disponível para este dia.</p>";
            return;
        }

        // Renderiza cada horário livre como um botão bonito na grade
        dados.horarios_disponiveis.forEach(hora => {
            const botao = document.createElement('button');
            botao.className = 'btn-horario';
            botao.innerText = hora;
            botao.onclick = () => {
                // Desmarca o botão selecionado anteriormente
                document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                // Destaca o botão atual
                botao.classList.add('selecionado');
                horarioSelecionado = hora;
            };
            containerHorarios.appendChild(botao);
        });
    } catch (error) {
        containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Erro ao carregar horários.</p>";
    }
}

// Envia a marcação de agendamento para salvar no Banco Neon
btnConfirmar.addEventListener('click', async () => {
    if (!horarioSelecionado) {
        alert("Por favor, clique em um dos horários disponíveis antes de confirmar!");
        return;
    }

    const payload = {
        cliente_login: usuarioLogado, 
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
            buscarHorarios(); // Recarrega os botões para sumir o horário reservado
        } else {
            msgStatus.style.color = "red";
            msgStatus.innerText = `Erro: ${resultado.detail}`;
        }
    } catch (error) {
        msgStatus.style.color = "red";
        msgStatus.innerText = "Erro ao conectar com o servidor.";
    }
});
