let usuarioLogado = null;
let perfilLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;

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

// Gerenciamento de Login e Inicialização de Fluxo
document.getElementById('btn-entrar').addEventListener('click', () => {
    const login = document.getElementById('login-usuario').value.trim().toLowerCase();
    if (!login) {
        alert("Por favor, informe seu usuário ou WhatsApp.");
        return;
    }

    usuarioLogado = login;
    perfilLogado = (login === 'gabriel' || login === 'lucas') ? 'barbeiro' : 'cliente';

    document.getElementById('tela-login').classList.add('escondido');
    document.getElementById('conteudo-app').classList.remove('escondido');

    montarMenuNavegacao(perfilLogado);
    
    if (perfilLogado === 'cliente') {
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${login.charAt(0).toUpperCase() + login.slice(1)}!`;
        renderizarFormularioCliente();
    } else {
        alternarTela('barbeiro');
    }
});

// Renderizador Dinâmico dos Elementos do Cliente
function renderizarFormularioCliente() {
    // 1. Serviços
    const boxServicos = document.getElementById('container-servicos');
    if (boxServicos) {
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
    }

    // 2. Barbeiros
    const boxBarbeiros = document.getElementById('container-barbeiros');
    if (boxBarbeiros) {
        boxBarbeiros.innerHTML = "";
        ESTRUTURA_BARBEIROS.forEach(b => {
            const div = document.createElement('div');
            div.className = "modern-card";
            div.innerHTML = `<div class="info-block"><div class="title">${b.nome}</div><div class="subtitle">${b.avaliacao}</div></div>`;
            div.onclick = () => {
                document.querySelectorAll('#container-barbeiros .modern-card').forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                barbeiroSelecionado = b.id;
                renderizarGradeHorarios();
            };
            boxBarbeiros.appendChild(div);
        });
    }

    // 3. Pagamentos
    const boxPagos = document.getElementById('container-pagamentos');
    if (boxPagos) {
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
    }

    // Definir data padrão (Hoje)
    const inputData = document.getElementById('data');
    if (inputData && !inputData.value) {
        inputData.value = new Date().toISOString().split('T')[0];
    }

    renderizarGradeHorarios();
}

// Renderizador da Grade de Horários por Turnos
document.getElementById('data').addEventListener('change', renderizarGradeHorarios);

function renderizarGradeHorarios() {
    const container = document.getElementById('container-horarios');
    if (!container) return;

    if (!barbeiroSelecionado) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:13px; text-align:center; padding: 10px 0;'>⚠️ Selecione um profissional acima para visualizar a grade.</p>";
        return;
    }

    container.innerHTML = "";
    HORARIOS_PADRAO.forEach(grupo => {
        const turnoDiv = document.createElement('div');
        
        const label = document.createElement('div');
        label.className = "turno-title";
        label.innerText = grupo.turno;
        turnoDiv.appendChild(label);

        const grid = document.createElement('div');
        grid.className = "grid-horarios";

        grupo.horas.forEach(hora => {
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
        });

        turnoDiv.appendChild(grid);
        container.appendChild(turnoDiv);
    });
}

// Confirmação do Fluxo de Envio
document.getElementById('btnConfirmar').addEventListener('click', () => {
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert('Por favor, certifique-se de preencher todos os campos em formato de card!');
        return;
    }

    const statusMsg = document.getElementById('mensagem-status');
    statusMsg.style.color = "var(--success-color)";
    statusMsg.innerText = "✨ Agendamento salvo com sucesso!";
    
    setTimeout(() => { statusMsg.innerText = ""; }, 4000);
});

// Navegação entre Abas (SPA)
function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    if (!nav) return;

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
    ['home', 'estilo', 'barbeiro'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el) el.classList.add('escondido');
    });
    const abaAlvo = document.getElementById(`aba-${idAba}`);
    if (abaAlvo) abaAlvo.classList.remove('escondido');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('ativo'));
    const evento = window.event;
    if (evento && evento.currentTarget) evento.currentTarget.classList.add('ativo');
}

function fazerLogout() {
    usuarioLogado = null; perfilLogado = null;
    document.getElementById('conteudo-app').classList.add('escondido');
    document.getElementById('tela-login').classList.remove('escondido');
}
