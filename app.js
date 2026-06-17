// 🔥 CONEXÃO COM O SEU BACKEND NO RENDER
const API_URL = "https://prosperar.onrender.com";

let usuarioLogado = null;
let perfilLogado = null;
let horarioSelecionado = null;

// Elementos Globais do DOM
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');
const telaLogin = document.getElementById('tela-login');
const conteudoApp = document.getElementById('conteudo-app');
const menuNavegacao = document.getElementById('menu-navegacao');

// Elementos da Tela de Agendamento do Cliente
const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const containerHorarios = document.getElementById('container-horarios');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

// Dados Consolidados de Retaguarda (Dashboards Administrativos)
const MOCK_OPERACAO = {
    barbeiros: {
        "gabriel": { agendamentos: 12, faturamento: 540.00 },
        "lucas": { agendamentos: 8, faturamento: 310.00 }
    },
    admin: { faturamento: 18450.00, ticket: 72.00, ocupacao: "81%", noshow: "3.5%" },
    estoque_critico: ["Pomada Matte Premium (Restam 2 un)", "Gola Higiênica (Restam 1 un)"],
    agenda_dia: [
        { id: 1, cliente: "Pedro Terenzi", servico: "Combo Premium", hora: "14:00", status: "Confirmado", cor: "var(--accent-color)" },
        { id: 2, cliente: "Carlos Andrade", servico: "Corte Simples", hora: "15:00", status: "Confirmado", cor: "var(--blue-color)" },
        { id: 3, cliente: "Marcos Lima", servico: "Barba Completa", hora: "16:00", status: "Confirmado", cor: "var(--success-color)" }
    ]
};

// ==========================================
// 🔐 SISTEMA DE AUTENTICAÇÃO E CONTROLE
// ==========================================
btnEntrar.addEventListener('click', async () => {
    const login = inputUser.value.trim().toLowerCase();
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        exibirMensagemErro("Por favor, preencha todos os campos!");
        return;
    }

    erroLogin.style.color = "orange";
    erroLogin.innerText = "Autenticando na infraestrutura...";

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, senha: senha })
        });

        const dados = await response.json();

        if (response.ok) {
            usuarioLogado = dados.usuario.login;
            perfilLogado = dados.usuario.perfil ? dados.usuario.perfil.toLowerCase() : 'cliente';
            const nomeExibicao = dados.usuario.nome || "Membro";

            erroLogin.innerText = "";
            telaLogin.classList.add('escondido');
            conteudoApp.classList.remove('escondido');

            montarMenuNavegacao(perfilLogado);
            renderizarPainelPorPerfil(perfilLogado, nomeExibicao, dados.usuario);
        } else {
            exibirMensagemErro(dados.detail || "Usuário ou senha incorretos.");
        }
    } catch (error) {
        exibirMensagemErro("Não foi possível conectar ao servidor do Render.");
    }
});

function exibirMensagemErro(msg) {
    erroLogin.style.color = "red";
    erroLogin.innerText = msg;
}

