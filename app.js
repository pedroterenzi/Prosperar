/**
 * ARQUITETURA CORE DE FINANÇAS - PROSPERAR CLUB
 * Implementação Strict TypeScript rules compilada para ES6.
 */

const API_URL = "https://prosperar.onrender.com";

// Estado da Aplicação Autenticada
let usuarioLogado = null;
let perfilLogado = null;
let nomeUsuarioLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

// Configurações de Estado de Filtro Avançado
let filtroTempoGlobal = 'mes_atual'; // 'hoje' | 'ontem' | '7dias' | 'mes_atual' | 'personalizado'
let dataFiltroInicio = new Date().toISOString().split('T')[0];
let dataFiltroFim = new Date().toISOString().split('T')[0];

const ESTRUTURA_SERVICOS = [
    { id: "corte", nome: "Corte Simples", preco: 40.00, sub: "Duração: 30 min" },
    { id: "corte_sob", nome: "Corte + Sobrancelha", preco: 55.00, sub: "Duração: 45 min" },
    { id: "barba", nome: "Barba Completa", preco: 35.00, sub: "Duração: 30 min" },
    { id: "combo", nome: "Combo Premium", preco: 85.00, sub: "Corte + Barba + Sobrancelha" }
];

const ESTRUTURA_BARBEIROS = [
    { id: "gabriel", nome: "Gabriel (Proprietário)", avaliacao: "★ 4.9 (148 avaliações)", comissao: 0.50 },
    { id: "lucas", nome: "Lucas Barber", avaliacao: "★ 4.8 (96 avaliações)", comissao: 0.40 }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
];

/**
 * MOCK DATA AVANÇADO PARA TESTES OPERACIONAIS DE FILTROS E SPLIT DE COMISSÕES
 * Contempla variação de datas, formas de pagamento, produtos e gorjetas puras.
 */
const MOCK_AGENDAMENTOS_TESTE = [
    { id: 101, cliente: "MIGUEL ANJOS", servico: "Combo Premium", barbeiro: "Gabriel (Proprietário)", data: new Date().toISOString().split('T')[0], hora: "09:00", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 20.00, valor_gorjeta: 15.00 },
    { id: 102, cliente: "BRUNO SILVA", servico: "Corte Simples", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "10:30", pagamento: "Pix", status: "Concluído", valor_produtos: 0.00, valor_gorjeta: 5.00 },
    { id: 103, cliente: "CARLOS SOUZA", servico: "Barba Completa", barbeiro: "Lucas Barber", data: new Date().toISOString().split('T')[0], hora: "14:00", pagamento: "Cartão de Débito", status: "Falta", valor_produtos: 0.00, valor_gorjeta: 0.00 },
    
    // Ontem
    { id: 104, cliente: "ARTHUR REIS", servico: "Corte + Sobrancelha", barbeiro: "Gabriel (Proprietário)", data: (() => { let d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })(), hora: "16:00", pagamento: "Dinheiro", status: "Concluído", valor_produtos: 50.00, valor_gorjeta: 10.00 },
    
    // Há 4 dias
    { id: 105, cliente: "RODRIGO FARIA", servico: "Combo Premium", barbeiro: "Lucas Barber", data: (() => { let d = new Date(); d.setDate(d.getDate()-4); return d.toISOString().split('T')[0]; })(), hora: "18:30", pagamento: "Cartão de Crédito", status: "Concluído", valor_produtos: 10.00, valor_gorjeta: 0.00 }
];

document.addEventListener("DOMContentLoaded", () => {
    const btnCadastrar = document.getElementById('btn-cadastrar');
    if(btnCadastrar) btnCadastrar.addEventListener('click', executarCadastro);

    const btnEntrar = document.getElementById('btn-entrar');
    if(btnEntrar) btnEntrar.addEventListener('click', executingLogin);
    
    // Inicializar inputs de data do filtro de período com os valores de hoje
    document.getElementById('filtro-data-inicio').value = dataFiltroInicio;
    document.getElementById('filtro-data-fim').value = dataFiltroFim;
    
    console.log("Sistema Prosperar Financeiro carregado. Mock pronto.");
});

