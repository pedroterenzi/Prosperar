const API_URL = "https://prosperar.onrender.com";

let usuarioLogado = null;
let perfilLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00, sub: "Duração: 30 min" },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00, sub: "Duração: 45 min" },
    { id: "barba", nome: "Barba Completa", preco: 35.00, sub: "Duração: 30 min" },
    { id: "combo", nome: "Combo Premium", preco: 85.00, sub: "Corte + Barba + Sobrancelha" }
];

const ESTRUTURA_BARBEIROS = [
    { id: "gabriel", nome: "Gabriel (Proprietário)", avaliacao: "★ 4.9 (148 avaliações)" },
    { id: "lucas", nome: "Lucas Barber", avaliacao: "★ 4.8 (96 avaliações)" }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

// Alternador visual do formulário de autenticação
function alternarAbasAuth(aba) {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-cadastro').classList.remove('active');
    document.getElementById('form-login').classList.add('escondido');
    document.getElementById('form-cadastro').classList.add('escondido');
    
    if(aba === 'login') {
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('form-login').classList.remove('escondido');
    } else {
        document.getElementById('tab-cadastro').classList.add('active');
        document.getElementById('form-cadastro').classList.remove('escondido');
    }
}

// Fluxo de Cadastro de Usuário no Banco Neon
document.getElementById('btn-cadastrar').addEventListener('click', async () => {
    const nome = document.getElementById('cad-nome').value.trim();
    const login = document.getElementById('cad-login').value.trim();
    const celular = document.getElementById('cad-celular').value.trim();
    const plano = document.getElementById('cad-plano').value;
    const senha = document.getElementById('cad-senha').value;
    const confirmar = document.getElementById('cad-confirmar-senha').value;

    if(!nome || !login || !celular || !senha) return alert("Por favor, preencha todos os campos!");
    if(senha !== confirmar) return alert("As senhas informadas não coincidem!");

    try {
        const res = await fetch(`${API_URL}/usuarios/cadastro`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ login, senha, nome, celular, plano_assinatura: plano })
        });
        
        if(res.ok) {
            alert("✨ Conta criada com sucesso! Você já pode realizar o login.");
            alternarAbasAuth('login');
        } else {
            const err = await res.json();
            alert(err.detail || "Erro ao efetuar cadastro.");
        }
    } catch(e) {
        alert("Erro ao conectar com o servidor.");
    }
});

