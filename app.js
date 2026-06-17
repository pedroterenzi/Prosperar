const API_URL = "https://prosperar.onrender.com";

let usuarioLogado = null;
let perfilLogado = null;
let horarioSelecionado = null;

// Elementos do DOM
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');
const telaLogin = document.getElementById('tela-login');
const conteudoApp = document.getElementById('conteudo-app');
const menuNavegacao = document.getElementById('menu-navegacao');

// Dados Simulados de Retaguarda Corporativa (Métricas ERP que alimentarão o layout)
const MOCK_OPERACAO = {
    barbeiros: {
        "gabriel": { agendamentos: 9, faturamento: 385.50 },
        "lucas": { agendamentos: 6, faturamento: 210.00 }
    },
    admin: { faturamento: 14250.00, ticket: 68.50, ocupacao: "74%", noshow: "4.2%" },
    estoque_critico: ["Pomada Matte Premium (Restam 2 un)", "Gola Higiênica (Restam 1 un)"],
    agenda_dia: [
        { id: 1, cliente: "Carlos Andrade", servico: "Corte Simples", hora: "14:00", status: "Agendado", cor: "var(--blue-color)" },
        { id: 2, cliente: "Marcos Lima", servico: "Combo Premium", hora: "15:30", status: "Agendado", cor: "var(--accent-color)" }
    ]
};

// ==========================================
// CONTROLADOR DE ACESSO BI-DIRECIONAL
// ==========================================
btnEntrar.addEventListener('click', async () => {
    const login = inputUser.value.trim().toLowerCase();
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        exibirErro("Insira seu usuário e senha.");
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
            renderizarAmbiente(perfilLogado, nomeExibicao, dados.usuario);
        } else {
            exibirErro(dados.detail || "Usuário/Senha incorretos.");
        }
    } catch (error) {
        exibirErro("Timeout na conexão com o Render. Tente novamente.");
    }
});

function exibirErro(msg) {
    erroLogin.style.color = "red";
    erroLogin.innerText = msg;
}