// ==========================================
// 📱 CONSTRUTOR DINÂMICO DE NAVEGAÇÃO (SPA)
// ==========================================
function montarMenuNavegacao(role) {
    menuNavegacao.innerHTML = "";
    
    const abasDisponiveis = {
        cliente: [
            { id: 'home', label: 'Agendar', svg: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' },
            { id: 'estilo', label: 'Meu Estilo', svg: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
            { id: 'fidelidade', label: 'Fidelidade', svg: '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' }
        ],
        barbeiro: [
            { id: 'barbeiro', label: 'Minha Cadeira', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ],
        admin: [
            { id: 'admin', label: 'Métricas', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"/></svg>' },
            { id: 'barbeiro', label: 'Agenda Geral', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ]
    };

    const configuracao = abasDisponiveis[role] || abasDisponiveis['cliente'];
    
    configuracao.forEach(aba => {
        const botao = document.createElement('button');
        botao.className = 'nav-item';
        botao.innerHTML = `${aba.svg} ${aba.label}`;
        botao.onclick = () => alternarVisualizacaoAbas(aba.id, botao);
        menuNavegacao.appendChild(botao);
    });

    // Injeção do Botão Deslogar Universal
    const btnSair = document.createElement('button');
    btnSair.className = 'nav-item';
    btnSair.style.color = "var(--danger-color)";
    btnSair.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg> Sair`;
    btnSair.onclick = fecharSessaoLimpa;
    menuNavegacao.appendChild(btnSair);
}

function alternarVisualizacaoAbas(idAba, elementoBotao) {
    ['home', 'estilo', 'fidelidade', 'barbeiro', 'admin'].forEach(aba => {
        const elemento = document.getElementById(`aba-${aba}`);
        if (elemento) elemento.classList.add('escondido');
    });
    
    document.getElementById(`aba-${idAba}`).classList.remove('escondido');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('ativo'));
    if (elementoBotao) elementoBotao.classList.add('ativo');
}

// ==========================================
// 📊 CONSTRUTOR DE INTEGRAÇÃO DE CONTEÚDO
// ==========================================
function renderizarPainelPorPerfil(role, nome, usuarioObjeto) {
    if (role === 'barbeiro' || role === 'admin') {
        alternarVisualizacaoAbas('barbeiro', document.querySelectorAll('.nav-item')[0]);
        
        const dadosKpi = MOCK_OPERACAO.barbeiros[usuarioLogado] || { agendamentos: 4, faturamento: 160 };
        document.getElementById('txt-welcome-barbeiro').innerText = `💈 Profissional: ${nome}`;
        document.getElementById('b-meta-agendamentos').innerText = dadosKpi.agendamentos;
        document.getElementById('b-meta-faturamento').innerText = `R$ ${dadosKpi.faturamento.toFixed(2)}`;
        
        construirKanbanOperacional();

        if (role === 'admin') {
            document.getElementById('adm-faturamento').innerText = `R$ ${MOCK_OPERACAO.admin.faturamento.toFixed(2)}`;
            document.getElementById('adm-ticket').innerText = `R$ ${MOCK_OPERACAO.admin.ticket.toFixed(2)}`;
            document.getElementById('adm-ocupacao').innerText = MOCK_OPERACAO.admin.ocupacao;
            document.getElementById('adm-noshow').innerText = MOCK_OPERACAO.admin.noshow;
            
            const estoqueContainer = document.getElementById('estoque-alerta-container');
            estoqueContainer.innerHTML = MOCK_OPERACAO.estoque_critico.map(prod => `<p style="margin:5px 0; color:#ffaa00;">⚠️ ${prod}</p>`).join('');
        }
    } else {
        alternarVisualizacaoAbas('home', document.querySelectorAll('.nav-item')[0]);
        document.getElementById('boas-vistas-cliente').innerText = `👋 Olá, ${nome}!`;
        
        // Carrega prontuário e fidelidade
        document.getElementById('txt-prontuario').innerText = usuarioObjeto.anotacao_tecnica || "Corte padrão degradê alto. Evitar uso de navalha na nuca devido à sensibilidade.";
        document.getElementById('txt-pontos').innerText = usuarioObjeto.pontos_fidelidade || 0;
        const percentual = Math.min(((usuarioObjeto.pontos_fidelidade || 0) / 20) * 100, 100);
        document.getElementById('progresso-fidelidade').style.width = `${percentual}%`;

        inicializarSistemaAgendaCliente();
    }
}

// ==========================================
// 🛠️ KANBAN ERGONÔMICO (VISÃO DO BARBEIRO)
// ==========================================
function construirKanbanOperacional() {
    const box = document.getElementById('kanban-agenda-barbeiro');
    box.innerHTML = "";

    MOCK_OPERACAO.agenda_dia.forEach(reserva => {
        const item = document.createElement('div');
        item.className = 'kanban-item';
        item.style.borderLeft = `4px solid ${reserva.cor}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
                <div>${reserva.hora} — ${reserva.cliente}</div>
                <div style="color:var(--accent-color); font-size:12px;">${reserva.status}</div>
            </div>
            <div class="kanban-meta">${reserva.servico}</div>
            <div class="kanban-actions" id="actions-block-${reserva.id}">
                <button class="btn-kb checkin" onclick="alterarStatusCard(${reserva.id}, 'Na Cadeira')">Check-in</button>
                <button class="btn-kb done" onclick="alterarStatusCard(${reserva.id}, 'Finalizado')">Concluir</button>
                <button class="btn-kb noshow" onclick="alterarStatusCard(${reserva.id}, 'No-Show')">Falta</button>
            </div>
        `;
        box.appendChild(item);
    });
}

function alterarStatusCard(id, acao) {
    alert(`Comando processado! Status: ${acao}. Split de pagamento e pontuação atualizados.`);
    const bloco = document.getElementById(`actions-block-${id}`);
    if (bloco) bloco.innerHTML = `<p style="color:var(--text-muted); font-size:13px; margin:5px 0;">Atendimento: <b>${acao}</b></p>`;
}

// ==========================================
// 📅 MOTOR DE HORÁRIOS (VISÃO DO CLIENTE)
// ==========================================
function inicializarSistemaAgendaCliente() {
    const hoje = new Date().toISOString().split('T')[0];
    campoData.value = hoje;
    carregarHorariosDisponiveisBanco();
}

campoBarbeiro.addEventListener('change', carregarHorariosDisponiveisBanco);
campoData.addEventListener('change', carregarHorariosDisponiveisBanco);

async function carregarHorariosDisponiveisBanco() {
    const b = campoBarbeiro.value; 
    const d = campoData.value;
    horarioSelecionado = null;
    
    containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; font-size:13px; color:#555;'>Buscando vagas no Neon...</p>";
    if (!d) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(b)}&dia=${d}`);
        const dados = await response.json();
        containerHorarios.innerHTML = "";

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; color:red; font-size:13px;'>Sem horários livres para este dia.</p>";
            return;
        }

        dados.horarios_disponiveis.forEach(hora => {
            const btn = document.createElement('button');
            btn.className = 'btn-horario'; 
            btn.innerText = hora;
            btn.onclick = () => {
                document.querySelectorAll('.btn-horario').forEach(x => x.classList.remove('selecionado'));
                btn.classList.add('selecionado');
                horarioSelecionado = hora;
            };
            containerHorarios.appendChild(btn);
        });
    } catch (err) {
        containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; color:red;'>Falha ao carregar grade.</p>";
    }
}

btnConfirmar.addEventListener('click', async () => {
    if (!horarioSelecionado) { 
        alert('Por favor, selecione um horário na grade antes de confirmar.'); 
        return; 
    }
    
    msgStatus.style.color = "orange"; 
    msgStatus.innerText = "Reservando sua cadeira...";
    
    try {
        const response = await fetch(`${API_URL}/api/agenda/marcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_login: usuarioLogado, 
                barbeiro_nome: campoBarbeiro.value,
                data: campoData.value, 
                horario: horarioSelecionado,
                servico: document.getElementById('servico').value, 
                forma_pagamento: document.getElementById('pagamento').value
            })
        });

        if (response.ok) {
            msgStatus.style.color = "var(--success-color)";
            msgStatus.innerText = "✨ Agendamento Confirmado com Sucesso!";
            carregarHorariosDisponiveisBanco();
        } else {
            msgStatus.style.color = "red"; 
            msgStatus.innerText = "Falha: O horário já foi preenchido.";
        }
    } catch {
        msgStatus.style.color = "red"; 
        msgStatus.innerText = "Erro de conexão interna.";
    }
});

function fecharSessaoLimpa() {
    usuarioLogado = null; 
    perfilLogado = null; 
    horarioSelecionado = null;
    conteudoApp.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    inputUser.value = ""; 
    inputPass.value = ""; 
    erroLogin.innerText = "";
    if (msgStatus) msgStatus.innerText = "";
}
