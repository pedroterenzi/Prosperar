const API_URL = "https://prosperar.onrender.com"; 

let usuarioLogado = null;
let perfilLogado = null;
let horarioSelecionado = null;

// Elementos Globais de Login
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');

const telaLogin = document.getElementById('tela-login');
const conteudoApp = document.getElementById('conteudo-app');
const menuNavegacao = document.getElementById('menu-navegacao');

// Elementos de Agendamento
const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const containerHorarios = document.getElementById('container-horarios');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

// ==========================================
// 1. SISTEMA DE AUTENTICAÇÃO E ONBOARDING
// ==========================================
btnEntrar.addEventListener('click', async () => {
    const login = inputUser.value.trim().toLowerCase();
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        erroLogin.style.color = "red";
        erroLogin.innerText = "Insira o usuário e a senha!";
        return;
    }

    erroLogin.style.color = "orange";
    erroLogin.innerText = "Entrando no clube...";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, senha: senha })
        });

        const dados = await response.json();

        if (response.ok) {
            usuarioLogado = dados.usuario.login;
            perfilLogado = dados.usuario.perfil.toLowerCase();
            const nomeExibicao = dados.usuario.nome;

            erroLogin.innerText = "";
            telaLogin.classList.add('escondido');
            conteudoApp.classList.remove('escondido');

            // Direcionamento dinâmico baseado no perfil do banco Neon
            if (perfilLogado === 'barbeiro' || perfilLogado === 'admin') {
                mudarAba('painel-barbeiro');
                menuNavegacao.classList.add('escondido'); // Barbeiro não precisa do menu do cliente
            } else {
                menuNavegacao.classList.remove('escondido');
                mudarAba('home');
                aplicarOnboardingPersonalizado(nomeExibicao);
                // Busca pontos do usuário ou usa padrão inicial
                const pontos = dados.usuario.pontos_fidelidade || 14; 
                atualizarPontosFidelidade(pontos);
                configurarTelaAgendamento();
            }
        } else {
            erroLogin.style.color = "red";
            erroLogin.innerText = dados.detail || "Credenciais incorretas.";
        }
    } catch (error) {
        erroLogin.style.color = "red";
        erroLogin.innerText = "Erro ao conectar com a API do Render.";
    }
});

function aplicarOnboardingPersonalizado(nome) {
    const horaAtual = new Date().getHours();
    let cumprimento = "Boa noite";
    
    if (horaAtual >= 5 && horaAtual < 12) cumprimento = "Bom dia";
    else if (horaAtual >= 12 && horaAtual < 18) cumprimento = "Boa tarde";

    document.getElementById('boas-vindas-cliente').innerText = `${cumprimento}, ${nome}!`;
    
    // Frases contextuais geradas na hora
    const frases = [
        "Bora dar um tapa de respeito no visual?",
        "Seu estilo diz tudo sobre você. Vamos alinhar?",
        "Hora de atualizar a sua melhor versão.",
        "Cadeira reservada é cadeira de patrão. Agende hoje!"
    ];
    const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
    document.getElementById('frase-onboarding').innerText = fraseAleatoria;
}

function atualizarPontosFidelidade(pontos) {
    document.getElementById('txt-pontos').innerText = pontos;
    // Define a barra de progresso em relação a uma meta de 20 pontos
    const preenchimento = Math.min((pontos / 20) * 100, 100);
    document.getElementById('progresso-fidelidade').style.width = `${preenchimento}%`;
}

// ==========================================
// 2. ALTERNADOR DE ABAS (SPA STYLE)
// ==========================================
function mudarAba(nomeAba) {
    // Oculta todas as seções
    document.getElementById('aba-home').classList.add('escondido');
    document.getElementById('aba-estilo').classList.add('escondido');
    document.getElementById('aba-fidelidade').classList.add('escondido');
    document.getElementById('aba-painel-barbeiro').classList.add('escondido');

    // Mostra a seção desejada
    document.getElementById(`aba-${nomeAba}`).classList.remove('escondido');

    // Atualiza o estado visual do menu inferior
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('ativo'));
    
    // Associa o botão correto ao estado ativo
    const indices = { 'home': 0, 'estilo': 1, 'fidelidade': 2 };
    if (nomeAba in indices) {
        document.querySelectorAll('.nav-item')[indices[nomeAba]].classList.add('ativo');
    }
}

function deslogar() {
    usuarioLogado = null;
    perfilLogado = null;
    horarioSelecionado = null;
    conteudoApp.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    inputUser.value = "";
    inputPass.value = "";
    erroLogin.innerText = "";
}

// ==========================================
// 3. GRADE DE AGENDAMENTO INTELIGENTE
// ==========================================
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
    containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; font-size:14px; color:#666;'>Verificando agenda...</p>";

    if (!data) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(barbeiro)}&dia=${data}`);
        const dados = await response.json();
        containerHorarios.innerHTML = "";

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red; font-size:14px;'>Nenhum horário livre.</p>";
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
        containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Erro nas vagas.</p>";
    }
}

btnConfirmar.addEventListener('click', async () => {
    if (!horarioSelecionado) {
        alert("Selecione um horário na grade!");
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
    msgStatus.innerText = "Validando poltrona...";

    try {
        const response = await fetch(`${API_URL}/api/agenda/marcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json();

        if (response.ok) {
            msgStatus.style.color = "var(--success-color)";
            msgStatus.innerText = "✨ Agendamento feito com sucesso!";
            buscarHorarios();
            // Simula o ganho de pontos na hora
            let pontosAtuais = parseInt(document.getElementById('txt-pontos').innerText) || 0;
            pontosAtuais += payload.forma_pagamento === 'Pix' ? 2 : 1;
            atualizarPontosFidelidade(pontosAtuais);
        } else {
            msgStatus.style.color = "red";
            msgStatus.innerText = `Erro: ${resultado.detail}`;
        }
    } catch (error) {
        msgStatus.style.color = "red";
        msgStatus.innerText = "Erro ao processar agendamento.";
    }
});
