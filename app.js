/**
 * ARQUITETURA CORE INTEGRADA PROSPERAR CLUB
 * Sistema de Controle Baseado em Papéis (RBAC) & Gerenciamento Dinâmico de Equipes.
 */

const API_URL = "https://prosperar.onrender.com";

// Estado da Aplicação Autenticada
let usuarioLogado = null;
let perfilLogado = null;    // 'admin' | 'barbeiro' | 'cliente'
let nomeUsuarioLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

// Configurações de Filtros de Períodos e Profissional
let filtroTempoGlobal = 'mes_atual'; 
let filtroBarbeiroAlvo = 'todos'; // Armazena a ID do barbeiro selecionado no filtro
let dataFiltroInicio = new Date().toISOString().split('T')[0];
let dataFiltroFim = new Date().toISOString().split('T')[0];

const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00 },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00 },
    { id: "barba", nome: "Barba Completa", preco: 35.00 },
    { id: "combo", nome: "Combo Premium", preco: 85.00 }
];

// Banco Dinâmico de Barbeiros (Inicia com os fundadores)
let ESTRUTURA_BARBEIROS = [
    { id: "gabriel", login: "admin", nome: "Gabriel (Proprietário)", comissao: 0.50 },
    { id: "lucas", login: "lucasbarber", nome: "Lucas Barber", comissao: 0.40 }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

// Base Mockada Atualizada para simulação rica de filtros cruzados de barbeiro
const MOCK_AGENDAMENTOS_TESTE = [
    { id: 101, cliente: "MIGUEL ANJOS", servico: "Combo Premium", barbeiro: "Gabriel (Proprietário)", data: new Date().toISOString().split('T')[0], hora: "09:00", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 20.00, valor_gorjeta: 15.00 },
    { id: 102, cliente: "BRUNO SILVA", servico: "Corte Simples", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "10:30", pagamento: "Pix", status: "Concluído", valor_produtos: 0.00, valor_gorjeta: 5.00 },
    { id: 103, cliente: "CARLOS SOUZA", servico: "Barba Completa", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "14:00", pagamento: "Cartão de Débito", status: "Falta", valor_produtos: 0.00, valor_gorjeta: 0.00 },
    { id: 104, cliente: "ARTHUR REIS", servico: "Corte + Sobrancelha", barbeiro: "Gabriel (Proprietário)", data: (() => { let d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })(), hora: "16:00", pagamento: "Dinheiro", status: "Concluído", valor_produtos: 50.00, valor_gorjeta: 10.00 },
    { id: 105, cliente: "RODRIGO FARIA", servico: "Combo Premium", barbeiro: "Lucas Barber", data: (() => { let d = new Date(); d.setDate(d.getDate()-4); return d.toISOString().split('T')[0]; })(), hora: "18:30", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 10.00, valor_gorjeta: 0.00 }
];

document.addEventListener("DOMContentLoaded", () => {
    // Tenta carregar equipe customizada salva localmente caso exista
    if(localStorage.getItem("PROSPERAR_EQUIPE")) {
        ESTRUTURA_BARBEIROS = JSON.parse(localStorage.getItem("PROSPERAR_EQUIPE"));
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
    const dataDoSlot = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
    return dataDoSlot < agora;
}

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

/**
 * ATUALIZADOR DE COMPONENTES DE SELEÇÃO DE PROFISSIONAIS
 */
function atualizarSeletoresEFormulariosDeEquipe() {
    // 1. Atualizar o filtro global de barbeiros na Dashboard
    const seletorFiltro = document.getElementById('filtro-barbeiro-alvo');
    if(seletorFiltro) {
        seletorFiltro.innerHTML = '<option value="todos">-- Todos os Barbeiros (Geral) --</option>';
        ESTRUTURA_BARBEIROS.forEach(b => {
            seletorFiltro.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
    }

    // 2. Atualizar o seletor de barbeiros no formulário de Encaixe (Walk-in)
    const seletorEncaixe = document.getElementById('encaixe-barbeiro');
    if(seletorEncaixe) {
        seletorEncaixe.innerHTML = '';
        ESTRUTURA_BARBEIROS.forEach(b => {
            seletorEncaixe.innerHTML += `<option value="${b.nome}">${b.nome}</option>`;
        });
    }

    // 3. Atualizar a lista gerencial da aba administrativa
    const containerLista = document.getElementById('lista-equipe-cadastrada');
    if(containerLista) {
        containerLista.innerHTML = '';
        ESTRUTURA_BARBEIROS.forEach(b => {
            const item = document.createElement('div');
            item.className = 'item-backoffice';
            item.innerHTML = `
                <div>
                    <strong>${b.nome}</strong><br>
                    <span style="font-size:11px; color:var(--text-muted);">Usuário: ${b.login} | Split base: ${(b.comissao*100)}%</span>
                </div>
                ${b.id !== 'gabriel' ? `<button class="btn-small-danger" onclick="removerBarbeiroSistema('${b.id}')">Excluir</button>` : '<span style="font-size:10px; color:var(--accent-color);">Fundador</span>'}
            `;
            containerLista.appendChild(item);
        });
    }
}

/**
 * CONTROLE DA INCLUSÃO DE NOVOS BARBEIROS (CRUD)
 */
function incluirBarbeiroSistema() {
    const nome = document.getElementById('adm-barbeiro-nome').value.trim();
    const login = document.getElementById('adm-barbeiro-login').value.trim().toLowerCase();
    const senha = document.getElementById('adm-barbeiro-senha').value;
    const comissao = parseFloat(document.getElementById('adm-barbeiro-comissao').value);

    if(!nome || !login || !senha) return alert("Preencha todas as credenciais do novo barbeiro!");

    // Evitar colisões de IDs e logins
    const jaExiste = ESTRUTURA_BARBEIROS.some(b => b.login === login || b.nome.toLowerCase() === nome.toLowerCase());
    if(jaExiste) return alert("Erro: Já existe um profissional cadastrado com este nome ou login!");

    const novaId = "barber_" + Date.now();
    ESTRUTURA_BARBEIROS.push({
        id: novaId,
        login: login,
        senha: senha, // Senha operacional local
        nome: nome,
        comissao: comissao
    });

    localStorage.setItem("PROSPERAR_EQUIPE", JSON.stringify(ESTRUTURA_BARBEIROS));
    alert(`✨ ${nome} foi introduzido na equipe e já pode efetuar login.`);
    
    document.getElementById('adm-barbeiro-nome').value = '';
    document.getElementById('adm-barbeiro-login').value = '';
    document.getElementById('adm-barbeiro-senha').value = '';

    atualizarSeletoresEFormulariosDeEquipe();
    recarregarAbaAtivaAdm();
}

function removerBarbeiroSistema(id) {
    if(!confirm("Deseja realmente remover este barbeiro da sua equipe? Ele perderá o acesso imediato ao painel.")) return;

    ESTRUTURA_BARBEIROS = ESTRUTURA_BARBEIROS.filter(b => b.id !== id);
    localStorage.setItem("PROSPERAR_EQUIPE", JSON.stringify(ESTRUTURA_BARBEIROS));
    
    atualizarSeletoresEFormulariosDeEquipe();
    recarregarAbaAtivaAdm();
}

/**
 * FLUXO DE LOGIN COM TRATAMENTO RBAC AVANÇADO
 */
async function executarLogin() {
    const loginInserido = document.getElementById('login-usuario').value.trim().toLowerCase();
    const senhaInserida = document.getElementById('login-senha').value;

    if(!loginInserido || !senhaInserida) return alert("Preencha os campos de acesso.");

    // 1. Verificação se é um barbeiro do corpo técnico dinâmico
    const barbeiroAlvo = ESTRUTURA_BARBEIROS.find(b => b.login === loginInserido);
    if(barbeiroAlvo) {
        // Se for o Gabriel fundador original, assume o papel mestre 'admin'
        if(barbeiroAlvo.id === 'gabriel') {
            perfilLogado = 'admin';
        } else {
            // Se for outro profissional criado, confere a senha local operacional
            if(barbeiroAlvo.senha && barbeiroAlvo.senha !== senhaInserida) {
                return alert("Senha operacional incorreta para este barbeiro.");
            }
            perfilLogado = 'barbeiro';
        }
        usuarioLogado = barbeiroAlvo.login;
        nomeUsuarioLogado = barbeiroAlvo.nome;

        ativarAcessoAoPainelProfissional();
        return;
    }

    // 2. Fallback para Clientes Normais integrados via API externa Render
    try {
        const res = await fetch(`${API_URL}/usuarios/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ login: loginInserido, senha: senhaInserida })
        });

        if(res.ok) {
            const user = await res.json();
            usuarioLogado = user.login;
            perfilLogado = user.perfil; // 'admin' ou 'cliente'
            nomeUsuarioLogado = user.nome;

            ativarAcessoAoPainelProfissional();
        } else {
            alert("Acesso negado. Credenciais inválidas.");
        }
    } catch(e) {
        alert("Falha de rede. Use uma credencial de barbeiro cadastrada.");
    }
}

function ativarAcessoAoPainelProfissional() {
    document.getElementById('tela-autenticacao').classList.add('escondido');
    document.getElementById('conteudo-app').classList.remove('escondido');

    montarMenuNavegacao(perfilLogado);
    
    // Tratamento estrito de interface para Colaboradores (Esconde dados macro da empresa)
    if(perfilLogado === 'barbeiro') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.add('escondido'));
        document.getElementById('card-rendimentos-barbeiro').classList.remove('escondido');
        
        // Trava o seletor de filtros na ID do próprio barbeiro logado
        const barbeiroInfo = ESTRUTURA_BARBEIROS.find(b => b.login === usuarioLogado);
        if(barbeiroInfo) {
            filtroBarbeiroAlvo = barbeiroInfo.id;
            const seletor = document.getElementById('filtro-barbeiro-alvo');
            if(seletor) {
                seletor.value = barbeiroInfo.id;
                seletor.disabled = true; // Impede o barbeiro de bisbilhotar o geral ou outros
            }
        }
    } else if(perfilLogado === 'admin') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.remove('escondido'));
        document.getElementById('card-rendimentos-barbeiro').classList.add('escondido');
        const seletor = document.getElementById('filtro-barbeiro-alvo');
        if(seletor) { seletor.disabled = false; seletor.value = 'todos'; filtroBarbeiroAlvo = 'todos'; }
    }

    direcionarFluxoInicial(perfilLogado, nomeUsuarioLogado);
    inicializarListenersPosLogin();
}

function direcionarFluxoInicial(perfil, nomeUsuario) {
    if(perfil === 'admin' || perfil === 'barbeiro') {
        document.getElementById('bloco-filtros-global-adm').classList.remove('escondido');
        alternarTela('adm-dash');
    } else {
        document.getElementById('bloco-filtros-global-adm').classList.add('escondido');
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${nomeUsuario}!`;
        renderizarFormularioCliente();
    }
}

function inicializarListenersPosLogin() {
    const inputData = document.getElementById('data');
    if(inputData) {
        inputData.addEventListener('change', () => {
            if (barbeiroSelecionado) renderizarGradeHorariosReais();
        });
    }

    const btnPreAgendar = document.getElementById('btnPreAgendar');
    if(btnPreAgendar) {
        btnPreAgendar.addEventListener('click', (e) => {
            e.preventDefault();
            if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
                return alert("Selecione todos os parâmetros antes de avançar.");
            }
            const dataSelecionada = document.getElementById('data').value;
            
            document.getElementById('modal-resumo-detalhes').innerHTML = `
                <strong>Procedimento:</strong> ${servicoSelecionado}<br>
                <strong>Profissional:</strong> ${ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome}<br>
                <strong>Data/Hora:</strong> ${dataSelecionada} às ${horarioSelecionado}<br>
                <span style="color:var(--success-color); font-weight:bold;">Valor: R$ ${precoServico.toFixed(2)}</span>
            `;
            document.getElementById('modal-confirmacao').classList.remove('escondido');
        });
    }

    const btnConfirmarModal = document.getElementById('btn-confirmar-modal');
    if(btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', async () => {
            const dataSelecionada = document.getElementById('data').value;
            const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
            
            const payload = {
                cliente: nomeUsuarioLogado ? nomeUsuarioLogado.toUpperCase() : "CLIENTE AVULSO",
                servico: servicoSelecionado,
                barbeiro: bNome,
                data: dataSelecionada,
                hora: horarioSelecionado,
                pagamento: pagamentoSelecionado,
                status: "agendado",
                valor_produtos: 0.00,
                valor_gorjeta: 0.00
            };

            MOCK_AGENDAMENTOS_TESTE.push(payload);
            document.getElementById('modal-confirmacao').classList.add('escondido');
            alert("✨ Reserva efetuada com sucesso!");
            renderizarGradeHorariosReais();
        });
    }
}

/**
 * FILTRAGEM MULTI-FATORIAL CORE (TEMPO X PROFISSIONAL)
 */
function filtrarAgendamentoPorRegraGlobal(a) {
    // 1. Filtro do Barbeiro Selecionado
    if(filtroBarbeiroAlvo !== 'todos') {
        const profissionalAlvo = ESTRUTURA_BARBEIROS.find(b => b.id === filtroBarbeiroAlvo);
        if(!profissionalAlvo || a.barbeiro !== profissionalAlvo.nome) {
            return false;
        }
    }

    // 2. Filtro do Período do Calendário
    const dataAtendimento = new Date(a.data + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    if (filtroTempoGlobal === 'hoje') return dataAtendimento.getTime() === hoje.getTime();
    if (filtroTempoGlobal === 'ontem') {
        const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
        return dataAtendimento.getTime() === ontem.getTime();
    }
    if (filtroTempoGlobal === '7dias') {
        const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 7);
        return dataAtendimento >= seteDiasAtras && dataAtendimento <= hoje;
    }
    if (filtroTempoGlobal === 'mes_atual') return dataAtendimento.getMonth() === hoje.getMonth() && dataAtendimento.getFullYear() === hoje.getFullYear();
    if (filtroTempoGlobal === 'personalizado') {
        const dInicio = new Date(dataFiltroInicio + 'T00:00:00');
        const dFim = new Date(dataFiltroFim + 'T00:00:00');
        return dataAtendimento >= dInicio && dataAtendimento <= dFim;
    }
    return true;
}

function mudarFiltroGlobalAdm(periodo, elementoClicado) {
    filtroTempoGlobal = periodo;
    document.querySelectorAll('.btn-filtro-tempo').forEach(b => b.classList.remove('ativo'));
    if (elementoClicado) elementoClicado.classList.add('ativo');

    const seletorData = document.getElementById('box-escolha-data-custom');
    if (periodo === 'personalizado') seletorData.classList.remove('escondido');
    else seletorData.classList.add('escondido');

    recarregarAbaAtivaAdm();
}

function atualizarFiltroDataRange() {
    dataFiltroInicio = document.getElementById('filtro-data-inicio').value;
    dataFiltroFim = document.getElementById('filtro-data-fim').value;
    recarregarAbaAtivaAdm();
}

function recarregarAbaAtivaAdm() {
    // Captura qual das abas operacionais está aberta no momento
    const abas = ['adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'];
    let abaAtiva = 'adm-dash';
    abas.forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el && !el.classList.contains('escondido')) abaAtiva = id;
    });

    // Sincroniza a ID de filtro caso o seletor esteja ativo na tela
    const seletor = document.getElementById('filtro-barbeiro-alvo');
    if(seletor) filtroBarbeiroAlvo = seletor.value;

    if(abaAtiva === 'adm-dash') carregarDadosEstrategicosDoNeon();
    if(abaAtiva === 'adm-mkt' && perfilLogado === 'admin') carregarListaMarketingReal();
    if(abaAtiva === 'adm-recepcao') carregarModoRecepcaoKanban();
    if(abaAtiva === 'adm-analytics') carregarPainelAnalytics();
}

