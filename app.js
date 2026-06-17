// Configuração da API conectada ao Render
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

// Login local unificado
document.getElementById('btn-entrar').addEventListener('click', () => {
    const login = document.getElementById('login-usuario').value.trim().toLowerCase();
    if (!login) return alert("Informe seu usuário!");

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
    // 1. Renderizar Serviços
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
            renderizarGradeHorariosReais();
        };
        boxBarbeiros.appendChild(div);
    });

    // 3. Renderizar Pagamentos
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

// 1. REQUISITO: PUXAR E EXCLUIR HORÁRIOS JÁ AGENDADOS NO BANCO DE DADOS REAIS
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

    // Faz o fetch real na API buscando a lista cadastrada no banco
    try {
        const resposta = await fetch(`${API_URL}/agendamentos`);
        if (resposta.ok) {
            const todosAgendamentos = await resposta.json();
            // Filtra os registros ativos do banco que colidem com a mesma data e profissional
            agendamentosOcupados = todosAgendamentos.filter(a => 
                a.data === dataSelecionada && 
                a.barbeiro.toLowerCase().includes(barbeiroSelecionado)
            ).map(a => a.hora);
        }
    } catch (erro) {
        console.error("Erro ao ler banco de dados, exibindo grade cheia.", erro);
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

            // Se o horário retornado do banco bater com este botão, desativa-o imediatamente
            if (agendamentosOcupados.includes(hora)) {
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

// 2. REQUISITO: POP-UP DE CONFIRMAÇÃO EM DOIS PASSOS
document.getElementById('btnPreAgendar').addEventListener('click', () => {
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert("Por favor, selecione todas as opções nos cards antes de avançar!");
        return;
    }

    // Alimenta a caixa de texto com o resumo formatado das opções do cliente
    document.getElementById('modal-resumo-detalhes').innerHTML = `
        <strong>💇‍♂️ Serviço:</strong> ${servicoSelecionado}<br>
        <strong>💈 Profissional:</strong> ${barbeiroSelecionado.toUpperCase()}<br>
        <strong>📅 Data escolhida:</strong> ${document.getElementById('data').value}<br>
        <strong>⏰ Horário reservado:</strong> ${horarioSelecionado}<br>
        <strong>💳 Pagamento:</strong> ${pagamentoSelecionado}<br>
        <span style="color:var(--success-color); font-weight:bold;">💵 Valor total: R$ ${precoServico.toFixed(2)}</span>
    `;

    // Torna a janela visível na tela
    document.getElementById('modal-confirmacao').classList.remove('escondido');
});

document.getElementById('btn-modal-voltar').addEventListener('click', () => {
    document.getElementById('modal-confirmacao').classList.add('escondido');
});

// ENVIO DE DADOS PARA A API E LINK DO WHATSAPP
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
            alert("✅ Agendamento registrado com sucesso no banco de dados!");
            
            // 4. REQUISITO: MENSAGEM VIA WHATSAPP AUTOMÁTICA
            enviarMensagemWhatsApp(payload);

            renderizarGradeHorariosReais();
            carregarMeusAgendamentosDoBanco();
        } else {
            alert("Erro ao salvar o agendamento na API.");
        }
    } catch (e) {
        alert("Servidor indisponível no momento. O registro não pôde ser concluído.");
    }
});

function enviarMensagemWhatsApp(dados) {
    const numeroBarbearia = "5519999999999"; // Substitua pelo número real da barbearia se desejar centralizar
    const texto = `👋 Olá! Segue a confirmação do meu agendamento na Prosperar Club:\n\n` +
                  `👤 Cliente: ${dados.cliente}\n` +
                  `💇‍♂️ Procedimento: ${dados.servico}\n` +
                  `💈 Profissional: ${dados.barbeiro}\n` +
                  `📅 Data: ${dados.data}\n` +
                  `⏰ Horário: ${dados.hora}\n` +
                  `💳 Meio de Pagamento: ${dados.pagamento}\n\n` +
                  `Obrigado! Até lá.`;

    const urlCodificada = `https://api.whatsapp.com/send?phone=${numeroBarbearia}&text=${encodeURIComponent(texto)}`;
    window.open(urlCodificada, '_blank');
}

// 3. REQUISITO: SEÇÃO DE CONSULTA E EXCLUSÃO DO BANCO DE DADOS (CANCELAMENTO)
async function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos');
    if (!container) return;

    container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>Buscando registros ativos...</p>";

    try {
        const resposta = await fetch(`${API_URL}/agendamentos`);
        if (resposta.ok) {
            const lista = await resposta.json();
            // Filtra agendamentos pertencentes unicamente ao cliente logado
            const meusAgendamentos = lista.filter(a => a.cliente.toUpperCase() === usuarioLogado.toUpperCase());

            if (meusAgendamentos.length === 0) {
                container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>Você não possui agendamentos cadastrados no momento.</p>";
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
        container.innerHTML = "<p style='color:var(--danger-color); text-align:center;'>Falha ao conectar com o banco de dados.</p>";
    }
}

async function cancelarAgendamentoDoBanco(id) {
    if (!confirm("Tem certeza que deseja cancelar esse agendamento e liberá-lo no banco de dados?")) return;

    try {
        const deletar = await fetch(`${API_URL}/agendamentos/${id}`, {
            method: 'DELETE'
        });

        if (deletar.ok) {
            alert("Excluído com sucesso do banco de dados!");
            renderizarGradeHorariosReais();
            carregarMeusAgendamentosDoBanco();
        } else {
            alert("Não foi possível excluir o registro. Verifique a rota da API.");
        }
    } catch (e) {
        alert("Erro de conexão ao tentar deletar o agendamento.");
    }
}

// Alternador de Abas (SPA)
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