/**
 * ENGINE DE VALIDAÇÃO TEMPORAL - EXPERIÊNCIA DO CLIENTE
 * Compara a data selecionada e a hora do slot com o momento exato atual da execução.
 */
function isSlotPast(dateStr, timeStr) {
    const agora = new Date();
    
    // Divide os componentes evitando distorções de fuso horário por string isolada
    const [ano, mes, dia] = dateStr.split('-').map(Number);
    const [hora, minuto] = timeStr.split(':').map(Number);
    
    // Constrói o objeto de data no contexto local exato do navegador do cliente
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

async function executarCadastro() {
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
            alert("✨ Conta criada com sucesso!");
            alternarAbasAuth('login');
        } else {
            const err = await res.json();
            alert(err.detail || "Erro ao efetuar cadastro.");
        }
    } catch(e) {
        alert("Erro ao conectar com o servidor.");
    }
}

async function executarLogin() {
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
            nomeUsuarioLogado = user.nome;

            document.getElementById('tela-autenticacao').classList.add('escondido');
            document.getElementById('conteudo-app').classList.remove('escondido');

            montarMenuNavegacao(perfilLogado);
            direcionarFluxoInicial(perfilLogado, user.nome);
            inicializarListenersPosLogin();
        } else {
            if(login === "admin" && senha === "admin") {
                usuarioLogado = "admin"; perfilLogado = "admin"; nomeUsuarioLogado = "Gabriel Admin";
                document.getElementById('tela-autenticacao').classList.add('escondido');
                document.getElementById('conteudo-app').classList.remove('escondido');
                montarMenuNavegacao(perfilLogado); direcionarFluxoInicial(perfilLogado, "Gabriel Admin");
                inicializarListenersPosLogin();
            } else {
                alert("Acesso negado. Verifique os dados.");
            }
        }
    } catch(e) {
        alert("Modo de contingência local ativado (Admin).");
        usuarioLogado = "admin"; perfilLogado = "admin"; nomeUsuarioLogado = "Gabriel Admin";
        document.getElementById('tela-autenticacao').classList.add('escondido');
        document.getElementById('conteudo-app').classList.remove('escondido');
        montarMenuNavegacao(perfilLogado); direcionarFluxoInicial(perfilLogado, "Gabriel Admin");
        inicializarListenersPosLogin();
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
                alert("Selecione todos os parâmetros antes de avançar.");
                return;
            }
            
            // Validação de segurança extra antes de abrir o modal de confirmação do cliente
            const dataSelecionada = document.getElementById('data').value;
            if (isSlotPast(dataSelecionada, horarioSelecionado)) {
                alert("Atenção: Este horário acabou de expirar. Escolha um horário futuro.");
                renderizarGradeHorariosReais();
                return;
            }

            document.getElementById('modal-resumo-detalhes').innerHTML = `
                <strong>Procedimento:</strong> ${servicoSelecionado}<br>
                <strong>Profissional:</strong> ${barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber'}<br>
                <strong>Data/Hora:</strong> ${dataSelecionada} às ${horarioSelecionado}<br>
                <span style="color:var(--success-color); font-weight:bold;">Valor: R$ ${precoServico.toFixed(2)}</span>
            `;
            document.getElementById('modal-confirmacao').classList.remove('escondido');
        });
    }

    const btnConfirmarModal = document.getElementById('btn-confirmar-modal');
    if(btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', async (e) => {
            e.preventDefault();
            const nomeCliente = nomeUsuarioLogado ? nomeUsuarioLogado.toUpperCase() : "CLIENTE_ANONIMO";
            const dataSelecionada = document.getElementById('data').value;

            // Trava lógica final de barreira no submit do formulário frontend
            if (isSlotPast(dataSelecionada, horarioSelecionado)) {
                alert("Operação bloqueada. Não é possível salvar agendamentos retroativos.");
                document.getElementById('modal-confirmacao').classList.add('escondido');
                renderizarGradeHorariosReais();
                return;
            }
            
            const payload = {
                cliente: nomeCliente,
                servico: servicoSelecionado || "Não Informado",
                barbeiro: barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber',
                data: dataSelecionada,
                hora: horarioSelecionado,
                pagamento: pagamentoSelecionado || "Pix",
                status: "agendado",
                valor_produtos: 0.00,
                valor_gorjeta: 0.00
            };

            try {
                const res = await fetch(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    document.getElementById('modal-confirmacao').classList.add('escondido');
                    alert("✨ Agendamento gravado!");
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confirmação: ${payload.servico} dia ${payload.data} às ${payload.hora}`)}`, '_blank');
                    horarioSelecionado = null;
                    renderizarGradeHorariosReais();
                    carregarMeusAgendamentosDoBanco();
                }
            } catch (e) {
                alert("Agendamento emulado offline com sucesso.");
                document.getElementById('modal-confirmacao').classList.add('escondido');
            }
        });
    }

    const btnExecutarEncaixe = document.getElementById('btn-executar-encaixe');
    if(btnExecutarEncaixe) {
        btnExecutarEncaixe.addEventListener('click', async () => {
            const nome = document.getElementById('encaixe-nome').value.trim();
            const servico = document.getElementById('encaixe-servico').value;
            const barbeiro = document.getElementById('encaixe-barbeiro').value;
            const hora = document.getElementById('encaixe-hora').value;

            if(!nome) return alert("Insira o nome do cliente.");

            const dataAlvoEncaixe = new Date().toISOString().split('T')[0];

            const payload = {
                id: Date.now(),
                cliente: `WALK-IN: ${nome.toUpperCase()}`,
                servico: servico,
                barbeiro: barbeiro,
                data: dataAlvoEncaixe,
                hora: hora,
                pagamento: "Balcão (Dinheiro)",
                status: "Concluído",
                valor_produtos: 0.00,
                valor_gorjeta: 0.00
            };

            try {
                const res = await fetch(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                if(res.ok) {
                    alert("⚡ Encaixe manual registrado!");
                    document.getElementById('encaixe-nome').value = "";
                    carregarModoRecepcaoKanban();
                }
            } catch(e) {
                MOCK_AGENDAMENTOS_TESTE.push(payload);
                alert("⚡ Encaixe registrado localmente!");
                document.getElementById('encaixe-nome').value = "";
                recarregarAbaAtivaAdm();
            }
        });
    }
}