// ==========================================
// GERENCIADOR DE ABAS E ROLES (SEGURANÇA ACESSO)
// ==========================================
function montarMenuNavegacao(role) {
    menuNavegacao.innerHTML = "";
    
    const rotas = {
        cliente: [
            { id: 'home', label: 'Agendar', svg: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' },
            { id: 'estilo', label: 'Meu Estilo', svg: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
            { id: 'fidelidade', label: 'Fidelidade', svg: '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' }
        ],
        barbeiro: [
            { id: 'barbeiro', label: 'Minha Cadeira', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ],
        admin: [
            { id: 'admin', label: 'Métricas ERP', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"/></svg>' },
            { id: 'barbeiro', label: 'Ver Agenda', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ]
    };

    const abasDisponiveis = rotas[role] || rotas['cliente'];
    
    abasDisponiveis.forEach(aba => {
        const botao = document.createElement('button');
        botao.className = 'nav-item';
        botao.innerHTML = `${aba.svg} ${aba.label}`;
        botao.onclick = () => alternarAbasSistema(aba.id, botao);
        menuNavegacao.appendChild(botao);
    });

    // Adiciona Botão de Saída Universal
    const btnSair = document.createElement('button');
    btnSair.className = 'nav-item';
    btnSair.style.color = "var(--danger-color)";
    btnSair.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg> Sair`;
    btnSair.onclick = encerrarSessaoApp;
    menuNavegacao.appendChild(btnSair);
}

function alternarAbasSistema(idAba, elementoBotao) {
    ['home', 'estilo', 'fidelidade', 'barbeiro', 'admin'].forEach(a => {
        const el = document.getElementById(`aba-${a}`);
        if(el) el.classList.add('escondido');
    });
    
    document.getElementById(`aba-${idAba}`).classList.remove('escondido');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
    if(elementoBotao) elementoBotao.classList.add('ativo');
}

// ==========================================
// RENDERIZADOR DE TELAS E DADOS OPERACIONAIS
// ==========================================
function renderizarAmbiente(role, nome, objetoUsuario) {
    if (role === 'barbeiro' || role === 'admin') {
        alternarAbasSistema('barbeiro', document.querySelectorAll('.nav-item')[0]);
        
        // Injeta Métricas do Barbeiro Logado (Gabriel ou Lucas)
        const dadosProfissional = MOCK_OPERACAO.barbeiros[usuarioLogado] || { agendamentos: 4, faturamento: 120 };
        document.getElementById('txt-welcome-barbeiro').innerText = `💈 Estação de Trabalho: ${nome}`;
        document.getElementById('b-meta-agendamentos').innerText = dadosProfissional.agendamentos;
        document.getElementById('b-meta-faturamento').innerText = `R$ ${dadosProfissional.faturamento.toFixed(2)}`;
        
        carregarKanbanCadeira();

        if(role === 'admin') {
            document.getElementById('adm-faturamento').innerText = `R$ ${MOCK_OPERACAO.admin.faturamento.toFixed(2)}`;
            document.getElementById('adm-ticket').innerText = `R$ ${MOCK_OPERACAO.admin.ticket.toFixed(2)}`;
            document.getElementById('adm-ocupacao').innerText = MOCK_OPERACAO.admin.ocupacao;
            document.getElementById('adm-noshow').innerText = MOCK_OPERACAO.admin.noshow;
            
            const estContainer = document.getElementById('estoque-alerta-container');
            estContainer.innerHTML = MOCK_OPERACAO.estoque_critico.map(i => `<p style="margin:5px 0; color:#ffaa00;">⚠️ ${i}</p>`).join('');
        }
    } else {
        alternarAbasSistema('home', document.querySelectorAll('.nav-item')[0]);
        document.getElementById('boas-vistas-cliente').innerText = `👋 Olá, ${nome}!`;
        
        // Prontuário e Fidelidade Inteligentes
        document.getElementById('txt-prontuario').innerText = objetoUsuario.anotacao_tecnica || "Corte padrão degradê navalhado. Cuidado com redemoinho no topo.";
        document.getElementById('txt-pontos').innerText = objetoUsuario.pontos_fidelidade || 0;
        const perc = Math.min(((objetoUsuario.pontos_fidelidade || 0) / 20) * 100, 100);
        document.getElementById('progresso-fidelidade').style.width = `${perc}%`;

        inicializarAgendamentoCliente();
    }
}

// ==========================================
// INTERFACES INTERNAS E INTERAÇÕES (KANBAN)
// ==========================================
function carregarKanbanCadeira() {
    const container = document.getElementById('kanban-agenda-barbeiro');
    container.innerHTML = "";

    MOCK_OPERACAO.agenda_dia.forEach(reserva => {
        const item = document.createElement('div');
        item.className = 'kanban-item';
        item.style.borderLeft = `4px solid ${reserva.cor}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:between; font-weight:bold;">
                <div style="flex:1;">${reserva.hora} - ${reserva.cliente}</div>
                <div style="color:var(--accent-color); font-size:12px;">${reserva.status}</div>
            </div>
            <div class="kanban-meta">${reserva.servico}</div>
            <div class="kanban-actions" id="actions-${reserva.id}">
                <button class="btn-kb checkin" onclick="atualizarStatusServico(${reserva.id}, 'Na Cadeira')">Check-in</button>
                <button class="btn-kb done" onclick="atualizarStatusServico(${reserva.id}, 'Finalizado')">Concluir</button>
                <button class="btn-kb noshow" onclick="atualizarStatusServico(${reserva.id}, 'No-Show')">Falta</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function atualizarStatusServico(id, novoStatus) {
    alert(`Status do agendamento alterado para: ${novoStatus}. Caixa de balcão atualizado via Split.`);
    const ações = document.getElementById(`actions-${id}`);
    if(ações) ações.innerHTML = `<p style="color:var(--text-muted); font-size:13px; margin:5px 0;">Procedimento marcado como: <b>${novoStatus}</b></p>`;
}

// ==========================================
// AGENDA DO CLIENTE (DO ARQUIVO ANTERIOR)
// ==========================================
function inicializarAgendamentoCliente() {
    const hoje = new Date().toISOString().split('T')[0];
    campoData.value = hoje;
    buscarHorariosDisponiveis();
}

campoBarbeiro.addEventListener('change', buscarHorariosDisponiveis);
campoData.addEventListener('change', buscarHorariosDisponiveis);

async function buscarHorariosDisponiveis() {
    const b = campoBarbeiro.value; const d = campoData.value;
    horarioSelecionado = null;
    containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; font-size:12px; color:#555;'>Consultando Neon...</p>";
    if (!d) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(b)}&dia=${d}`);
        const dados = await response.json();
        containerHorarios.innerHTML = "";

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; color:red; font-size:12px;'>Lotado.</p>";
            return;
        }

        dados.horarios_disponiveis.forEach(h => {
            const btn = document.createElement('button');
            btn.className = 'btn-horario'; btn.innerText = h;
            btn.onclick = () => {
                document.querySelectorAll('.btn-horario').forEach(x => x.classList.remove('selecionado'));
                btn.classList.add('selecionado');
                horarioSelecionado = h;
            };
            containerHorarios.appendChild(btn);
        });
    } catch {
        containerHorarios.innerHTML = "<p style='grid-column:span 4; text-align:center; color:red;'>Falha ao listar.</p>";
    }
}

btnConfirmar.addEventListener('click', async () => {
    if(!horarioSelecionado) { alert('Escolha um horário!'); return; }
    msgStatus.style.color = "orange"; msgStatus.innerText = "Reservando cadeira...";
    
    try {
        const response = await fetch(`${API_URL}/api/agenda/marcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_login: usuarioLogado, barbeiro_nome: campoBarbeiro.value,
                data: campoData.value, horario: horarioSelecionado,
                servico: document.getElementById('servico').value, forma_pagamento: document.getElementById('pagamento').value
            })
        });

        if(response.ok) {
            msgStatus.style.color = "var(--success-color)";
            msgStatus.innerText = "✨ Agendamento Confirmado!";
            buscarHorariosDisponiveis();
        } else {
            msgStatus.style.color = "red"; msgStatus.innerText = "Horário indisponível.";
        }
    } catch {
        msgStatus.style.color = "red"; msgStatus.innerText = "Erro interno.";
    }
});

function encerrarSessaoApp() {
    usuarioLogado = null; perfilLogado = null;
    conteudoApp.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    inputUser.value = ""; inputPass.value = ""; erroLogin.innerText = "";
}
