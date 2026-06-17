const API_URL = "https://prosperar.onrender.com";

let usuarioLogado = null;
let perfilLogado = null;
let nomeUsuarioLogado = null;

let servicoSelecionado = null;
let barbeiroSelecionado = null;
let horarioSelecionado = null;
let pagamentoSelecionado = null;
let precoServico = 0;

// Filtros Globais de Data do Painel Administrativo
let filtroTempoGlobal = 'mes_atual'; // padrao: 'hoje', 'ontem', '7dias', 'mes_atual', 'personalizado'
let dataFiltroEspecifico = new Date().toISOString().split('T')[0]; // Usado para o Monitor Diário e Personalizados

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

// Inicialização segura ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    // Ligações dos botões da tela de autenticação (sempre visíveis inicialmente)
    const btnCadastrar = document.getElementById('btn-cadastrar');
    if(btnCadastrar) btnCadastrar.addEventListener('click', executarCadastro);

    const btnEntrar = document.getElementById('btn-entrar');
    if(btnEntrar) btnEntrar.addEventListener('click', executarLogin);
});

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

// Fluxo de Cadastro de Usuário
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

// Fluxo de Login
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
            inicializarListenersPosLogin(); // Ativa os listeners internos com segurança
        } else {
            alert("Acesso negado. Verifique os dados.");
        }
    } catch(e) {
        alert("Falha de conexão com o banco.");
    }
}