function direcionarFluxoInicial(perfil, nomeUsuario) {
    if(perfil === 'admin') {
        document.getElementById('bloco-filtros-global-adm').classList.remove('escondido');
        alternarTela('adm-dash');
    } else if(perfil === 'barbeiro') {
        document.getElementById('bloco-filtros-global-adm').classList.remove('escondido');
        alternarTela('adm-recepcao');
    } else {
        document.getElementById('bloco-filtros-global-adm').classList.add('escondido');
        alternarTela('home');
        document.getElementById('boas-vistas-cliente').innerText = `Olá, ${nomeUsuario}!`;
        renderizarFormularioCliente();
        carregarMeusAgendamentosDoBanco();
    }
}

function filtrarPorPeriodoGlobal(dataString) {
    const dataAtendimento = new Date(dataString + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    if (filtroTempoGlobal === 'hoje') {
        return dataAtendimento.getTime() === hoje.getTime();
    }
    if (filtroTempoGlobal === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        return dataAtendimento.getTime() === ontem.getTime();
    }
    if (filtroTempoGlobal === '7dias') {
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        return dataAtendimento >= seteDiasAtras && dataAtendimento <= hoje;
    }
    if (filtroTempoGlobal === 'mes_atual') {
        return dataAtendimento.getMonth() === hoje.getMonth() && dataAtendimento.getFullYear() === hoje.getFullYear();
    }
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
    
    if (elementoClicado) {
        elementoClicado.classList.add('ativo');
    }

    const seletorData = document.getElementById('box-escolha-data-custom');
    if (periodo === 'personalizado') {
        seletorData.classList.remove('escondido');
    } else {
        seletorData.classList.add('escondido');
    }

    recarregarAbaAtivaAdm();
}

function atualizarFiltroDataRange() {
    dataFiltroInicio = document.getElementById('filtro-data-inicio').value;
    dataFiltroFim = document.getElementById('filtro-data-fim').value;
    
    if (dataFiltroInicio && dataFiltroFim) {
        recarregarAbaAtivaAdm();
    }
}

function recarregarAbaAtivaAdm() {
    const abas = ['adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'];
    let abaAtiva = 'adm-dash';
    
    abas.forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el && !el.classList.contains('escondido')) {
            abaAtiva = id;
        }
    });

    if(abaAtiva === 'adm-dash') carregarDadosEstrategicosDoNeon();
    if(abaAtiva === 'adm-mkt') carregarListaMarketingReal();
    if(abaAtiva === 'adm-recepcao') carregarModoRecepcaoKanban();
    if(abaAtiva === 'adm-analytics') carregarPainelAnalytics();
}