/**
 * ENGINE ANALÍTICA OPERACIONAL DE CÁLCULO FINANCEIRO
 */
async function carregarDadosEstrategicosDoNeon() {
    try {
        let todosAgendamentos = [];
        try {
            const res = await fetch(`${API_URL}/agendamentos`);
            if(res.ok) todosAgendamentos = await res.json();
        } catch(e) { todosAgendamentos = MOCK_AGENDAMENTOS_TESTE; }

        // Executa a filtragem unificada (Barbeiro + Tempo)
        const agendamentos = todosAgendamentos.filter(filtrarAgendamentoPorRegraGlobal);

        let faturamentoTotal = 0;
        let faturamentoServicosBrutos = 0;
        let faturamentoProdutosBrutos = 0;
        let contagemCortesConcluidos = 0;
        let totalFaltasNoShow = 0;

        // Dicionário reativo para apuração de split de comissões por barbeiro vivo no sistema
        let balançoEquipe = {};
        ESTRUTURA_BARBEIROS.forEach(b => {
            balançoEquipe[b.nome] = { servicosLiquidos: 0, produtos: 0, gorjetas: 0, totalPagar: 0, rateioComissao: b.comissao };
        });

        agendamentos.forEach(a => {
            const serv = ESTRUTURA_SERVICOS.find(s => s.nome === a.servico);
            const valorServico = serv ? serv.preco : 40.00;
            const valorProd = parseFloat(a.valor_produtos || 0);
            const valorGorjeta = parseFloat(a.valor_gorjeta || 0);
            
            const forma = String(a.pagamento || 'Pix').toLowerCase();
            const taxaMaquininha = (forma.includes('cartao') || forma.includes('credito') || forma.includes('debito')) ? 0.025 : 0.00;
            const valorServicoLiquido = valorServico - (valorServico * taxaMaquininha);

            if(a.status !== 'Falta' && a.status !== 'cancelado' && a.status !== 'no_show') {
                faturamentoServicosBrutos += valorServico;
                faturamentoProdutosBrutos += valorProd;
                faturamentoTotal += (valorServico + valorProd + valorGorjeta);
                contagemCortesConcluidos++;
                
                if(balançoEquipe[a.barbeiro]) {
                    balançoEquipe[a.barbeiro].servicosLiquidos += (valorServicoLiquido * balançoEquipe[a.barbeiro].rateioComissao);
                    balançoEquipe[a.barbeiro].produtos += (valorProd * 0.10); // 10% fixo em venda de produtos
                    balançoEquipe[a.barbeiro].gorjetas += valorGorjeta; // 100% repassado ao barbeiro
                }
            } else {
                totalFaltasNoShow++;
            }
        });

        // 1. Atualizar Painel Global (Visão Admin)
        document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
        const ticketMedio = contagemCortesConcluidos > 0 ? (faturamentoServicosBrutos / contagemCortesConcluidos) : 0;
        document.getElementById('kpi-ticket').innerText = `R$ ${ticketMedio.toFixed(2)}`;
        document.getElementById('kpi-ocupacao').innerText = contagemCortesConcluidos;
        const taxaNoShow = agendamentos.length > 0 ? ((totalFaltasNoShow / agendamentos.length) * 100) : 0;
        document.getElementById('kpi-noshow').innerText = `${taxaNoShow.toFixed(1)}%`;

        document.getElementById('detalhe-servicos').innerText = `Serviços Brutos: R$ ${faturamentoServicosBrutos.toFixed(2)}`;
        document.getElementById('detalhe-produtos').innerText = `Produtos Brutos: R$ ${faturamentoProdutosBrutos.toFixed(2)}`;

        // Renderizar Split Real da Equipe de Administrador
        const containerSplit = document.getElementById('lista-split-comissoes-equipe');
        if(containerSplit) {
            containerSplit.innerHTML = '';
            for(let profissional in balançoEquipe) {
                const b = balançoEquipe[profissional];
                b.totalPagar = b.servicosLiquidos + b.produtos + b.gorjetas;

                const itemHtml = document.createElement('div');
                itemHtml.className = 'item-backoffice';
                itemHtml.innerHTML = `
                    <div>
                        <strong>${profissional}</strong><br>
                        <span style="font-size:11px; color:var(--text-muted);">Serv: R$ ${b.servicosLiquidos.toFixed(2)} | Prod: R$ ${b.produtos.toFixed(2)} | Gorj: R$ ${b.gorjetas.toFixed(2)}</span>
                    </div>
                    <div style="color: var(--success-color); font-weight:800; font-size: 15px;">R$ ${b.totalPagar.toFixed(2)}</div>
                `;
                containerSplit.appendChild(itemHtml);
            }
        }

        // 2. Atualizar Carteira de Rendimentos Privada (Visão Barbeiro Colaborador)
        if(perfilLogado === 'barbeiro') {
            const profissionalLogadoInfo = ESTRUTURA_BARBEIROS.find(b => b.login === usuarioLogado);
            if(profissionalLogadoInfo && balançoEquipe[profissionalLogadoInfo.nome]) {
                const dadosRendimento = balançoEquipe[profissionalLogadoInfo.nome];
                document.getElementById('minha-comissao-total').innerText = `R$ ${dadosRendimento.totalPagar.toFixed(2)}`;
                document.getElementById('minha-breakdown-comissao').innerText = `Serviços: R$ ${dadosRendimento.servicosLiquidos.toFixed(2)} | Produtos: R$ ${dadosRendimento.produtos.toFixed(2)} | Gorjetas: R$ ${dadosRendimento.gorjetas.toFixed(2)}`;
            }
        }

    } catch(e) { console.error(e); }
}

