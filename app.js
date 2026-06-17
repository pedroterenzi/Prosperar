const API_URL = "https://prosperar.onrender.com";

let usuarioLogado = null;
let perfilLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

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

// Gerenciador de Login e Direcionamento de fluxo
document.getElementById('btn-entrar').addEventListener('click', () => {
    const login = document.getElementById('login-usuario').value.trim().toLowerCase();
    if (!login) return alert("Por favor, digite seu usuário.");

    usuarioLogado = login;
    perfilLogado = (login === 'gabriel' || login === 'lucas') ? 'barbeiro' : 'cliente';

    document.getElementById('tela-login').classList.add('escondido');
    document.getElementById('conteudo-app').classList.remove('escondido');

    montarMenuNavegacao(perfilLogado);
    
    if (perfilLogado === 'cliente') {
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${login.charAt(0).toUpperCase() + login.slice(1)}!`;
        renderizarFormularioCliente();
        carregarMeusAgendamentosDoBanco();
    }
});

function renderizarFormularioCliente() {
    // 1. Injetar Serviços
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
            precoServico = s.preco;
        };
        boxServicos.appendChild(div);
    });

    // 2. Injetar Barbeiros
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
            renderizarGradeHorariosReais();
        };
        boxBarbeiros.appendChild(div);
    });

    // 3. Injetar Pagamentos
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

    document.getElementById('data').value = new Date().toISOString().split('T')[0];
}

// 1. REQUISITO: RETIRAR OS HORÁRIOS OCUPADOS DIRETAMENTE DO NEON
document.getElementById('data').addEventListener('change', renderizarGradeHorariosReais);

async function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios');
    if (!container) return;

    if (!barbeiroSelecionado) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:13px; text-align:center;'>⚠️ Escolha o barbeiro para checar horários disponíveis.</p>";
        return;
    }

    const dataSelecionada = document.getElementById('data').value;
    let agendamentosOcupados = [];

    try {
        const resposta = await fetch(`${API_URL}/agendamentos`);
        if (resposta.ok) {
            const todosAgendamentos = await resposta.json();
            
            agendamentosOcupados = todosAgendamentos
                .filter(a => {
                    const bancoBarbeiro = String(a.barbeiro).toLowerCase();
                    const selecionadoBarbeiro = String(barbeiroSelecionado).toLowerCase();
                    return a.data === dataSelecionada && bancoBarbeiro.includes(selecionadoBarbeiro);
                })
                .map(a => String(a.hora).trim());
        }
    } catch (erro) {
        console.error("Erro na leitura das datas do Neon.", erro);
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

            // Bloqueia e altera o texto do botão caso o horário conste no Neon
            if (agendamentosOcupados.includes(hora.trim())) {
                btn.disabled = true;
                btn.innerText = "Ocupado";
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

// 2. REQUISITO: POP-UP MODAL DE DUPLA CONFIRMAÇÃO
document.getElementById('btnPreAgendar').addEventListener('click', () => {
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert("Por favor, selecione todas as opções antes de avançar!");
        return;
    }

    document.getElementById('modal-resumo-detalhes').innerHTML = `
        <strong>💇‍♂️ Procedimento:</strong> ${servicoSelecionado}<br>
        <strong>💈 Barbeiro:</strong> ${barbeiroSelecionado.toUpperCase()}<br>
        <strong>📅 Data:</strong> ${document.getElementById('data').value}<br>
        <strong>⏰ Horário:</strong> ${horarioSelecionado}<br>
        <strong>💳 Pagamento:</strong> ${pagamentoSelecionado}<br>
        <span style="color:var(--success-color); font-weight:bold;">💵 Valor total: R$ ${precoServico.toFixed(2)}</span>
    `;

    document.getElementById('modal-confirmacao').classList.remove('escondido');
});

document.getElementById('btn-modal-voltar').addEventListener('click', () => {
    document.getElementById('modal-confirmacao').classList.add('escondido');
});

// ENVIO DOS DADOS CONFIRMADOS PARA A API
document.getElementById('btn-modal-gravar').addEventListener('click', async () => {
    const payload = {
        cliente: usuarioLogado.toUpperCase(),
        servico: servicoSelecionado,
        barbeiro: barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber',
        data: document.getElementById('data').value,
        hora: horarioSelecionado,
        pagamento: pagamentoSelecionado
    };

    try {
        const enviar = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (enviar.ok) {
            document.getElementById('modal-confirmacao').classList.add('escondido');
            alert("✅ Agendamento gravado com sucesso no Neon!");
            
            // 4. REQUISITO: DISPARO DE MENSAGEM VIA WHATSAPP
            enviarMensagemWhatsApp(payload);

            renderizarGradeHorariosReais();
            carregarMeusAgendamentosDoBanco();
        } else {
            alert("Erro ao gravar agendamento. Verifique o backend.");
        }
    } catch (e) {
        alert("O servidor de banco de dados não respondeu.");
    }
});

function enviarMensagemWhatsApp(dados) {
    const numeroBarbearia = "5519999999999"; // Insira o número real da barbearia se preferir centralizar
    const texto = `👋 Olá! Segue a confirmação do meu agendamento na Prosperar Club:\n\n` +
                  `👤 Cliente: ${dados.cliente}\n` +
                  `💇‍♂️ Procedimento: ${dados.servico}\n` +
                  `💈 Profissional: ${dados.barbeiro}\n` +
                  `📅 Data: ${dados.data}\n` +
                  `⏰ Horário: ${dados.hora}\n` +
                  `💳 Meio de Pagamento: ${dados.pagamento}\n\n` +
                  `Obrigado!`;

    const urlCodificada = `https://api.whatsapp.com/send?phone=${numeroBarbearia}&text=${encodeURIComponent(texto)}`;
    window.open(urlCodificada, '_blank');
}

// 3. REQUISITO: INTERFACE DE CANCELAMENTO COM DELEÇÃO REAL NO NEON
async function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos');
    if (!container) return;

    container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>Buscando seus agendamentos...</p>";

    try {
        const resposta = await fetch(`${API_URL}/agendamentos`);
        if (resposta.ok) {
            const lista = await resposta.json();
            const meusAgendamentos = lista.filter(a => a.cliente.toUpperCase() === usuarioLogado.toUpperCase());

            if (meusAgendamentos.length === 0) {
                container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>Você não possui horários marcados.</p>";
                return;
            }

            container.innerHTML = "";
            meusAgendamentos.forEach(item => {
                const div = document.createElement('div');
                div.className = "card";
                div.style.border = "1px solid #3a1a1a";
                div.innerHTML = `
                    <div style="font-weight:700; font-size:16px; margin-bottom: 8px;" class="gold-text">${item.servico}</div>
                    <div style="font-size:14px; line-height:1.6; color: var(--text-muted);">
                        <strong>Barbeiro:</strong> ${item.barbeiro}<br>
                        <strong>Data/Hora:</strong> ${item.data} às ${item.hora}
                    </div>
                    <button class="btn-danger" onclick="cancelarAgendamentoDoBanco(${item.id})">❌ Cancelar Horário</button>
                `;
                container.appendChild(div);
            });
        }
    } catch (err) {
        container.innerHTML = "<p style='color:var(--danger-color); text-align:center;'>Erro de comunicação com o Neon.</p>";
    }
}

async function cancelarAgendamentoDoBanco(id) {
    if (!confirm("Tem certeza que deseja cancelar e liberar esse horário de forma definitiva?")) return;

    try {
        const deletar = await fetch(`${API_URL}/agendamentos/${id}`, { method: 'DELETE' });
        if (deletar.ok) {
            alert("Excluído permanentemente do banco Neon!");
            renderizarGradeHorariosReais();
            carregarMeusAgendamentosDoBanco();
        } else {
            alert("Não foi possível excluir o registro.");
        }
    } catch (e) {
        alert("Erro na conexão com a API.");
    }
}

// Alternador SPA
function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    if (!nav) return;

    if (role === 'cliente') {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('home')"><svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>Agendar</button>
            <button class="nav-item" onclick="alternarTela('estilo')"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>Minhas Cadeiras</button>
        `;
    }
    nav.innerHTML += `<button class="nav-item" style="color:var(--danger-color)" onclick="window.location.reload()"><svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59z"/></svg>Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'estilo'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el) el.classList.add('escondido');
    });
    const abaAlvo = document.getElementById(`aba-${idAba}`);
    if (abaAlvo) abaAlvo.classList.remove('escondido');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('ativo'));
    if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('ativo');
}