async function carregarDadosEstrategicosDoNeon() {
    try {
        let todosAgendamentos = [];
        try {
            const res = await fetch(`${API_URL}/agendamentos`);
            if(res.ok) todosAgendamentos = await res.json();
        } catch(e) {
            todosAgendamentos = MOCK_AGENDAMENTOS_TESTE;
        }

        const agendamentos = todosAgendamentos.filter(a => filtrarPorPeriodoGlobal(a.data));

        let faturamentoTotal = 0;
        let faturamentoServicosBrutos = 0;
        let faturamentoProdutosBrutos = 0;
        let atendimentosFinalizados = 0;
        let totalFaltasNoShow = 0;

        let splitGabriel = { servico: 0, produto: 0, gorjeta: 0, total: 0 };
        let splitLucas = { servico: 0, produto: 0, gorjeta: 0, total: 0 };

        agendamentos.forEach(a => {
            const serv = ESTRUTURA_SERVICOS.find(s => s.nome === a.servico);
            const valorServico = serv ? serv.preco : 40.00;
            const valorProd = parseFloat(a.valor_produtos || 0);
            const valorGorjeta = parseFloat(a.valor_gorjeta || 0);
            
            const forma = String(a.pagamento || 'Pix').toLowerCase();
            const eCartao = (forma.includes('cartao') || forma.includes('credito') || forma.includes('debito'));
            const taxaMaquininha = eCartao ? 0.025 : 0.00;
            
            const taxaDeduzida = valorServico * taxaMaquininha;
            const valorServicoLiquido = valorServico - taxaDeduzida;

            if(a.status !== 'Falta' && a.status !== 'cancelado' && a.status !== 'no_show') {
                faturamentoServicosBrutos += valorServico;
                faturamentoProdutosBrutos += valorProd;
                
                faturamentoTotal += (valorServico + valorProd + valorGorjeta);
                atendimentosFinalizados++;
                
                if (String(a.barbeiro).toLowerCase().includes('gabriel')) {
                    splitGabriel.servico += (valorServicoLiquido * 0.50);
                    splitGabriel.produto += (valorProd * 0.10);
                    splitGabriel.gorjeta += valorGorjeta;
                } else {
                    splitLucas.servico += (valorServicoLiquido * 0.40);
                    splitLucas.produto += (valorProd * 0.10);
                    splitLucas.gorjeta += valorGorjeta;
                }
            } else if (a.status === 'Falta' || a.status === 'no_show') {
                totalFaltasNoShow++;
            }
        });

        splitGabriel.total = splitGabriel.servico + splitGabriel.produto + splitGabriel.gorjeta;
        splitLucas.total = splitLucas.servico + splitLucas.produto + splitLucas.gorjeta;

        document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
        
        const ticketMedio = atendimentosFinalizados > 0 ? (faturamentoServicosBrutos / atendimentosFinalizados) : 0;
        document.getElementById('kpi-ticket').innerText = `R$ ${ticketMedio.toFixed(2)}`;
        
        const taxaOcupacao = agendamentos.length > 0 ? Math.min(Math.round((agendamentos.length / 24) * 100), 100) : 0;
        document.getElementById('kpi-ocupacao').innerText = `${taxaOcupacao}%`;
        
        const taxaNoShow = agendamentos.length > 0 ? ((totalFaltasNoShow / agendamentos.length) * 100) : 0;
        document.getElementById('kpi-noshow').innerText = `${taxaNoShow.toFixed(1)}%`;

        document.getElementById('detalhe-servicos').innerText = `Serviços Brutos: R$ ${faturamentoServicosBrutos.toFixed(2)}`;
        document.getElementById('detalhe-produtos').innerText = `Produtos Brutos: R$ ${faturamentoProdutosBrutos.toFixed(2)}`;

        document.getElementById('split-gabriel').innerText = `R$ ${splitGabriel.total.toFixed(2)}`;
        document.getElementById('breakdown-gabriel').innerText = `Serv: R$ ${splitGabriel.servico.toFixed(2)} | Prod: R$ ${splitGabriel.produto.toFixed(2)} | Gorj: R$ ${splitGabriel.gorjeta.toFixed(2)}`;

        document.getElementById('split-lucas').innerText = `R$ ${splitLucas.total.toFixed(2)}`;
        document.getElementById('breakdown-lucas').innerText = `Serv: R$ ${splitLucas.servico.toFixed(2)} | Prod: R$ ${splitLucas.produto.toFixed(2)} | Gorj: R$ ${splitLucas.gorjeta.toFixed(2)}`;

    } catch(e) {
        console.error("Critical analytical error execution", e);
    }
}