// Fluxo de Login com Nível de Permissão Real
document.getElementById('btn-entrar').addEventListener('click', async () => {
    const login = document.getElementById('login-usuario').value.trim().toLowerCase();
    const senha = document.getElementById('login-senha').value;

    if(!login || !senha) return alert("Preencha os campos de acesso.");

    try {
        const res = await fetch(`${API_URL}/usuarios/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ login, senha })
        });

        if(res.ok) {
            const user = await res.json();
            usuarioLogado = user.login;
            perfilLogado = user.perfil;

            document.getElementById('tela-autenticacao').classList.add('escondido');
            document.getElementById('conteudo-app').classList.remove('escondido');

            montarMenuNavegacao(perfilLogado);
            direcionarFluxoInicial(perfilLogado, user.nome);
        } else {
            alert("Acesso negado. Verifique os dados.");
        }
    } catch(e) {
        alert("Falha de conexão com o banco Neon.");
    }
});

function direcionarFluxoInicial(perfil, nomeUsuario) {
    if(perfil === 'admin') {
        alternarTela('adm-dash');
    } else if(perfil === 'barbeiro') {
        alternarTela('adm-recepcao');
    } else {
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${nomeUsuario}!`;
        renderizarFormularioCliente();
        carregarMeusAgendamentosDoBanco();
    }
}

// ================= PROCESSAMENTO DE MÉTRICAS OPERACIONAIS REAIS =================
async function carregarDadosEstrategicosDoNeon() {
    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if(!res.ok) return;
        const agendamentos = await res.json();

        let faturamentoTotal = 0;
        let finalizados = 0;
        let faltas = 0;
        let comissaoGabriel = 0;
        let comissaoLucas = 0;

        agendamentos.forEach(a => {
            const serv = ESTRUTURA_SERVICOS.find(s => s.nome === a.servico);
            const valor = serv ? serv.preco : 40.00;

            if(a.status !== 'Falta') {
                faturamentoTotal += valor;
                finalizados++;
                if (String(a.barbeiro).toLowerCase().includes('gabriel')) {
                    comissaoGabriel += (valor * 0.50);
                } else {
                    comissaoLucas += (valor * 0.40);
                }
            } else {
                faltas++;
            }
        });

        document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
        
        const tMedio = finalizados > 0 ? (faturamentoTotal / finalizados) : 0;
        document.getElementById('kpi-ticket').innerText = `R$ ${tMedio.toFixed(2)}`;

        const taxaOcupacao = agendamentos.length > 0 ? Math.min(Math.round((agendamentos.length / 18) * 100), 100) : 0;
        document.getElementById('kpi-ocupacao').innerText = `${taxaOcupacao}%`;

        const taxaNoShow = agendamentos.length > 0 ? ((faltas / agendamentos.length) * 100).toFixed(1) : 0;
        document.getElementById('kpi-noshow').innerText = `${taxaNoShow}%`;

        document.getElementById('split-gabriel').innerText = `R$ ${comissaoGabriel.toFixed(2)}`;
        document.getElementById('split-lucas').innerText = `R$ ${comissaoLucas.toFixed(2)}`;

    } catch(e) {
        console.error("Erro ao processar inteligência do Neon", e);
    }
}

// CRM de Marketing Real e Dinâmico
async function carregarListaMarketingReal() {
    const container = document.getElementById('lista-marketing-clientes');
    if(!container) return;

    try {
        const resUsers = await fetch(`${API_URL}/usuarios`);
        if(!resUsers.ok) return;
        const usuarios = await resUsers.json();

        container.innerHTML = "";
        let assinantes = 0;
        let faturamentoRecorrente = 0;

        usuarios.forEach(u => {
            if(u.perfil === 'admin') return;

            if(u.plano_assinatura && u.plano_assinatura !== 'Nenhum') {
                assinantes++;
                faturamentoRecorrente += u.plano_assinatura.includes('Gold') ? 150 : 80;
            }

            const div = document.createElement('div');
            div.className = "item-backoffice";
            div.innerHTML = `
                <div>
                    <strong>${u.nome}</strong><br>
                    <span style="font-size:11px; color:var(--text-muted);">Cel: ${u.celular} | Plano: ${u.plano_assinatura}</span>
                </div>
                <button class="btn-status" style="background:var(--accent-color); color:black;" onclick="dispararWppCliente('${u.celular}', '${u.nome}')">Mandar Cupom</button>
            `;
            container.appendChild(div);
        });

        document.getElementById('mkt-total-assinantes').innerText = assinantes;
        document.getElementById('mkt-faturamento-recorrente').innerText = `R$ ${faturamentoRecorrente.toFixed(2)}`;
    } catch(e) {
        container.innerHTML = "<p>Erro ao ler lista do CRM.</p>";
    }
}

function dispararWppCliente(celular, nome) {
    const msg = `Olá ${nome}! Sentimos sua falta na Prosperar Club. Use o cupom PROSPERAR15 e ganhe 15% de desconto no seu próximo corte! Agende pelo app.`;
    window.open(`https://api.whatsapp.com/send?phone=55${celular}&text=${encodeURIComponent(msg)}`, '_blank');
}

// Kanban Real e Operacional com Controle de Status
async function carregarModoRecepcaoKanban() {
    const container = document.getElementById('container-kanban-recepcao');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if(!res.ok) return;
        const dados = await res.json();

        container.innerHTML = "";
        if(dados.length === 0) {
            container.innerHTML = "<p style='color:var(--text-muted); text-align:center;'>Nenhum cliente agendado.</p>";
            return;
        }

        dados.forEach(item => {
            const div = document.createElement('div');
            div.className = "item-backoffice";
            
            let corBorda = "var(--accent-color)";
            if(item.status === 'Concluído') corBorda = "var(--success-color)";
            if(item.status === 'Falta') corBorda = "var(--danger-color)";

            div.style.borderLeft = `4px solid ${corBorda}`;
            div.innerHTML = `
                <div>
                    <strong>👤 ${item.cliente} (${item.status})</strong><br>
                    <span style="font-size:12px; color:var(--text-muted);">${item.servico} - ${item.hora}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-status" style="background:var(--success-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Concluído')">✔</button>
                    <button class="btn-status" style="background:var(--danger-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Falta')">✖</button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch(e) {
        container.innerHTML = "<p>Erro ao carregar monitor.</p>";
    }
}

async function mudarStatusAgendamento(id, novoStatus) {
    try {
        await fetch(`${API_URL}/agendamentos/${id}/status`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: novoStatus })
        });
        carregarModoRecepcaoKanban();
    } catch(e) {
        alert("Erro ao mudar status.");
    }
}

// Execução Real do Encaixe Manual (Walk-in)
document.getElementById('btn-executar-encaixe').addEventListener('click', async () => {
    const nome = document.getElementById('encaixe-nome').value.trim();
    const servico = document.getElementById('encaixe-servico').value;
    const barbeiro = document.getElementById('encaixe-barbeiro').value;
    const hora = document.getElementById('encaixe-hora').value;

    if(!nome) return alert("Insira o nome do cliente para fazer o encaixe manual.");

    const payload = {
        cliente: `WALK-IN: ${nome.toUpperCase()}`,
        servico: servico,
        barbeiro: barbeiro,
        data: new Date().toISOString().split('T')[0],
        hora: hora,
        pagamento: "Balcão (Dinheiro/Maquininha)"
    };

    try {
        const res = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            alert("⚡ Encaixe manual registrado com sucesso no banco de dados!");
            document.getElementById('encaixe-nome').value = "";
            carregarModoRecepcaoKanban();
        }
    } catch(e) {
        alert("Falha ao registrar encaixe.");
    }
});

// --- SISTEMA CORE DE AGENDAMENTO (CLIENTE) ---
async function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios');
    if (!container || !barbeiroSelecionado) return;

    const dataSelecionada = document.getElementById('data').value;
    let ocupados = [];

    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if (res.ok) {
            const todos = await res.json();
            ocupados = todos
                .filter(a => a.data === dataSelecionada && String(a.barbeiro).toLowerCase().includes(barbeiroSelecionado) && a.status !== 'Falta')
                .map(a => String(a.hora).trim());
        }
    } catch (e) {}

    container.innerHTML = "";
    HORARIOS_PADRAO.forEach(g => {
        const box = document.createElement('div');
        box.innerHTML = `<div class="turno-title">${g.turno}</div>`;
        const grid = document.createElement('div');
        grid.className = "grid-horarios";

        g.horas.forEach(h => {
            const btn = document.createElement('button');
            btn.className = "btn-horario";
            btn.innerText = h;

            if (ocupados.includes(h.trim())) {
                btn.disabled = true;
                btn.innerText = "Ocupado";
            } else {
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado');
                    horarioSelecionado = h;
                };
            }
            grid.appendChild(btn);
        });
        box.appendChild(grid);
        container.appendChild(box);
    });
}

document.getElementById('btnPreAgendar').addEventListener('click', (e) => {
    e.preventDefault();
    if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
        alert("Por favor, selecione todos os parâmetros antes de avançar.");
        return;
    }
    document.getElementById('modal-resumo-detalhes').innerHTML = `
        <strong>Procedimento:</strong> ${servicoSelecionado}<br>
        <strong>Profissional:</strong> ${barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber'}<br>
        <strong>Data/Hora:</strong> ${document.getElementById('data').value} às ${horarioSelecionado}<br>
        <span style="color:var(--success-color); font-weight:bold;">Valor: R$ ${precoServico.toFixed(2)}</span>
    `;
    document.getElementById('modal-confirmacao').classList.remove('escondido');
});

// EVENTO DE CONFIRMAÇÃO DO POP-UP OPERACIONALIZADO (CORRIGIDO)
document.getElementById('btn-confirmar-modal').addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Tratativa para evitar que o código trave caso o usuário não esteja mapeado corretamente
    const nomeCliente = usuarioLogado ? usuarioLogado.toUpperCase() : "CLIENTE_ANONIMO";
    
    const payload = {
        cliente: nomeCliente,
        servico: servicoSelecionado || "Não Informado",
        barbeiro: barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber',
        data: document.getElementById('data').value,
        hora: horarioSelecionado,
        pagamento: pagamentoSelecionado || "Balcão"
    };

    // Alerta visual simples para você ver se o botão acordou
    const botao = document.getElementById('btn-confirmar-modal');
    botao.innerText = "Gravando...";
    botao.disabled = true;

    try {
        const res = await fetch(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('modal-confirmacao').classList.add('escondido');
            alert("✨ Agendamento gravado com sucesso no Banco Neon!");
            
            try {
                enviarMensagemWhatsApp(payload);
            } catch(wppErr) {
                console.error("Popup de WhatsApp bloqueado ou falhou:", wppErr);
            }

            horarioSelecionado = null;
            renderizarGradeHorariosReais();
            carregarMeusAgendamentosDoBanco();
        } else {
            const erroServidor = await res.json();
            alert(`Erro no servidor: ${erroServidor.detail || "Erro desconhecido"}`);
        }
    } catch (e) {
        console.error("Erro na requisição:", e);
        alert("Erro ao conectar com o servidor. Verifique sua API.");
    } finally {
        // Restaura o botão original após a operação terminar
        botao.innerText = "Confirmar";
        botao.disabled = false;
    }
});
function enviarMensagemWhatsApp(dados) {
    const texto = `👋 Olá! Segue a confirmação do meu agendamento na Prosperar Club:\n\n👤 Cliente: ${dados.cliente}\n💇‍♂️ Procedimento: ${dados.servico}\n💈 Profissional: ${dados.barbeiro}\n📅 Data: ${dados.data}\n⏰ Horário: ${dados.hora}\n💳 Meio de Pagamento: ${dados.pagamento}\n\nObrigado!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
}

async function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos');
    if (!container) return;
    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if (res.ok) {
            const lista = await res.json();
            const meus = lista.filter(a => a.cliente.toUpperCase() === usuarioLogado.toUpperCase());

            container.innerHTML = meus.length === 0 ? "<p>Nenhum agendamento ativo.</p>" : "";
            meus.forEach(item => {
                const div = document.createElement('div');
                div.className = "card";
                div.innerHTML = `
                    <strong class="gold-text">${item.servico} (${item.status})</strong><br>
                    <span>${item.barbeiro} - ${item.data} às ${item.hora}</span>
                    <button class="btn-danger" onclick="cancelarAgendamento(${item.id})">Cancelar Reserva</button>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {}
}

async function cancelarAgendamento(id) {
    if(!confirm("Deseja cancelar?")) return;
    await fetch(`${API_URL}/agendamentos/${id}`, { method: 'DELETE' });
    carregarMeusAgendamentosDoBanco();
}

function renderizarFormularioCliente() {
    const box = document.getElementById('container-servicos'); box.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div><div class="title">${s.nome}</div><div class="subtitle">${s.sub}</div></div><div class="price">R$ ${s.preco.toFixed(2)}</div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-servicos .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected'); servicoSelecionado = s.nome; precoServico = s.preco;
        };
        box.appendChild(div);
    });

    const boxB = document.getElementById('container-barbeiros'); boxB.innerHTML = "";
    ESTRUTURA_BARBEIROS.forEach(b => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div><div class="title">${b.nome}</div><div class="subtitle">${b.avaliacao}</div></div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-barbeiros .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected'); barbeiroSelecionado = b.id; renderizarGradeHorariosReais();
        };
        boxB.appendChild(div);
    });

    const boxP = document.getElementById('container-pagamentos'); boxP.innerHTML = "";
    ["Pix", "Cartão de Crédito/Débito"].forEach(p => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div class="title">${p}</div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-pagamentos .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected'); pagamentoSelecionado = p;
        };
        boxP.appendChild(div);
    });
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
}

function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    if (!nav) return;

    if (role === 'admin') {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('adm-dash')"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 14H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2z"/></svg>Finanças</button>
            <button class="nav-item" onclick="alternarTela('adm-estoque')"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 12H4v-2h11v2zm0-4H4v-2h11v2zm5-4H4V6h16v2z"/></svg>Estoque</button>
            <button class="nav-item" onclick="alternarTela('adm-mkt')"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>Marketing</button>
            <button class="nav-item" onclick="alternarTela('adm-recepcao')"><svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>Monitor</button>
        `;
    } else {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('home')"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>Agendar</button>
            <button class="nav-item" onclick="alternarTela('estilo')"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>Reservas</button>
        `;
    }
    nav.innerHTML += `<button class="nav-item" style="color:var(--danger-color)" onclick="window.location.reload()"><svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59z"/></svg>Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'estilo', 'adm-dash', 'adm-estoque', 'adm-mkt', 'adm-recepcao'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el) el.classList.add('escondido');
    });
    const abaAlvo = document.getElementById(`aba-${idAba}`);
    if (abaAlvo) abaAlvo.classList.remove('escondido');

    if(idAba === 'adm-dash') carregarDadosEstrategicosDoNeon();
    if(idAba === 'adm-mkt') carregarListaMarketingReal();
    if(idAba === 'adm-recepcao') carregarModoRecepcaoKanban();
}