// Inicializa listeners das abas internas somente após autenticação garantida
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
            document.getElementById('modal-resumo-detalhes').innerHTML = `
                <strong>Procedimento:</strong> ${servicoSelecionado}<br>
                <strong>Profissional:</strong> ${barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber'}<br>
                <strong>Data/Hora:</strong> ${document.getElementById('data').value} às ${horarioSelecionado}<br>
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
            
            const payload = {
                cliente: nomeCliente,
                servico: servicoSelecionado || "Não Informado",
                barbeiro: barbeiroSelecionado === 'gabriel' ? 'Gabriel (Proprietário)' : 'Lucas Barber',
                data: document.getElementById('data').value,
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
            } catch (e) {}
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

            const dataAlvoEncaixe = (filtroTempoGlobal === 'personalizado') ? dataFiltroEspecifico : new Date().toISOString().split('T')[0];

            const payload = {
                cliente: `WALK-IN: ${nome.toUpperCase()}`,
                servico: servico,
                barbeiro: barbeiro,
                data: dataAlvoEncaixe,
                hora: hora,
                pagamento: "Balcão (Dinheiro)",
                status: "Concluído"
            };

            try {
                const res = await fetch(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                if(res.ok) {
                    alert("⚡ Encaixe manual registrado com sucesso!");
                    document.getElementById('encaixe-nome').value = "";
                    carregarModoRecepcaoKanban();
                }
            } catch(e) {
                alert("Falha ao registrar encaixe.");
            }
        });
    }
}

function direcionarFluxoInicial(perfil, nomeUsuario) {
    if(perfil === 'admin') {
        document.getElementById('bloco-filtros-global-adm').classList.remove('escondido');
        document.getElementById('filtro-data-especifica').value = dataFiltroEspecifico;
        alternarTela('adm-dash');
    } else if(perfil === 'barbeiro') {
        document.getElementById('bloco-filtros-global-adm').classList.remove('escondido');
        document.getElementById('filtro-data-especifica').value = dataFiltroEspecifico;
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
        const dataFiltro = new Date(dataFiltroEspecifico + 'T00:00:00');
        return dataAtendimento.getTime() === dataFiltro.getTime();
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

function atualizarFiltroDataEspecifica(valor) {
    dataFiltroEspecifico = valor;
    recarregarAbaAtivaAdm();
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
        const res = await fetch(`${API_URL}/agendamentos`);
        if(!res.ok) return;
        const todosAgendamentos = await res.json();

        const agendamentos = todosAgendamentos.filter(a => filtrarPorPeriodoGlobal(a.data));

        let faturamentoTotal = 0;
        let faturamentoServicos = 0;
        let faturamentoProdutos = 0;
        let finalizados = 0;
        let faltas = 0;
        let comissaoGabriel = 0;
        let comissaoLucas = 0;

        agendamentos.forEach(a => {
            const serv = ESTRUTURA_SERVICOS.find(s => s.nome === a.servico);
            const valorServico = serv ? serv.preco : 40.00;
            const valorProd = parseFloat(a.valor_produtos || 0);
            const valorGorjeta = parseFloat(a.valor_gorjeta || 0);
            
            const forma = String(a.pagamento || 'Pix').toLowerCase();
            const taxaMaquininha = (forma.includes('cartao') || forma.includes('credito') || forma.includes('debito')) ? 0.025 : 0;
            const taxaDeduzida = valorServico * taxaMaquininha;
            const valorServicoLiquido = valorServico - taxaDeduzida;

            if(a.status !== 'Falta' && a.status !== 'cancelado') {
                faturamentoServicos += valorServico;
                faturamentoProdutos += valorProd;
                faturamentoTotal += (valorServico + valorProd + valorGorjeta);
                finalizados++;
                
                if (String(a.barbeiro).toLowerCase().includes('gabriel')) {
                    comissaoGabriel += (valorServicoLiquido * 0.50) + (valorProd * 0.10) + valorGorjeta;
                } else {
                    comissaoLucas += (valorServicoLiquido * 0.40) + (valorProd * 0.10) + valorGorjeta;
                }
            } else if (a.status === 'Falta' || a.status === 'no_show') {
                faltas++;
            }
        });

        document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
        document.getElementById('kpi-ticket').innerText = `R$ ${finalizados > 0 ? (faturamentoServicos / finalizados).toFixed(2) : '0.00'}`;
        document.getElementById('kpi-ocupacao').innerText = `${agendamentos.length > 0 ? Math.min(Math.round((agendamentos.length / 24) * 100), 100) : 0}%`;
        document.getElementById('kpi-noshow').innerText = `${agendamentos.length > 0 ? ((faltas / agendamentos.length) * 100).toFixed(1) : 0}%`;

        document.getElementById('split-gabriel').innerText = `R$ ${comissaoGabriel.toFixed(2)}`;
        document.getElementById('split-lucas').innerText = `R$ ${comissaoLucas.toFixed(2)}`;

        if(document.getElementById('detalhe-produtos')) {
            document.getElementById('detalhe-produtos').innerText = `Produtos: R$ ${faturamentoProdutos.toFixed(2)}`;
            document.getElementById('detalhe-servicos').innerText = `Serviços: R$ ${faturamentoServicos.toFixed(2)}`;
        }
    } catch(e) {
        console.error("Erro no financeiro", e);
    }
}

async function carregarListaMarketingReal() {
    const container = document.getElementById('lista-marketing-clientes');
    if(!container) return;

    try {
        const resUsers = await fetch(`${API_URL}/usuarios`);
        const resAgendamentos = await fetch(`${API_URL}/agendamentos`);
        if(!resUsers.ok || !resAgendamentos.ok) return;
        
        const usuarios = await resUsers.json();
        const todosAgendamentos = await resAgendamentos.json();

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
        const res = await fetch(`${API_URL}/agendamentos`);
        if(!res.ok) return;
        const dados = await res.json();

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
        carregarModoRecepcaoKanban();
    } catch(e) {
        alert("Erro ao mudar status.");
    }
}

async function carregarPainelAnalytics() {
    const containerMapa = document.getElementById('analytics-heatmap');
    const containerRetencao = document.getElementById('analytics-retencao');
    const containerDiasSemana = document.getElementById('analytics-dias-semana');
    
    if(!containerMapa) return;

    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if(!res.ok) return;
        const todosAgendamentos = await res.json();

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
    } catch (e) {}
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
    
    // Alinha a classe ativa com o botão correspondente do menu de navegação injetado
    const botoesMenu = document.querySelectorAll('#menu-navegacao .nav-item');
    botoesMenu.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(idAba)) {
            btn.classList.add('ativo');
        }
    });

    recarregarAbaAtivaAdm();
}