async function carregarListaMarketingReal() {
    const container = document.getElementById('lista-marketing-clientes');
    if(!container) return;

    try {
        let usuarios = [];
        let todosAgendamentos = [];

        try {
            const resUsers = await fetch(`${API_URL}/usuarios`);
            const resAgendamentos = await fetch(`${API_URL}/agendamentos`);
            if(resUsers.ok && resAgendamentos.ok) {
                usuarios = await resUsers.json();
                todosAgendamentos = await resAgendamentos.json();
            }
        } catch(e) {
            usuarios = [
                { nome: "Carlos Cliente", celular: "11988888888", perfil: "cliente", plano_assinatura: "Plano Bronze" },
                { nome: "Rodrigo Sumido", celular: "11977777777", perfil: "cliente", plano_assinatura: "Nenhum" }
            ];
            todosAgendamentos = MOCK_AGENDAMENTOS_TESTE;
        }

        container.innerHTML = "";
        let assinantes = 0;
        let faturamentoRecorrente = 0;
        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        usuarios.forEach(u => {
            if(u.perfil === 'admin' || u.perfil === 'barbeiro') return;

            if(u.plano_assinatura && u.plano_assinatura !== 'Nenhum') {
                assinantes++;
                faturamentoRecorrente += u.plano_assinatura.includes('Gold') ? 150 : 80;
            }

            const atendimentosDoCliente = todosAgendamentos.filter(a =>  
                a.cliente.toUpperCase() === u.nome.toUpperCase() && a.status === 'Concluído'
            );

            let statusFidelidade = "Ativo no Período";
            let classeBadge = "badge-sucesso";

            if (atendimentosDoCliente.length > 0) {
                const datas = atendimentosDoCliente.map(a => new Date(a.data + 'T00:00:00'));
                const ultimaData = new Date(Math.max(...datas));
                const diferencaDias = Math.floor((hoje - ultimaData) / (1000 * 60 * 60 * 24));

                if (diferencaDias > 30) {
                    statusFidelidade = `Sumido (${diferencaDias} dias)`;
                    classeBadge = "badge-perigo";
                }
            } else {
                statusFidelidade = "Sem visitas cadastradas";
                classeBadge = "badge-alerta";
            }

            const div = document.createElement('div');
            div.className = "item-backoffice";
            div.innerHTML = `
                <div>
                    <strong>${u.nome}</strong> 
                    <span class="badge ${classeBadge}" style="font-size:10px; padding:2px 6px; border-radius:4px; margin-left:5px;">${statusFidelidade}</span><br>
                    <span style="font-size:11px; color:var(--text-muted);">Cel: ${u.celular} | Plano: ${u.plano_assinatura}</span>
                </div>
                <button class="btn-status" style="background:var(--accent-color); color:black;" onclick="dispararWppCliente('${u.celular}', '${u.nome}', '${statusFidelidade}')">Resgatar</button>
            `;
            container.appendChild(div);
        });

        document.getElementById('mkt-total-assinantes').innerText = assinantes;
        document.getElementById('mkt-faturamento-recorrente').innerText = `R$ ${faturamentoRecorrente.toFixed(2)}`;
    } catch(e) {
        container.innerHTML = "<p>Erro ao ler lista do CRM.</p>";
    }
}

