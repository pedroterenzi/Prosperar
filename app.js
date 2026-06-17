const API_URL = "https://prosperar.onrender.com";

// Estado reativo da aplicação
let usuarioLogado = null;
let perfilLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;

// Dados estruturados para os novos cards modernos
const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00, sub: "Duração: 30 min", img: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=150" },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00, sub: "Duração: 45 min", img: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=150" },
    { id: "barba", nome: "Barba Completa", preco: 35.00, sub: "Duração: 30 min", img: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=150" },
    { id: "combo", nome: "Combo Premium", preco: 85.00, sub: "Corte + Barba + Sobrancelha", img: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=150" }
];

const ESTRUTURA_BARBEIROS = [
    { id: "gabriel", nome: "Gabriel (Proprietário)", avaliacao: "★ 4.9 (148 avaliações)" },
    { id: "lucas", nome: "Lucas Barber", avaliacao: "★ 4.8 (96 avaliações)" }
];

const ESTRUTURA_PAGAMENTOS = [
    { id: "pix", nome: "Pix", sub: "Ganha Pontos em Dobro" },
    { id: "cartao", nome: "Cartão", sub: "Crédito ou Débito" }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Turno da Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Turno da Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Turno da Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

// Banco de dados persistente no navegador do usuário
const MOCK_INICIAL = {
    barbeiros: {
        "gabriel": { agendamentos: 9, faturamento: 385.50 },
        "lucas": { agendamentos: 6, faturamento: 210.00 }
    },
    agenda_dia: [
        { id: 1, cliente: "Carlos Andrade", servico: "Corte Simples", hora: "14:00", status: "Agendado", barbeiro: "gabriel" },
        { id: 2, cliente: "Marcos Lima", servico: "Combo Premium", hora: "15:30", status: "Agendado", barbeiro: "gabriel" }
    ]
};

if (!localStorage.getItem('PROSPERAR_STATE')) {
    localStorage.setItem('PROSPERAR_STATE', JSON.stringify(MOCK_INICIAL));
}

function obterEstado() { return JSON.parse(localStorage.getItem('PROSPERAR_STATE')); }
function salvarEstado(estado) { localStorage.setItem('PROSPERAR_STATE', JSON.stringify(estado)); }

// ==========================================
// CONTROLADOR DE LOGIN
// ==========================================
document.getElementById('btn-entrar').addEventListener('click', async () => {
    const login = document.getElementById('login-usuario').value.trim().toLowerCase();
    const senha = document.getElementById('login-senha').value.trim();

    if (!login) return alert("Digite o usuário!");

    // Fallback imediato para testes e uso fluido no Front-end
    usuarioLogado = login;
    perfilLogado = (login === 'gabriel' || login === 'lucas') ? 'barbeiro' : 'cliente';

    document.getElementById('tela-login').classList.add('escondido');
    document.getElementById('conteudo-app').classList.remove('escondido');

    montarMenuNavegacao(perfilLogado);
    inicializarFluxoPainel();
});

// ==========================================
// CONSTRUTOR DO FORMULÁRIO DE CARDS DO CLIENTE
// ==========================================
function renderizarFormularioCliente() {
    // 1. Renderizar Serviços [Padrão Streamlit]
    const boxServicos = document.getElementById('container-servicos');
    boxServicos.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const div = document.createElement('div');
        div.className = "modern-card";
        div.style.backgroundImage = `linear-gradient(rgba(26,27,30,0.9), rgba(26,27,30,0.95)), url('${s.img}')`;
        div.innerHTML = `<div class="info-block"><div class="title">${s.nome}</div><div class="subtitle">${s.sub}</div></div><div class="price">R$ ${s.preco.toFixed(2)}</div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-servicos .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            servicoSelecionado = s.nome;
        };
        boxServicos.appendChild(div);
    });

    // 2. Renderizar Barbeiros
    const boxBarbeiros = document.getElementById('container-barbeiros');
    boxBarbeiros.innerHTML = "";
    ESTRUTURA_BARBEIROS.forEach(b => {
        const div = document.createElement('div');
        div.className = "modern-card";
        div.innerHTML = `<div class="info-block"><div class="title">${b.nome}</div><div class="subtitle">${b.avaliacao}</div></div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-barbeiros .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            barbeiroSelecionado = b.id;
            renderizarGradeHorarios(); // Libera os horários assim que clica no profissional
        };
        boxBarbeiros.appendChild(div);
    });

    // 3. Renderizar Meios de Pagamento
    const boxPagos = document.getElementById('container-pagamentos');
    boxPagos.innerHTML = "";
    ESTRUTURA_PAGAMENTOS.forEach(p => {
        const div = document.createElement('div');
        div.className = "modern-card";
        div.innerHTML = `<div class="info-block"><div class="title">${p.nome}</div><div class="subtitle">${p.sub}</div></div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-pagamentos .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            pagamentoSelecionado = p.nome;
        };
        boxPagos.appendChild(div);
    });

    // Definir data padrão (Amanhã)
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    document.getElementById('data').value = amanha.toISOString().split('T')[0];

    renderizarGradeHorarios();
}

// ==========================================
// RENDERIZADOR DE HORÁRIOS POR TURNO
// ==========================================
document.getElementById('data').addEventListener('change', renderizarGradeHorarios);

function renderizarGradeHorarios() {
    const container = document.getElementById('container-horarios');
    container.innerHTML = "";

    if (!barbeiroSelecionado) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:13px; text-align:center;'>⚠️ Escolha um profissional acima para carregar a grade de horários.</p>";
        return;
    }

    const estado = obterEstado();
    const dataDigitada = document.getElementById('data').value;

    HORARIOS_PADRAO.forEach(grupo => {
        const turnoDiv = document.createElement('div');
        
        const label = document.createElement('div');
        label.className = "turno-title";
        label.innerText = grupo.turno;
        turnoDiv.appendChild(label);

        const grid = document.createElement('div');
        grid.className = "grid-horarios";

        grupo.horas.forEach(hora => {
            // Verifica se o horário já está reservado no localStorage
            const ocupado = estado.agenda_dia.some(a => a.data === dataDigitada && a.hora === hora && a.barbeiro === barbeiroSelecionado && a.status === 'Agendado');

            const btn = document.createElement('button');
            btn.className = "btn-horario";
            btn.innerText = hora;

            if (ocupado) {
                btn.style.opacity = "0.2";
                btn.style.cursor = "not-allowed";
                btn.disabled = true;
            } else {
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado');
                    horarioSelecionado = hora;
                };
            }
            grid.appendChild(btn);
        });

        turnoDiv.appendChild(grid);
        container.appendChild(turnoDiv);
    });
}

// ==========================================
// BOTÃO CONFIRMAR AGENDA (GRAVAÇÃO REAL)
// ==========================================
document.getElementById('btnConfirmar').addEventListener('click', () => {
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert('Selecione todos os campos em formato de card antes de confirmar!');
        return;
    }

    const estado = obterEstado();
    const novo = {
        id: Date.now(),
        cliente: usuarioLogado.toUpperCase(),
        servico: servicoSelecionado,
        hora: horarioSelecionado,
        data: document.getElementById('data').value,
        status: "Agendado",
        barbeiro: barbeiroSelecionado
    };

    estado.agenda_dia.push(novo);
    salvarEstado(estado);

    const statusMsg = document.getElementById('mensagem-status');
    statusMsg.style.color = "var(--success-color)";
    statusMsg.innerText = "✨ Agendamento gravado e atualizado com sucesso!";

    setTimeout(() => { statusMsg.innerText = ""; }, 3000);
    renderizarGradeHorarios();
});

// ==========================================
// KANBAN DA OPERAÇÃO (BARBEIRO)
// ==========================================
function construirKanbanBarbeiro() {
    const box = document.getElementById('kanban-agenda-barbeiro');
    box.innerHTML = "";

    const estado = obterEstado();
    // Filtra apenas os agendamentos ativos destinados ao barbeiro logado
    const filtrados = estado.agenda_dia.filter(a => a.barbeiro === usuarioLogado);

    if (filtrados.length === 0) {
        box.innerHTML = "<p style='color:var(--text-muted); text-align:center; padding:20px;'>☕ Fila vazia por aqui.</p>";
        return;
    }

    filtrados.forEach(item => {
        const div = document.createElement('div');
        div.className = "kanban-item";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-weight:700;">
                <div>${item.hora} — ${item.cliente}</div>
                <div style="color:var(--accent-color); font-size:12px;">${item.status}</div>
            </div>
            <div class="kanban-meta">${item.servico}</div>
            <div class="kanban-actions">
                <button class="btn-kb checkin" onclick="atualizarStatusCard(${item.id}, 'Na Cadeira')">Check-in</button>
                <button class="btn-kb done" onclick="atualizarStatusCard(${item.id}, 'Concluido')">Concluir</button>
                <button class="btn-kb noshow" onclick="atualizarStatusCard(${item.id}, 'Falta')">Falta</button>
            </div>
        `;
        box.appendChild(div);
    });

    document.getElementById('b-meta-agendamentos').innerText = filtrados.length;
    document.getElementById('b-meta-faturamento').innerText = `R$ ${estado.barbeiros[usuarioLogado]?.faturamento.toFixed(2) || '0.00'}`;
}

