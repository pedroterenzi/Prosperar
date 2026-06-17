const API_URL = "https://prosperar.onrender.com";

// Estado de memória reativo sincronizado da aplicação
let usuarioLogado = null;
let perfilLogado = null;

// Estados selecionados do formulário moderno do cliente
let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;

// Elementos Globais de Captura do DOM
const btnEntrar = document.getElementById('btn-entrar');
const inputUser = document.getElementById('login-usuario');
const inputPass = document.getElementById('login-senha');
const erroLogin = document.getElementById('erro-login');
const telaLogin = document.getElementById('tela-login');
const conteudoApp = document.getElementById('conteudo-app');
const menuNavegacao = document.getElementById('menu-navegacao');

const campoData = document.getElementById('data');
const wrapperTurnos = document.getElementById('wrapper-turnos-grade');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

// Tabelas de configurações estéticas e dados padrão estruturados
const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00, sub: "Duração: 30 min" },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00, sub: "Duração: 45 min" },
    { id: "barba", nome: "Barba Completa", preco: 35.00, sub: "Duração: 30 min" },
    { id: "combo", nome: "Combo Premium (Corte + Barba + Sobrancelha)", preco: 85.00, sub: "Duração: 60 min" }
];

const ESTRUTURA_BARBEIROS = [
    { id: "gabriel", nome: "Gabriel (Proprietário)", avaliacao: "★ 4.9 (148 avaliações)" },
    { id: "lucas", nome: "Lucas Barber", avaliacao: "★ 4.8 (96 avaliações)" }
];

const ESTRUTURA_PAGAMENTOS = [
    { id: "Pix", nome: "Pix", sub: "Ganha Pontos em Dobro" },
    { id: "Cartão", nome: "Cartão Débito/Crédito", sub: "Processamento via Split automático" },
    { id: "Dinheiro", nome: "Dinheiro Físico", sub: "Fechamento direto no balcão" }
];