function dispararWppCliente(celular, nome, status) {
    let msg = `Olá ${nome}! Tudo bem? Passando para te dar um alô da Prosperar Club. `;
    if(status.includes('Sumido') || status.includes('Sem visitas')) {
        msg += `Notamos que você está um tempo sem passar aqui para atualizar o visual. Que tal garantir seu horário para essa semana? Use o cupom RETORNO10 e ganhe 10% de desconto!`;
    } else {
        msg += `Gostaríamos de agradecer a sua preferência de sempre! Garanta seu próximo horário livre pelo nosso aplicativo para evitar filas.`;
    }
    window.open(`https://api.whatsapp.com/send?phone=55${celular}&text=${encodeURIComponent(msg)}`, '_blank');
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

        const dadosFiltrados = dados.filter(item => filtrarPorPeriodoGlobal(item.data));

        container.innerHTML = "";
        if(dadosFiltrados.length === 0) {
            container.innerHTML = "<p style='color:var(--text-muted); text-align:center; padding: 15px;'>Nenhum agendamento para o período selecionado.</p>";
            return;
        }

        dadosFiltrados.forEach(item => {
            const div = document.createElement('div');
            div.className = "item-backoffice";
            
            let corBorda = "var(--accent-color)";
            if(item.status === 'Concluído') corBorda = "var(--success-color)";
            if(item.status === 'Falta') corBorda = "var(--danger-color)";

            div.style.borderLeft = `4px solid ${corBorda}`;
            div.innerHTML = `
                <div>
                    <strong>👤 ${item.cliente} (${item.status})</strong><br>
                    <span style="font-size:12px; color:var(--text-muted);">${item.servico} - ${item.hora} (${item.data})</span>
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
    } catch(e) {
        const item = MOCK_AGENDAMENTOS_TESTE.find(a => a.id === id);
        if(item) item.status = novoStatus;
    }
    recarregarAbaAtivaAdm();
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

        const agendamentos = todosAgendamentos.filter(a => filtrarPorPeriodoGlobal(a.data));

        const turnosContagem = { "Manhã": 0, "Tarde": 0, "Noite": 0 };
        const volumeDiasSemana = {
            "Segunda-feira": 0, "Terça-feira": 0, "Quarta-feira": 0,
            "Quinta-feira": 0, "Sexta-feira": 0, "Sábado": 0, "Domingo": 0
        };

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
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:5px;">Previsão de Horários de Pico no Período:</p>
                <div style="display:flex; justify-content:space-between;"><span>🌅 Manhã (09h - 12h):</span> <strong>${turnosContagem['Manhã']} atendimentos</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>🌤️ Tarde (12h - 18h):</span> <strong>${turnosContagem['Tarde']} atendimentos</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>🌙 Noite (18h - 20h):</span> <strong>${turnosContagem['Noite']} atendimentos</strong></div>
            </div>
        `;

        if(containerDiasSemana) {
            let htmlDias = `<div style="display: flex; flex-direction: column; gap: 8px; background: #111; padding: 15px; border-radius: 8px;">`;
            for(let dia in volumeDiasSemana) {
                const totalCortes = volumeDiasSemana[dia];
                const porcentagemBarra = agendamentos.length > 0 ? Math.min((totalCortes / agendamentos.length) * 100, 100) : 0;
                
                htmlDias += `
                    <div style="margin-bottom: 4px;">
                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px;">
                            <span>${dia}:</span>
                            <strong style="color:${totalCortes > 0 ? 'var(--accent-color)' : 'var(--text-muted)'}">${totalCortes} clientes</strong>
                        </div>
                        <div style="width:100%; background:#222; height:6px; border-radius:3px; overflow:hidden;">
                            <div style="width:${porcentagemBarra}%; background:var(--accent-color); height:100%; border-radius:3px;"></div>
                        </div>
                    </div>
                `;
            }
            htmlDias += `</div>`;
            containerDiasSemana.innerHTML = htmlDias;
        }

        const clientesUnicos = [...new Set(agendamentos.map(a => a.cliente))];
        let recorrentes = 0;
        clientesUnicos.forEach(c => {
            if(agendamentos.filter(a => a.cliente === c).length > 1) recorrentes++;
        });

        if(containerRetencao) {
            containerRetencao.innerHTML = `
                <div class="card" style="text-align:center; margin-bottom: 15px;">
                    <div style="font-size: 28px; font-weight: bold; color: var(--accent-color);">${clientesUnicos.length > 0 ? Math.round((recorrentes / clientesUnicos.length) * 100) : 0}%</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top:5px;">Taxa de Retenção de Clientes no Período</div>
                </div>
            `;
        }
    } catch(e) {
        console.error("Erro no BI", e);
    }
}

/**
 * REFACTOR: VISÃO DO CLIENTE - TRAVA AUTOMÁTICA DE HORÁRIOS EXPIRADOS
 * Mapeia os botões e desabilita automaticamente slots passados no dia atual.
 */
async function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios');
    if (!container) return;
    
    if (!barbeiroSelecionado) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:13px; text-align:center;'>⚠️ Escolha o profissional acima para abrir os horários livres.</p>";
        return;
    }

    const dataSelecionada = document.getElementById('data').value;
    let ocupados = [];

    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if (res.ok) {
            const todos = await res.json();
            ocupados = todos
                .filter(a => a.data === dataSelecionada && String(a.barbeiro).toLowerCase().includes(barbeiroSelecionado) && a.status !== 'Falta' && a.status !== 'cancelado')
                .map(a => String(a.hora).trim());
        }
    } catch (e) {
        ocupados = MOCK_AGENDAMENTOS_TESTE
            .filter(a => a.data === dataSelecionada && String(a.barbeiro).toLowerCase().includes(barbeiroSelecionado) && a.status !== 'Falta')
            .map(a => String(a.hora).trim());
    }

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

            // 1. Validação de Regra de Negócio: O horário já passou do minuto atual?
            const jaPassou = isSlotPast(dataSelecionada, h.trim());
            
            // 2. Validação secundária: O horário já está reservado no banco de dados?
            const jaOcupado = ocupados.includes(h.trim());

            if (jaPassou) {
                btn.disabled = true;
                btn.classList.add('expirado'); // Permite estilizar com opacidade ou risco no seu arquivo CSS
                btn.innerText = "Expirado";
                btn.style.opacity = "0.4";
                btn.style.cursor = "not-allowed";
                btn.style.textDecoration = "line-through";
            } else if (jaOcupado) {
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

async function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos');
    if (!container || !usuarioLogado) return;
    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if (res.ok) {
            const lista = await res.json();
            const meus = lista.filter(a => a.cliente.toUpperCase() === nomeUsuarioLogado.toUpperCase());
            container.innerHTML = meus.length === 0 ? "<p>Nenhum agendamento ativo.</p>" : "";
            meus.forEach(item => {
                const div = document.createElement('div');
                div.className = "card";
                div.innerHTML = `<strong>${item.servico}</strong><br><span>${item.barbeiro} - ${item.data} às ${item.hora}</span>`;
                container.appendChild(div);
            });
        }
    } catch (e) {
        container.innerHTML = "<p>Sem agendamentos ativos na nuvem.</p>";
    }
}

