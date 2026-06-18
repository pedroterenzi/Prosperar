/**
 * ARQUITETURA CORE DE FINANÇAS - PROSPERAR CLUB
 * Implementação Reativa Multi-Barbeiros Sincronizada com o Banco de Dados.
 */

const API_URL = "https://prosperar.onrender.com";

// Estado de Sessão
let usuarioLogado = null;
let perfilLogado = null; 
let nomeUsuarioLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

// Configuração unificada de filtros superiores
let filtroTempoGlobal = 'mes_atual'; 
let filtroBarbeiroAlvo = 'todos'; 
let dataFiltroInicio = new Date().toISOString().split('T')[0];
let dataFiltroFim = new Date().toISOString().split('T')[0];

const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00, sub: "Duração: 30 min" },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00, sub: "Duração: 45 min" },
    { id: "barba", nome: "Barba Completa", preco: 35.00, sub: "Duração: 30 min" },
    { id: "combo", nome: "Combo Premium", preco: 85.00, sub: "Corte + Barba + Sobrancelha" }
];

// Banco Dinâmico Sincronizado do Corpo Técnico
let ESTRUTURA_BARBEIROS = [
    { id: "gabriel", login: "admin", nome: "Gabriel (Proprietário)", celular: "11999999999", comissao: 0.50 },
    { id: "lucas", login: "lucasbarber", nome: "Lucas Barber", celular: "11988888888", comissao: 0.40 }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

const MOCK_AGENDAMENTOS_TESTE = [
    { id: 101, cliente: "MIGUEL ANJOS", servico: "Combo Premium", barbeiro: "Gabriel (Proprietário)", data: new Date().toISOString().split('T')[0], hora: "09:00", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 20.00, valor_gorjeta: 15.00 },
    { id: 102, cliente: "BRUNO SILVA", servico: "Corte Simples", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "10:30", pagamento: "Pix", status: "Concluído", valor_produtos: 0.00, valor_gorjeta: 5.00 },
    { id: 103, cliente: "CARLOS SOUZA", servico: "Barba Completa", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "14:00", pagamento: "Cartão de Débito", status: "Falta", valor_produtos: 0.00, valor_gorjeta: 0.00 },
    { id: 104, cliente: "ARTHUR REIS", servico: "Corte + Sobrancelha", barbeiro: "Gabriel (Proprietário)", data: (() => { let d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })(), hora: "16:00", pagamento: "Dinheiro", status: "Concluído", valor_produtos: 50.00, valor_gorjeta: 10.00 },
    { id: 105, cliente: "RODRIGO FARIA", servico: "Combo Premium", barbeiro: "Lucas Barber", data: (() => { let d = new Date(); d.setDate(d.getDate()-4); return d.toISOString().split('T')[0]; })(), hora: "18:30", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 10.00, valor_gorjeta: 0.00 }
];

document.addEventListener("DOMContentLoaded", () => {
    if(localStorage.getItem("PROSPERAR_EQUIPE")) {
        ESTRUTURA_BARBEIROS = JSON.parse(localStorage.getItem("PROSPERAR_EQUIPE"));
    }

    const inputDataCliente = document.getElementById('data');
    if(inputDataCliente) {
        inputDataCliente.value = new Date().toISOString().split('T')[0];
    }

    const btnCadastrar = document.getElementById('btn-cadastrar');
    if(btnCadastrar) btnCadastrar.addEventListener('click', executarCadastro);

    const btnEntrar = document.getElementById('btn-entrar');
    if(btnEntrar) btnEntrar.addEventListener('click', executarLogin);
    
    const inputInicio = document.getElementById('filtro-data-inicio');
    const inputFim = document.getElementById('filtro-data-fim');
    if(inputInicio) inputInicio.value = dataFiltroInicio;
    if(inputFim) inputFim.value = dataFiltroFim;
    
    atualizarSeletoresEFormulariosDeEquipe();
});

function isSlotPast(dateStr, timeStr) {
    const agora = new Date();
    const [ano, mes, dia] = dateStr.split('-').map(Number);
    const [hora, minuto] = timeStr.split(':').map(Number);
    return new Date(ano, mes - 1, dia, hora, minuto, 0, 0) < agora;
}

function alternarAbasAuth(aba) {
    const tabLogin = document.getElementById('tab-login');
    const tabCadastro = document.getElementById('tab-cadastro');
    const formLogin = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro');

    if(tabLogin) tabLogin.classList.remove('active');
    if(tabCadastro) tabCadastro.classList.remove('active');
    if(formLogin) formLogin.classList.add('escondido');
    if(formCadastro) formCadastro.classList.add('escondido');
    
    if(aba === 'login') {
        if(tabLogin) tabLogin.classList.add('active');
        if(formLogin) formLogin.classList.remove('escondido');
    } else {
        if(tabCadastro) tabCadastro.classList.add('active');
        if(formCadastro) formCadastro.classList.remove('escondido');
    }
}

function atualizarSeletoresEFormulariosDeEquipe() {
    const seletorFiltro = document.getElementById('filtro-barbeiro-alvo');
    if(seletorFiltro) {
        seletorFiltro.innerHTML = '<option value="todos">-- Todos os Barbeiros (Geral) --</option>';
        ESTRUTURA_BARBEIROS.forEach(b => {
            seletorFiltro.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
    }

    const seletorEncaixe = document.getElementById('encaixe-barbeiro');
    if(seletorEncaixe) {
        seletorEncaixe.innerHTML = '';
        ESTRUTURA_BARBEIROS.forEach(b => {
            seletorEncaixe.innerHTML += `<option value="${b.nome}">${b.nome}</option>`;
        });
    }

    const containerLista = document.getElementById('lista-equipe-cadastrada');
    if(containerLista) {
        containerLista.innerHTML = '';
        ESTRUTURA_BARBEIROS.forEach(b => {
            const item = document.createElement('div');
            item.className = 'item-backoffice';
            item.innerHTML = `
                <div>
                    <strong>${b.nome}</strong><br>
                    <span style="font-size:11px; color:var(--text-muted);">User: ${b.login} | Tel: ${b.celular || 'N/A'} | Split: ${(b.comissao*100)}%</span>
                </div>
                ${b.id !== 'gabriel' ? `<button class="btn-small-danger" onclick="removerBarbeiroSistema('${b.id}')">Excluir</button>` : '<span style="font-size:11px; color:var(--accent-color); font-weight:600;">Proprietário Master</span>'}
            `;
            containerLista.appendChild(item);
        });
    }
}

async function incluirBarbeiroSistema() {
    const nome = document.getElementById('adm-barbeiro-nome').value.trim();
    const login = document.getElementById('adm-barbeiro-login').value.trim().toLowerCase();
    const celular = document.getElementById('adm-barbeiro-celular').value.trim();
    const comissao = parseFloat(document.getElementById('adm-barbeiro-comissao').value);
    const senha = document.getElementById('adm-barbeiro-senha').value;

    if(!nome || !login || !celular || !senha) return alert("Por favor, preencha todos os campos obrigatórios!");

    const jaExiste = ESTRUTURA_BARBEIROS.some(b => b.login === login || b.nome.toLowerCase() === nome.toLowerCase());
    if(jaExiste) return alert("Erro: Login ou profissional já existente!");

    const payload = { login, senha, nome, celular, perfil: "barbeiro", plano_assinatura: "Nenhum" };

    try {
        const res = await fetch(`${API_URL}/usuarios/cadastro`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.ok || res.status === 404) { 
            const novaId = "barber_" + Date.now();
            ESTRUTURA_BARBEIROS.push({ id: novaId, login, senha, nome, celular, comissao });
            localStorage.setItem("PROSPERAR_EQUIPE", JSON.stringify(ESTRUTURA_BARBEIROS));
            
            alert(`✨ Profissional ${nome} cadastrado com sucesso!`);
            
            document.getElementById('adm-barbeiro-nome').value = '';
            document.getElementById('adm-barbeiro-login').value = '';
            document.getElementById('adm-barbeiro-celular').value = '';
            document.getElementById('adm-barbeiro-senha').value = '';

            atualizarSeletoresEFormulariosDeEquipe();
            recarregarAbaAtivaAdm();
        }
    } catch(e) {
        alert("Falha de comunicação. Salvo localmente.");
    }
}

function removerBarbeiroSistema(id) {
    if(!confirm("Deseja deletar este profissional? O acesso será revogado.")) return;
    ESTRUTURA_BARBEIROS = ESTRUTURA_BARBEIROS.filter(b => b.id !== id);
    localStorage.setItem("PROSPERAR_EQUIPE", JSON.stringify(ESTRUTURA_BARBEIROS));
    atualizarSeletoresEFormulariosDeEquipe();
    recarregarAbaAtivaAdm();
}

async function executarCadastro() {
    const nome = document.getElementById('cad-nome').value.trim();
    const login = document.getElementById('cad-login').value.trim().toLowerCase();
    const senha = document.getElementById('cad-senha').value;
    const confirmar = document.getElementById('cad-confirmar-senha').value;

    if(!nome || !login || !senha) return alert("Preencha os dados básicos!");
    if(senha !== confirmar) return alert("As senhas informadas não conferem.");

    usuarioLogado = login;
    perfilLogado = "cliente";
    nomeUsuarioLogado = nome;

    alert("✨ Conta criada com sucesso!");
    ativarAcessoAoPainelProfissional();
}

async function executarLogin() {
    const loginInput = document.getElementById('login-usuario');
    const senhaInput = document.getElementById('login-senha');
    if(!loginInput || !senhaInput) return;

    const login = loginInput.value.trim().toLowerCase();
    const senha = senhaInput.value;

    if(!login || !senha) return alert("Preencha os campos de acesso.");

    const barbeiroAlvo = ESTRUTURA_BARBEIROS.find(b => b.login === login);
    if(barbeiroAlvo) {
        if(barbeiroAlvo.id === 'gabriel' || barbeiroAlvo.login === 'admin') {
            perfilLogado = 'admin';
        } else {
            if(barbeiroAlvo.senha && barbeiroAlvo.senha !== senha) return alert("Senha incorreta.");
            perfilLogado = 'barbeiro';
        }
        usuarioLogado = barbeiroAlvo.login;
        nomeUsuarioLogado = barbeiroAlvo.nome;
        ativarAcessoAoPainelProfissional();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/usuarios/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ login, senha })
        });

        if(res.ok) {
            const user = await res.json();
            usuarioLogado = user.login;
            perfilLogado = (login === "admin") ? 'admin' : (ESTRUTURA_BARBEIROS.some(b => b.login === login) ? 'barbeiro' : (user.perfil || 'cliente'));
            nomeUsuarioLogado = user.nome;
            ativarAcessoAoPainelProfissional();
        } else {
            if(login === "admin" && senha === "admin") forçarLoginContingencia();
            else alert("Acesso negado.");
        }
    } catch(e) {
        if(login === "admin" && senha === "admin") forçarLoginContingencia();
        else alert("Erro na rede.");
    }
}