// Dados Iniciais e Controle de Mutação Persistente por LocalStorage
const HORARIOS_PADRAO = [
    { turno: "☀️ Turno da Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Turno da Tarde", horas: ["12:00", "12:30", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Turno da Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

const MOCK_OPERACAO_DEFAULT = {
    barbeiros: {
        "gabriel": { agendamentos: 9, faturamento: 385.50 },
        "lucas": { agendamentos: 6, faturamento: 210.00 }
    },
    admin: { faturamento: 18450.00, ticket: 72.00, ocupacao: "81%", noshow: "3.5%" },
    estoque_critico: ["Pomada Matte Premium (Restam 2 un)", "Gola Higiênica (Restam 1 un)"],
    agenda_dia: [
        { id: 1, cliente: "Carlos Andrade", servico: "Corte Simples", hora: "14:00", status: "Agendado", cor: "var(--blue-color)", barbeiro: "gabriel" },
        { id: 2, cliente: "Marcos Lima", servico: "Combo Premium", hora: "15:30", status: "Agendado", cor: "var(--accent-color)", barbeiro: "gabriel" },
        { id: 3, cliente: "Lucas Souza", servico: "Barba Completa", hora: "11:00", status: "Agendado", cor: "var(--success-color)", barbeiro: "lucas" }
    ]
};

// Inicialização segura do Estado Persistente
if (!localStorage.getItem('PROSPERAR_STATE')) {
    localStorage.setItem('PROSPERAR_STATE', JSON.stringify(MOCK_OPERACAO_DEFAULT));
}

function obterEstadoCorporativo() {
    return JSON.parse(localStorage.getItem('PROSPERAR_STATE'));
}

function salvarEstadoCorporativo(novoEstado) {
    localStorage.setItem('PROSPERAR_STATE', JSON.stringify(novoEstado));
}

// ==========================================
// 🔐 SISTEMA DE AUTENTICAÇÃO E INITIAL DEPLOY
// ==========================================
btnEntrar.addEventListener('click', async () => {
    const login = inputUser.value.trim().toLowerCase();
    const senha = inputPass.value.trim();

    if (!login || !senha) {
        exibirMensagemErro("Por favor, preencha todos os campos!");
        return;
    }

    erroLogin.style.color = "orange";
    erroLogin.innerText = "Autenticando no ecossistema...";

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
            renderizarLayoutPorPerfil(perfilLogado, nomeExibicao, dados.usuario);
        } else {
            exibirMensagemErro(dados.detail || "Usuário ou senha inválidos.");
        }
    } catch (error) {
        exibirMensagemErro("Servidor Render em standby. Tentando carregar ambiente local...");
        // Fallback robusto para desenvolvimento/teste local fluido caso a API falhe
        usuarioLogado = login;
        perfilLogado = (login === 'gabriel' || login === 'lucas') ? 'barbeiro' : (login === 'admin' ? 'admin' : 'cliente');
        telaLogin.classList.add('escondido');
        conteudoApp.classList.remove('escondido');
        montarMenuNavegacao(perfilLogado);
        renderizarLayoutPorPerfil(perfilLogado, login.toUpperCase(), { pontos_fidelidade: 14 });
    }
});

function exibirMensagemErro(msg) {
    erroLogin.style.color = "var(--danger-color)";
    erroLogin.innerText = msg;
}

// ==========================================
// 📱 MOTOR DE NAVEGAÇÃO INTERATIVA (SPA)
// ==========================================
function montarMenuNavegacao(role) {
    menuNavegacao.innerHTML = "";
    
    const esquemas = {
        cliente: [
            { id: 'home', label: 'Agendar', svg: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>' },
            { id: 'estilo', label: 'Meu Estilo', svg: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
            { id: 'fidelidade', label: 'Fidelidade', svg: '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' }
        ],
        barbeiro: [
            { id: 'barbeiro', label: 'Minha Cadeira', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ],
        admin: [
            { id: 'admin', label: 'Métricas ERP', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"/></svg>' },
            { id: 'barbeiro', label: 'Agenda Geral', svg: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>' }
        ]
    };

    const listaBotoes = esquemas[role] || esquemas['cliente'];
    
    listaBotoes.forEach(aba => {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.innerHTML = `${aba.svg} ${aba.label}`;
        btn.onclick = () => alternarAbasEfetivo(aba.id, btn);
        menuNavegacao.appendChild(btn);
    });

    const btnSair = document.createElement('button');
    btnSair.className = 'nav-item';
    btnSair.style.color = "var(--danger-color)";
    btnSair.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59z"/></svg> Sair`;
    btnSair.onclick = acaoLogoutLimpo;
    menuNavegacao.appendChild(btnSair);
}

function alternarAbasEfetivo(idAba, elementoBotao) {
    ['home', 'estilo', 'fidelidade', 'barbeiro', 'admin'].forEach(aba => {
        const painel = document.getElementById(`aba-${aba}`);
        if (painel) painel.classList.add('escondido');
    });
    
    document.getElementById(`aba-${idAba}`).classList.remove('escondido');
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('ativo'));
    if (elementoBotao) elementoBotao.classList.add('ativo');
}

// ==========================================
// 🎨 CONSTRUTOR DE UI DINÂMICA (ANTI-QUADRADO)
// ==========================================
function renderizarLayoutPorPerfil(role, nome, dadosUsuario) {
    const estado = obterEstadoCorporativo();

    if (role === 'barbeiro' || role === 'admin') {
        alternarAbasEfetivo('barbeiro', document.querySelectorAll('.nav-item')[0]);
        document.getElementById('txt-welcome-barbeiro').innerText = `💈 Estação de Trabalho: ${nome}`;
        
        atualizarKpisBarbeiro();
        construirKanbanCadeira();

        if (role === 'admin') {
            document.getElementById('adm-faturamento').innerText = `R$ ${estado.admin.faturamento.toFixed(2)}`;
            document.getElementById('adm-ticket').innerText = `R$ ${estado.admin.ticket.toFixed(2)}`;
            document.getElementById('adm-ocupacao').innerText = estado.admin.ocupacao;
            document.getElementById('adm-noshow').innerText = estado.admin.noshow;
            
            document.getElementById('estoque-alerta-container').innerHTML = estado.estoque_critico.map(i => `<p style="margin:6px 0; color:#f59e0b; font-weight:600;">⚠️ ${i}</p>`).join('');
        }
    } else {
        alternarAbasEfetivo('home', document.querySelectorAll('.nav-item')[0]);
        document.getElementById('boas-vistas-cliente').innerHTML = `Olá, <span class="gold-text">${nome.toLowerCase()}</span>!`;
        
        document.getElementById('txt-prontuario').innerText = dadosUsuario.anotacao_tecnica || "Usa degradê navalhado médio, redemoinho na coroa exige cuidado, não gosta de costeleta pontuda.";
        document.getElementById('txt-pontos').innerText = dadosUsuario.pontos_fidelidade || 0;
        
        const perc = Math.min(((dadosUsuario.pontos_fidelidade || 0) / 20) * 100, 100);
        document.getElementById('progresso-fidelidade').style.width = `${perc}%`;

        construirCardsInterativosFormulario();
    }
}

// Geração de Interface Fluida (Substituindo os selects por stacks de cards)
function construirCardsInterativosFormulario() {
    // 1. Injeção de Serviços Premium
    const containerServicos = document.getElementById('stack-servicos');
    containerServicos.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const card = document.createElement('div');
        card.className = "selectable-card";
        card.innerHTML = `<div><div class="card-title">${s.nome}</div><div class="card-subtitle">${s.sub}</div></div><div class="card-price">R$ ${s.preco.toFixed(2)}</div>`;
        card.onclick = () => {
            document.querySelectorAll('#stack-servicos .selectable-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            servicoSelecionado = s.nome;
        };
        containerServicos.appendChild(card);
    });

    // 2. Injeção de Barbeiros
    const containerBarbeiros = document.getElementById('stack-barbeiros');
    containerBarbeiros.innerHTML = "";
    ESTRUTURA_BARBEIROS.forEach(b => {
        const card = document.createElement('div');
        card.className = "selectable-card";
        card.innerHTML = `<div><div class="card-title">${b.nome}</div><div class="card-subtitle">${b.avaliacao}</div></div>`;
        card.onclick = () => {
            document.querySelectorAll('#stack-barbeiros .selectable-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            barbeiroSelecionado = b.id;
            renderizarGradeHorariosPorTurno(); // Atualiza os horários baseados no profissional selecionado
        };
        containerBarbeiros.appendChild(card);
    });

    // 3. Injeção de Pagamentos
    const containerPagos = document.getElementById('stack-pagamentos');
    containerPagos.innerHTML = "";
    ESTRUTURA_PAGAMENTOS.forEach(p => {
        const card = document.createElement('div');
        card.className = "selectable-card";
        card.innerHTML = `<div><div class="card-title">${p.nome}</div><div class="card-subtitle">${p.sub}</div></div>`;
        card.onclick = () => {
            document.querySelectorAll('#stack-pagamentos .selectable-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            pagamentoSelecionado = p.nome;
        };
        containerPagos.appendChild(card);
    });

    // Data Padrão
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    campoData.value = amanha.toISOString().split('T')[0];
    
    renderizarGradeHorariosPorTurno();
}

// ==========================================
// 📅 SELEÇÃO DE HORÁRIOS ORGANIZADA POR TURNOS
// ==========================================
campoData.addEventListener('change', renderizarGradeHorariosPorTurno);

function renderizarGradeHorariosPorTurno() {
    wrapperTurnos.innerHTML = "";
    horarioSelecionado = null;

    if (!barbeiroSelecionado) {
        wrapperTurnos.innerHTML = "<p style='text-align:center; font-size:13px; color:var(--text-muted); padding:10px 0;'>⚠️ Selecione um profissional para liberar a agenda.</p>";
        return;
    }

    // Filtra horários que já foram ocupados para esse profissional no localStorage
    const estado = obterEstadoCorporativo();
    const dataAlvo = campoData.value;

    HORARIOS_PADRAO.forEach(grupo => {
        const turnoDiv = document.createElement('div');
        turnoDiv.className = "turno-wrapper";
        
        const header = document.createElement('div');
        header.className = "turno-header";
        header.innerText = grupo.turno;
        turnoDiv.appendChild(header);

        const grid = document.createElement('div');
        grid.className = "grid-horarios";

        let possuiHorarioLivre = false;

        grupo.horas.forEach(hora => {
            // Verifica se este horário já foi reservado e está agendado/atendido no localStorage
            const jaReservado = estado.agenda_dia.some(res => res.data === dataAlvo && res.hora === hora && res.barbeiro === barbeiroSelecionado && res.status !== 'Finalizado' && res.status !== 'No-Show');
            
            if (!jaReservado) {
                possuiHorarioLivre = true;
                const btn = document.createElement('button');
                btn.className = "btn-horario";
                btn.innerText = hora;
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado');
                    horarioSelecionado = hora;
                };
                grid.appendChild(btn);
            }
        });

        if (possuiHorarioLivre) {
            turnoDiv.appendChild(grid);
            wrapperTurnos.appendChild(turnoDiv);
        }
    });

    if (wrapperTurnos.innerHTML === "") {
        wrapperTurnos.innerHTML = "<p style='text-align:center; font-size:13px; color:var(--danger-color); padding:10px 0;'>🔒 Agenda completamente lotada para este dia.</p>";
    }
}

// ==========================================
// 🚀 PERSISTÊNCIA INTERATIVA (AGENDAR / CONCLUIR)
// ==========================================
btnConfirmar.addEventListener('click', async () => {
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert('Por favor, selecione todas as etapas visuais do atendimento!');
        return;
    }

    msgStatus.style.color = "orange";
    msgStatus.innerText = "Interligando dados com o servidor corporativo...";

    // Simula envio para a API e persiste de forma real no localStorage
    setTimeout(() => {
        const estado = obterEstadoCorporativo();
        const novoAgendamento = {
            id: Date.now(),
            cliente: usuarioLogado ? usuarioLogado.toUpperCase() : "CLIENTE CLUBE",
            servico: servicoSelecionado,
            hora: horarioSelecionado,
            data: campoData.value,
            status: "Agendado",
            cor: "var(--accent-color)",
            barbeiro: barbeiroSelecionado
        };

        estado.agenda_dia.push(novoAgendamento);
        salvarEstadoCorporativo(estado);

        msgStatus.style.color = "var(--success-color)";
        msgStatus.innerText = "✨ Agendamento feito com sucesso!";
        
        // Limpa a seleção e atualiza a grade de forma reativa
        renderizarGradeHorariosPorTurno();
    }, 800);
});

function construirKanbanCadeira() {
    const box = document.getElementById('kanban-agenda-barbeiro');
    box.innerHTML = "";

    const estado = obterEstadoCorporativo();
    
    // Se o perfil for barbeiro simples, ele vê apenas os cortes dele. Se for admin, vê de todos.
    const filaFiltrada = estado.agenda_dia.filter(res => perfilLogado === 'admin' || res.barbeiro === usuarioLogado);

    if (filaFiltrada.length === 0) {
        box.innerHTML = "<p style='text-align:center; color:var(--text-muted); font-size:14px; padding:20px 0;'>☕ Nenhuma cadeira ocupada ou agendada na sua fila.</p>";
        return;
    }

    filaFiltrada.forEach(reserva => {
        const item = document.createElement('div');
        item.className = 'kanban-item';
        item.style.borderLeft = `4px solid ${reserva.cor || 'var(--accent-color)'}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-weight:700;">
                <div>${reserva.hora} — ${reserva.cliente}</div>
                <div style="color:var(--accent-color); font-size:13px; text-transform:uppercase;">${reserva.status}</div>
            </div>
            <div class="kanban-meta">${reserva.servico}</div>
            <div class="kanban-actions" id="actions-block-${reserva.id}">
                <button class="btn-kb checkin" onclick="mutarStatusCardPersistente(${reserva.id}, 'Na Cadeira')">Check-in</button>
                <button class="btn-kb done" onclick="mutarStatusCardPersistente(${reserva.id}, 'Finalizado')">Concluir</button>
                <button class="btn-kb noshow" onclick="mutarStatusCardPersistente(${reserva.id}, 'No-Show')">Falta</button>
            </div>
        `;
        box.appendChild(item);
    });
}

function mutarStatusCardPersistente(id, novoStatus) {
    const estado = obterEstadoCorporativo();
    const index = estado.agenda_dia.findIndex(res => res.id === id);

    if (index !== -1) {
        if (novoStatus === 'Finalizado' || novoStatus === 'No-Show') {
            // Se o atendimento terminou ou foi falta, removemos da visão ativa da cadeira (persiste a remoção)
            // Em cenários de produção avançados, você mudaria o status e guardaria num histórico de relatórios.
            estado.agenda_dia.splice(index, 1);
            
            // Incrementa o faturamento do profissional de forma dinâmica por produção fictícia
            if (novoStatus === 'Finalizado' && estado.barbeiros[usuarioLogado]) {
                estado.barbeiros[usuarioLogado].faturamento += 25.00; // Incrementa a comissão simulada por corte concluído
            }
        } else {
            // Se for check-in, apenas altera o rótulo visual mantendo o card ativo
            estado.agenda_dia[index].status = novoStatus;
        }

        salvarEstadoCorporativo(estado);
        
        // Atualização da interface reativa imediata
        construirKanbanCadeira();
        atualizarKpisBarbeiro();
    }
}

function atualizarKpisBarbeiro() {
    const estado = obterEstadoCorporativo();
    const dadosKpi = estado.barbeiros[usuarioLogado] || { agendamentos: 0, faturamento: 0 };
    
    const countAgendamentosAtivos = estado.agenda_dia.filter(res => res.barbeiro === usuarioLogado).length;

    document.getElementById('b-meta-agendamentos').innerText = countAgendamentosAtivos;
    document.getElementById('b-meta-faturamento').innerText = `R$ ${dadosKpi.faturamento.toFixed(2)}`;
}

// ==========================================
// 🚪 LIMPEZA DE ESTRUTURA DE SESSÃO (LOGOUT)
// ==========================================
function acaoLogoutLimpo() {
    usuarioLogado = null; 
    perfilLogado = null;
    servicoSelecionado = null; 
    barbeiroSelecionado = null; 
    horarioSelecionado = null; 
    pagamentoSelecionado = null;
    
    conteudoApp.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    inputUser.value = ""; 
    inputPass.value = ""; 
    erroLogin.innerText = "";
    if (msgStatus) msgStatus.innerText = "";
}