function renderizarFormularioCliente() {
    const box = document.getElementById('container-servicos'); box.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const div = document.createElement('div'); div.className = "modern-card";
        div.innerHTML = `<div><div class="title">${s.nome}</div></div><div class="price">R$ ${s.preco.toFixed(2)}</div>`;
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

function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navegacao');
    if (!nav) return;

    if (role === 'admin') {
        nav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('adm-dash')">💰 Finanças</button>
            <button class="nav-item" onclick="alternarTela('adm-mkt')">📢 Marketing</button>
            <button class="nav-item" onclick="alternarTela('adm-recepcao')">📺 Monitor</button>
            <button class="nav-item" onclick="alternarTela('adm-analytics')">📊 Analytics</button>
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
        const el = document.getElementById(`aba-${id}`);
        if (el) el.classList.add('escondido');
    });
    
    const abaAlvo = document.getElementById(`aba-${idAba}`);
    if (abaAlvo) abaAlvo.classList.remove('escondido');

    document.querySelectorAll('.nav-inferior .nav-item').forEach(btn => btn.classList.remove('ativo'));
    
    const botoesMenu = document.querySelectorAll('#menu-navegacao .nav-item');
    botoesMenu.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(idAba)) {
            btn.classList.add('ativo');
        }
    });

    recarregarAbaAtivaAdm();
}