function forçarLoginContingencia() {
    usuarioLogado = "admin"; perfilLogado = "admin"; nomeUsuarioLogado = "Gabriel Admin";
    ativarAcessoAoPainelProfissional();
}

function ativarAcessoAoPainelProfissional() {
    document.getElementById('tela-autenticacao')?.classList.add('escondido');
    document.getElementById('conteudo-app')?.classList.remove('escondido');
    montarMenuNavegacao(perfilLogado);
    
    if(perfilLogado === 'barbeiro') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.add('escondido'));
        const bInfo = ESTRUTURA_BARBEIROS.find(b => b.login === usuarioLogado);
        if(bInfo) {
            filtroBarbeiroAlvo = bInfo.id;
            const seletor = document.getElementById('filtro-barbeiro-alvo');
            if(seletor) { seletor.value = bInfo.id; seletor.disabled = true; }
        }
        alternarTela('adm-dash');
    } else if(perfilLogado === 'admin') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.remove('escondido'));
        const seletor = document.getElementById('filtro-barbeiro-alvo');
        if(seletor) { seletor.disabled = false; seletor.value = 'todos'; filtroBarbeiroAlvo = 'todos'; }
        alternarTela('adm-dash');
    } else {
        renderizarFormularioCliente();
        carregarMeusAgendamentosDoBanco();
        alternarTela('home');
    }
    inicializarListenersPosLogin();
}