async function carregarModoRecepcaoKanban() {
    const container = document.getElementById('container-kanban-recepcao');
    if(!container) return;

    try {
        let dados = [];
        try {
            const res = await fetch(`${API_URL}/agendamentos`);
            if(res.ok) dados = await res.json();
        } catch(e) { dados = MOCK_AGENDAMENTOS_TESTE; }

        // Aplica filtro cruzado tempo + profissional logado ou selecionado
        const dadosFiltrados = dados.filter(filtrarAgendamentoPorRegraGlobal);

        container.innerHTML = "";
        if(dadosFiltrados.length === 0) {
            container.innerHTML = "<p style='color:var(--text-muted); text-align:center; padding: 15px;'>Nenhum agendamento encontrado.</p>";
            return;
        }

        dadosFiltrados.forEach(item => {
            const div = document.createElement('div');
            div.className = "item-backoffice";
            let corBorda = item.status === 'Concluído' ? "var(--success-color)" : (item.status === 'Falta' ? "var(--danger-color)" : "var(--accent-color)");

            div.style.borderLeft = `4px solid ${corBorda}`;
            div.innerHTML = `
                <div>
                    <strong>👤 ${item.cliente} (${item.status})</strong><br>
                    <span style="font-size:12px; color:var(--text-muted);">${item.servico} - ${item.hora} [Prof: ${item.barbeiro}]</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-status" style="background:var(--success-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Concluído')">✔</button>
                    <button class="btn-status" style="background:var(--danger-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Falta')">✖</button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch(e) { container.innerHTML = "<p>Erro ao ler monitor.</p>"; }
}

async function carregarPainelAnalytics() {
    const containerMapa = document.getElementById('analytics-heatmap');
    const containerRetencao = document.getElementById('analytics-retencao');
    const containerDiasSemana = document.getElementById('analytics-dias-semana');
    
    if(!containerMapa) return;

    try {
        let todosAgendamentos = [];
        try {
            const res = await fetch(`${API_URL}/agendamentos`);
            if(res.ok) todosAgendamentos = await res.json();
        } catch(e) { todosAgendamentos = MOCK_AGENDAMENTOS_TESTE; }

        const agendamentos = todosAgendamentos.filter(filtrarAgendamentoPorRegraGlobal);

        const turnosContagem = { "Manhã": 0, "Tarde": 0, "Noite": 0 };
        const volumeDiasSemana = { "Segunda-feira": 0, "Terça-feira": 0, "Quarta-feira": 0, "Quinta-feira": 0, "Sexta-feira": 0, "Sábado": 0, "Domingo": 0 };
        const nomesDias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

        agendamentos.forEach(a => {
            const hora = parseInt(String(a.hora).split(':')[0]);
            if(hora >= 9 && hora < 12) turnosContagem["Manhã"]++;
            else if(hora >= 12 && hora < 18) turnosContagem["Tarde"]++;
            else if(hora >= 18) turnosContagem["Noite"]++;

            const dataObj = new Date(a.data + 'T00:00:00');
            const nomeDia = nomesDias[dataObj.getDay()];
            if(volumeDiasSemana[nomeDia] !== undefined) volumeDiasSemana[nomeDia]++;
        });

        containerMapa.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; background: #111; padding: 15px; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between;"><span>🌅 Manhã:</span> <strong>${turnosContagem['Manhã']} cortes</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>🌤️ Tarde:</span> <strong>${turnosContagem['Tarde']} cortes</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>🌙 Noite:</span> <strong>${turnosContagem['Noite']} cortes</strong></div>
            </div>
        `;

        if(containerDiasSemana) {
            let htmlDias = `<div style="display: flex; flex-direction: column; gap: 8px; background: #111; padding: 15px; border-radius: 8px;">`;
            for(let dia in volumeDiasSemana) {
                const totalCortes = volumeDiasSemana[dia];
                const porcentagemBarra = agendamentos.length > 0 ? Math.min((totalCortes / agendamentos.length) * 100, 100) : 0;
                htmlDias += `
                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:12px;"><span>${dia}:</span><strong>${totalCortes}</strong></div>
                        <div style="width:100%; background:#222; height:4px; border-radius:2px; overflow:hidden; margin-top:2px;">
                            <div style="width:${porcentagemBarra}%; background:var(--accent-color); height:100%;"></div>
                        </div>
                    </div>
                `;
            }
            containerDiasSemana.innerHTML = htmlDias + `</div>`;
        }

        const clientesUnicos = [...new Set(agendamentos.map(a => a.cliente))];
        let recorrentes = 0;
        clientesUnicos.forEach(c => { if(agendamentos.filter(a => a.cliente === c).length > 1) recorrentes++; });

        if(containerRetencao) {
            containerRetencao.innerHTML = `
                <div class="card" style="text-align:center; margin-bottom: 0px; width:100%;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--accent-color);">${clientesUnicos.length > 0 ? Math.round((recorrentes / clientesUnicos.length) * 100) : 0}%</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Taxa de Retenção do Profissional</div>
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

async function mudarStatusAgendamento(id, novoStatus) {
    const item = MOCK_AGENDAMENTOS_TESTE.find(a => a.id === id);
    if(item) item.status = novoStatus;
    recarregarAbaAtivaAdm();
}

async function renderGradeHorariosReais() {
    // Código de exibição da agenda para o cliente baseado no profissional escolhido...
    renderizarGradeHorariosReais();
}

async function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios');
    if (!container) return;
    if (!barbeiroSelecionado) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:13px; text-align:center;'>⚠️ Escolha o profissional acima para abrir os horários livres.</p>";
        return;
    }

    const dataSelecionada = document.getElementById('data').value;
    const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
    
    let ocupados = MOCK_AGENDAMENTOS_TESTE
        .filter(a => a.data === dataSelecionada && a.barbeiro === bNome && a.status !== 'Falta' && a.status !== 'cancelado')
        .map(a => String(a.hora).trim());

    container.innerHTML = "";
    HORARIOS_PADRAO.forEach(g => {
        const box = document.createElement('div');
        box.innerHTML = `<div class="turno-title">${g.turno}</div>`;
        const grid = document.createElement('div'); grid.className = "grid-horarios";

        g.horas.forEach(h => {
            const btn = document.createElement('button'); btn.className = "btn-horario"; btn.innerText = h;
            const jaPassou = isSlotPast(dataSelecionada, h.trim());
            const jaOcupado = ocupados.includes(h.trim());

            if (jaPassou) {
                btn.disabled = true; btn.style.opacity = "0.3"; btn.innerText = "Expirado";
            } else if (jaOcupado) {
                btn.disabled = true; btn.innerText = "Ocupado";
            } else {
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado'); horarioSelecionado = h;
                };
            }
            grid.appendChild(btn);
        });
        box.appendChild(grid); container.appendChild(box);
    });
}

function renderizarFormularioCliente() {
    const box = document.getElementById('container-servicos'); box.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div class="title">${s.nome}</div><div class="price">R$ ${s.preco.toFixed(2)}</div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-servicos .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected'); servicoSelecionado = s.nome; precoServico = s.preco;
        };
        box.appendChild(div);
    });

    const boxB = document.getElementById('container-barbeiros'); boxB.innerHTML = "";
    ESTRUTURA_BARBEIROS.forEach(b => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div><div class="title">${b.nome}</div></div>`;
        div.onclick = () => {
            document.querySelectorAll('#container-barbeiros .modern-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected'); barbeiroSelecionado = b.id; renderizarGradeHorariosReais();
        };
        boxB.appendChild(div);
    });

    const boxP = document.getElementById('container-pagamentos'); boxP.innerHTML = "";
    ["Pix", "Cartão de Crédito", "Cartão de Débito"].forEach(p => {
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

async function carregarListaMarketingReal() {
    const container = document.getElementById('lista-marketing-clientes');
    if(!container) return;
    container.innerHTML = "<p style='color:var(--text-muted); font-size:12px;'>Disponível apenas para administração central.</p>";
}

function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    if (!nav) return;

    if (role === 'admin' || role === 'barbeiro') {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('adm-dash')">💰 Finanças</button>
            ${role === 'admin' ? `<button class="nav-item" onclick="alternarTela('adm-mkt')">📢 CRM</button>` : ''}
            <button class="nav-item" onclick="alternarTela('adm-recepcao')">📺 Monitor</button>
            <button class="nav-item" onclick="alternarTela('adm-analytics')">📊 BI Analítico</button>
        `;
    } else {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('home')">📅 Agendar</button>
            <button class="nav-item" onclick="alternarTela('estilo')">🗂️ Reservas</button>
        `;
    }
    nav.innerHTML += `<button class="nav-item" style="color:var(--danger-color)" onclick="window.location.reload()">🚪 Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'estilo', 'adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'].forEach(id => {
        const el = document.getElementById(`aba-${id}`); if (el) el.classList.add('escondido');
    });
    const abaAlvo = document.getElementById(`aba-${idAba}`); if (abaAlvo) abaAlvo.classList.remove('escondido');
    document.querySelectorAll('.nav-inferior .nav-item').forEach(btn => btn.classList.remove('ativo'));

    recarregarAbaAtivaAdm();
}

async function executarCadastro() {
    alert("Inscrição de novos clientes encaminhada para validação.");
}