function atualizarStatusCard(id, novoStatus) {
    const estado = obterEstado();
    const index = estado.agenda_dia.findIndex(a => a.id === id);

    if (index !== -1) {
        if (novoStatus === 'Concluido' || novoStatus === 'Falta') {
            // Se concluiu ou faltou, removemos da fila diária ativa salvando a alteração no LocalStorage
            if (novoStatus === 'Concluido' && estado.barbeiros[usuarioLogado]) {
                estado.barbeiros[usuarioLogado].faturamento += 35.00; // Simula ganho de comissão real
            }
            estado.agenda_dia.splice(index, 1);
        } else {
            estado.agenda_dia[index].status = novoStatus;
        }
        
        salvarEstado(estado);
        construirKanbanBarbeiro();
    }
}

// ==========================================
// ENGINE DE ALTERNAÇÃO DE TELAS (SPA)
// ==========================================
function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    nav.innerHTML = "";

    if (role === 'barbeiro') {
        nav.innerHTML = `<button class="nav-item ativo" onclick="alternarTela('barbeiro')"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>Agenda</button>`;
    } else {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('home')"><svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>Agendar</button>
            <button class="nav-item" onclick="alternarTela('estilo')"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>Estilo</button>
        `;
    }
    nav.innerHTML += `<button class="nav-item" style="color:var(--danger-color)" onclick="fazerLogout()"><svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59z"/></svg>Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'estilo', 'fidelidade', 'barbeiro'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el) el.classList.add('escondido');
    });
    document.getElementById(`aba-${idAba}`).classList.remove('escondido');
}

function inicializarFluxoPainel() {
    if (perfilLogado === 'barbeiro') {
        alternarTela('barbeiro');
        construirKanbanBarbeiro();
    } else {
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${usuarioLogado}!`;
        renderizarFormularioCliente();
    }
}

function fazerLogout() {
    usuarioLogado = null; perfilLogado = null;
    document.getElementById('conteudo-app').classList.add('escondido');
    document.getElementById('tela-login').classList.remove('escondido');
}