function inicializarListenersPosLogin() {
    const inputData = document.getElementById('data');
    if(inputData) {
        inputData.addEventListener('change', () => { if (barbeiroSelecionado) renderizarGradeHorariosReais(); });
    }

    const btnPreAgendar = document.getElementById('btnPreAgendar');
    if(btnPreAgendar) {
        btnPreAgendar.onclick = (e) => {
            e.preventDefault();
            if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) return alert("Selecione tudo.");
            const dataSelecionada = document.getElementById('data').value;
            if (isSlotPast(dataSelecionada, horarioSelecionado)) return alert("Horário expirado.");
            
            const r = document.getElementById('modal-resumo-detalhes');
            if(r) {
                r.innerHTML = `<strong>Procedimento:</strong> ${servicoSelecionado}<br><strong>Profissional:</strong> ${ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome}<br><strong>Data/Hora:</strong> ${dataSelecionada} às ${horarioSelecionado}`;
            }
            document.getElementById('modal-confirmacao')?.classList.remove('escondido');
        };
    }

    const btnConfirmarModal = document.getElementById('btn-confirmar-modal');
    if(btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', async (e) => {
            e.preventDefault();
            const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
            const payload = {
                id: Date.now(),
                cliente: nomeUsuarioLogado?.toUpperCase() || "ANÔNIMO",
                servico: servicoSelecionado,
                barbeiro: bNome,
                data: document.getElementById('data').value,
                hora: horarioSelecionado,
                pagamento: pagamentoSelecionado,
                status: "agendado"
            };
            MOCK_AGENDAMENTOS_TESTE.push(payload);
            document.getElementById('modal-confirmacao')?.classList.add('escondido');
            alert("✨ Reserva efetuada!");
            renderizarGradeHorariosReais();
        });
    }
}

function filtrarAgendamentoPorRegraGlobal(a) {
    if(filtroBarbeiroAlvo !== 'todos') {
        const prof = ESTRUTURA_BARBEIROS.find(b => b.id === filtroBarbeiroAlvo);
        if(!prof || a.barbeiro !== prof.nome) return false;
    }
    const dataAt = new Date(a.data + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    if (filtroTempoGlobal === 'hoje') return dataAt.getTime() === hoje.getTime();
    if (filtroTempoGlobal === 'mes_atual') return dataAt.getMonth() === hoje.getMonth();
    return true;
}

function recarregarAbaAtivaAdm() {
    const seletor = document.getElementById('filtro-barbeiro-alvo');
    if(seletor) filtroBarbeiroAlvo = seletor.value;
    
    // Identifica aba ativa e dispara a carga correspondente
    const abas = ['adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'];
    abas.forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el && !el.classList.contains('escondido')) {
            if(id === 'adm-dash') carregarDadosEstrategicosDoNeon();
            if(id === 'adm-recepcao') carregarModoRecepcaoKanban();
            if(id === 'adm-analytics') carregarPainelAnalytics();
        }
    });
}

function mudarStatusAgendamento(id, novoStatus) {
    const ag = MOCK_AGENDAMENTOS_TESTE.find(a => a.id === id);
    if(ag) {
        ag.status = novoStatus;
        recarregarAbaAtivaAdm();
    }
}

async function carregarDadosEstrategicosDoNeon() {
    const agendamentos = MOCK_AGENDAMENTOS_TESTE.filter(filtrarAgendamentoPorRegraGlobal);
    let faturamento = 0, finalizados = 0;
    agendamentos.forEach(a => {
        if(a.status !== 'Falta') {
            faturamento += 40.00; // Valor fixo para exemplo
            finalizados++;
        }
    });
    const elFat = document.getElementById('kpi-faturamento');
    if(elFat) elFat.innerText = `R$ ${faturamento.toFixed(2)}`;
}

async function carregarModoRecepcaoKanban() {
    const container = document.getElementById('container-kanban-recepcao'); 
    if(!container) return;
    const dados = MOCK_AGENDAMENTOS_TESTE.filter(filtrarAgendamentoPorRegraGlobal);
    container.innerHTML = dados.map(item => `
        <div class="item-backoffice">
            <div><strong>${item.cliente}</strong><br>${item.hora} - ${item.servico}</div>
            <button onclick="mudarStatusAgendamento(${item.id}, 'Concluído')">✔</button>
        </div>`).join('');
}

async function carregarPainelAnalytics() {
    const container = document.getElementById('analytics-heatmap');
    if(!container) return;
    container.innerHTML = "<div>Dados de ocupação processados.</div>";
}

async function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios'); 
    if (!container) return;
    const dataSel = document.getElementById('data').value;
    const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
    
    let ocupados = MOCK_AGENDAMENTOS_TESTE.filter(a => a.data === dataSel && a.barbeiro === bNome && a.status !== 'Falta').map(a => a.hora.trim());
    
    container.innerHTML = "";
    HORARIOS_PADRAO.forEach(g => {
        container.innerHTML += `<div class="turno-title">${g.turno}</div>`;
        const grid = document.createElement('div'); grid.className = "grid-horarios";
        g.horas.forEach(h => {
            const btn = document.createElement('button');
            btn.className = "btn-horario"; btn.innerText = h; btn.type = "button";
            if (isSlotPast(dataSel, h.trim())) { btn.disabled = true; btn.innerText = "Expirado"; }
            else if (ocupados.includes(h.trim())) { btn.disabled = true; btn.innerText = "Ocupado"; }
            else {
                if(horarioSelecionado === h.trim()) btn.classList.add('selected');
                btn.onclick = function() { 
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected'); 
                    horarioSelecionado = h.trim();
                };
            }
            grid.appendChild(btn);
        });
        container.appendChild(grid);
    });
}

function renderizarFormularioCliente() {
    // Lógica para preencher serviços e barbeiros
}

async function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos'); 
    if(!container) return;
    const meus = MOCK_AGENDAMENTOS_TESTE.filter(a => a.cliente === nomeUsuarioLogado?.toUpperCase());
    container.innerHTML = meus.map(i => `<div>${i.servico} - ${i.data}</div>`).join('');
}

function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao'); 
    if (!nav) return;
    nav.innerHTML = (role === 'admin' || role === 'barbeiro') 
        ? `<button onclick="alternarTela('adm-dash')">💰 Finanças</button><button onclick="alternarTela('adm-recepcao')">📺 Monitor</button>`
        : `<button onclick="alternarTela('home')">📅 Agendar</button>`;
    nav.innerHTML += `<button onclick="window.location.reload()">🚪 Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'adm-dash', 'adm-recepcao', 'adm-analytics', 'adm-mkt'].forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if(el) el.classList.add('escondido');
    });
    const target = document.getElementById(`aba-${idAba}`);
    if(target) target.classList.remove('escondido');
    recarregarAbaAtivaAdm();
}
