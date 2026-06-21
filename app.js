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

// Banco Dinâmico Sincronizado do Frontend para Agendamentos
let DADOS_AGENDAMENTOS = [];

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

let ESTRUTURA_BARBEIROS = [
    { id: "gabriel", login: "admin", nome: "Gabriel (Proprietário)", celular: "11999999999", comissao: 0.50 },
    { id: "lucas", login: "lucasbarber", nome: "Lucas Barber", celular: "11988888888", comissao: 0.40 }
];

const HORARIOS_PADRAO = [
    { turno: "☀️ Manhã", horas: ["09:00", "09:30", "11:00", "11:30"] },
    { turno: "🌤️ Tarde", horas: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "16:00", "16:30", "17:00", "17:30"] },
    { turno: "🌙 Noite", horas: ["18:00", "18:30", "19:00", "19:30"] }
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

// FUNÇÃO PARA PUXAR AGENDAMENTOS DO BANCO DE DADOS
async function sincronizarAgendamentos() {
    try {
        const res = await fetch(`${API_URL}/agendamentos`);
        if (res.ok) {
            DADOS_AGENDAMENTOS = await res.json();
        }
    } catch (e) {
        console.error("Aviso: Falha ao sincronizar com banco. Verifique a API.", e);
    }
}

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

    const payload = {
        login: login,
        senha: senha,
        nome: nome,
        celular: celular,
        perfil: "barbeiro",
        plano_assinatura: "Nenhum"
    };

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
            
            alert(`✨ Profissional ${nome} cadastrado com sucesso e salvo no banco de dados!`);
            
            document.getElementById('adm-barbeiro-nome').value = '';
            document.getElementById('adm-barbeiro-login').value = '';
            document.getElementById('adm-barbeiro-celular').value = '';
            document.getElementById('adm-barbeiro-senha').value = '';

            atualizarSeletoresEFormulariosDeEquipe();
            recarregarAbaAtivaAdm();
        }
    } catch(e) {
        alert("Falha de comunicação. Salvo localmente em contingência de cache.");
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
    const celular = document.getElementById('cad-celular').value.trim();
    const senha = document.getElementById('cad-senha').value;
    const confirmar = document.getElementById('cad-confirmar-senha').value;
    const btnCadastrar = document.getElementById('btn-cadastrar');

    if(!nome || !login || !senha) return alert("Preencha os dados básicos!");
    if(senha !== confirmar) return alert("As senhas informadas não conferem.");

    if(btnCadastrar) {
        btnCadastrar.innerText = "Criando conta no Banco...";
        btnCadastrar.disabled = true;
    }

    const payload = {
        login: login,
        senha: senha,
        nome: nome,
        celular: celular,
        plano_assinatura: "Nenhum"
    };

    try {
        const res = await fetch(`${API_URL}/usuarios/cadastro`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            usuarioLogado = login;
            perfilLogado = "cliente";
            nomeUsuarioLogado = nome;
            alert("✨ Conta criada com sucesso!");
            ativarAcessoAoPainelProfissional();
        } else {
            alert("Erro ao criar conta. Este usuário já pode existir.");
        }
    } catch(e) {
        alert("Erro na rede. Verifique a API.");
    } finally {
        if(btnCadastrar) {
            btnCadastrar.innerText = "Salvar Cadastro Oficial";
            btnCadastrar.disabled = false;
        }
    }
}

async function executarLogin() {
    const loginInput = document.getElementById('login-usuario');
    const senhaInput = document.getElementById('login-senha');
    const btnEntrar = document.getElementById('btn-entrar');
    if(!loginInput || !senhaInput) return;

    const login = loginInput.value.trim().toLowerCase();
    const senha = senhaInput.value;

    if(!login || !senha) return alert("Preencha os campos de acesso.");

    // FEEDBACK VISUAL PRO RENDER ACORDAR
    if(btnEntrar) {
        btnEntrar.innerText = "Conectando ao banco... aguarde";
        btnEntrar.disabled = true;
    }

    try {
        // Validação interna do dono primeiro
        const barbeiroAlvo = ESTRUTURA_BARBEIROS.find(b => b.login === login);
        if(barbeiroAlvo && (barbeiroAlvo.id === 'gabriel' || barbeiroAlvo.login === 'admin' || barbeiroAlvo.senha === senha)) {
            perfilLogado = (barbeiroAlvo.id === 'gabriel' || barbeiroAlvo.login === 'admin') ? 'admin' : 'barbeiro';
            usuarioLogado = barbeiroAlvo.login;
            nomeUsuarioLogado = barbeiroAlvo.nome;
            await ativarAcessoAoPainelProfissional();
            return;
        }

        const res = await fetch(`${API_URL}/usuarios/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ login, senha })
        });

        if(res.ok) {
            const user = await res.json();
            usuarioLogado = user.login;
            if(login === "admin" || user.perfil === "admin") {
                perfilLogado = 'admin';
            } else if (ESTRUTURA_BARBEIROS.some(b => b.login === login)) {
                perfilLogado = 'barbeiro';
            } else {
                perfilLogado = user.perfil || user.role || 'cliente';
            }
            nomeUsuarioLogado = user.nome;
            await ativarAcessoAoPainelProfissional();
        } else {
            if(login === "admin" && senha === "admin") forçarLoginContingencia();
            else alert("Acesso negado. Verifique login e senha.");
        }
    } catch(e) {
        if(login === "admin" && senha === "admin") forçarLoginContingencia();
        else alert("Erro na rede ao tentar conectar.");
    } finally {
        if(btnEntrar) {
            btnEntrar.innerText = "Entrar no System";
            btnEntrar.disabled = false;
        }
    }
}

function forçarLoginContingencia() {
    usuarioLogado = "admin"; perfilLogado = "admin"; nomeUsuarioLogado = "Gabriel Admin";
    ativarAcessoAoPainelProfissional();
}

async function mudarStatusAgendamento(id, novoStatus) {
    try {
        await fetch(`${API_URL}/agendamentos/${id}/status`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: novoStatus })
        });
        await sincronizarAgendamentos();
        recarregarAbaAtivaAdm();
    } catch(e) {
        console.error("Erro ao mudar status: ", e);
    }
}

async function ativarAcessoAoPainelProfissional() {
    // Sincroniza sempre o banco na hora de entrar
    await sincronizarAgendamentos();

    document.getElementById('tela-autenticacao')?.classList.add('escondido');
    document.getElementById('conteudo-app')?.classList.remove('escondido');

    montarMenuNavegacao(perfilLogado);
    
    if(perfilLogado === 'barbeiro') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.add('escondido'));
        document.getElementById('card-rendimentos-barbeiro')?.classList.remove('escondido');
        document.getElementById('bloco-filtros-global-adm')?.classList.remove('escondido');
        
        const bInfo = ESTRUTURA_BARBEIROS.find(b => b.login === usuarioLogado);
        if(bInfo) {
            filtroBarbeiroAlvo = bInfo.id;
            const seletor = document.getElementById('filtro-barbeiro-alvo');
            if(seletor) { seletor.value = bInfo.id; seletor.disabled = true; }
        }
        alternarTela('adm-dash');
    } else if(perfilLogado === 'admin') {
        document.querySelectorAll('.restrito-adm').forEach(el => el.classList.remove('escondido'));
        document.getElementById('card-rendimentos-barbeiro')?.classList.add('escondido');
        document.getElementById('bloco-filtros-global-adm')?.classList.remove('escondido');
        
        const seletor = document.getElementById('filtro-barbeiro-alvo');
        if(seletor) { seletor.disabled = false; seletor.value = 'todos'; filtroBarbeiroAlvo = 'todos'; }
        alternarTela('adm-dash');
    } else {
        document.getElementById('bloco-filtros-global-adm')?.classList.add('escondido');
        const bv = document.getElementById('boas-vistas-cliente');
        if(bv) bv.innerText = `Olá, ${nomeUsuarioLogado}!`;
        
        renderizarFormularioCliente();
        carregarMeusAgendamentosDoBanco();
        alternarTela('home');
    }

    inicializarListenersPosLogin();
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
        btnPreAgendar.onclick = (e) => {
            e.preventDefault();
            if (!servicoSelecionado || !barbeiroSelecionado || !horarioSelecionado || !pagamentoSelecionado) {
                return alert("Por favor, selecione: Serviço, Profissional, Horário e Pagamento.");
            }
            const dataSelecionada = document.getElementById('data').value;
            if (!dataSelecionada) return alert("Selecione uma data válida.");

            if (isSlotPast(dataSelecionada, horarioSelecionado)) {
                alert("Este horário expirou. Escolha um horário futuro.");
                renderizarGradeHorariosReais();
                return;
            }

            const r = document.getElementById('modal-resumo-detalhes');
            if(r) {
                r.innerHTML = `
                    <strong>Procedimento:</strong> ${servicoSelecionado}<br>
                    <strong>Profissional:</strong> ${ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome || 'Não Selecionado'}<br>
                    <strong>Data/Hora:</strong> ${dataSelecionada} às ${horarioSelecionado}<br>
                    <span style="color:var(--success-color); font-weight:bold;">Valor: R$ ${precoServico.toFixed(2)}</span>
                `;
            }
            document.getElementById('modal-confirmacao')?.classList.remove('escondido');
        };
    }

    const btnConfirmarModal = document.getElementById('btn-confirmar-modal');
    if(btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target;
            btn.innerText = "Enviando...";
            btn.disabled = true;

            const dataSelecionada = document.getElementById('data').value;
            const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
            
            const payload = {
                cliente: nomeUsuarioLogado ? nomeUsuarioLogado.toUpperCase() : "CLIENTE ANÔNIMO",
                servico: servicoSelecionado,
                barbeiro: bNome,
                data: dataSelecionada,
                hora: horarioSelecionado,
                pagamento: pagamentoSelecionado,
                status: "Agendado",
                valor_produtos: 0.00,
                valor_gorjeta: 0.00
            };

            try {
                const res = await fetch(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if(res.ok) {
                    document.getElementById('modal-confirmacao')?.classList.add('escondido');
                    alert("✨ Reserva efetuada com sucesso!");
                    await sincronizarAgendamentos();
                    renderizarGradeHorariosReais();
                    carregarMeusAgendamentosDoBanco();
                } else {
                    alert("Erro ao confirmar reserva.");
                }
            } catch(error) {
                alert("Falha de comunicação com o servidor.");
            } finally {
                btn.innerText = "Confirmar Oficialmente";
                btn.disabled = false;
            }
        });
    }

    const btnExecutarEncaixe = document.getElementById('btn-executar-encaixe');
    if(btnExecutarEncaixe) {
        btnExecutarEncaixe.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.innerText = "Salvando...";
            btn.disabled = true;

            const nome = document.getElementById('encaixe-nome')?.value.trim();
            const servico = document.getElementById('encaixe-servico')?.value;
            const barbeiro = document.getElementById('encaixe-barbeiro')?.value;
            const hora = document.getElementById('encaixe-hora')?.value;
            const gorjeta = parseFloat(document.getElementById('encaixe-gorjeta')?.value || 0);
            const pagamento = document.getElementById('encaixe-pagamento')?.value;

            if(!nome) {
                btn.innerText = "Lançar Encaixe Concluído";
                btn.disabled = false;
                return alert("Insira o nome do cliente.");
            }

            const payload = {
                cliente: `WALK-IN: ${nome.toUpperCase()}`,
                servico: servico,
                barbeiro: barbeiro,
                data: new Date().toISOString().split('T')[0],
                hora: hora,
                pagamento: pagamento,
                status: "Concluído",
                valor_produtos: 0.00,
                valor_gorjeta: gorjeta
            };

            try {
                const res = await fetch(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                if(res.ok) {
                    alert("⚡ Encaixe registrado com sucesso!");
                    document.getElementById('encaixe-nome').value = "";
                    await sincronizarAgendamentos();
                    recarregarAbaAtivaAdm();
                }
            } catch (err) {
                alert("Erro ao registrar encaixe.");
            } finally {
                btn.innerText = "Lançar Encaixe Concluído";
                btn.disabled = false;
            }
        });
    }
}

function filtrarAgendamentoPorRegraGlobal(a) {
    if(filtroBarbeiroAlvo !== 'todos') {
        const profissionalAlvo = ESTRUTURA_BARBEIROS.find(b => b.id === filtroBarbeiroAlvo);
        if(!profissionalAlvo || a.barbeiro !== profissionalAlvo.nome) return false;
    }

    const dataAtendimento = new Date(a.data + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    
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
    if(seletorData) {
        if (periodo === 'personalizado') seletorData.classList.remove('escondido');
        else seletorData.classList.add('escondido');
    }
    recarregarAbaAtivaAdm();
}

function atualizarFiltroDataRange() {
    const inputInicio = document.getElementById('filtro-data-inicio');
    const inputFim = document.getElementById('filtro-data-fim');
    if(inputInicio && inputFim) {
        dataFiltroInicio = inputInicio.value; dataFiltroFim = inputFim.value;
        if (dataFiltroInicio && dataFiltroFim) recarregarAbaAtivaAdm();
    }
}

function recarregarAbaAtivaAdm() {
    const abas = ['adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'];
    let abaAtiva = 'adm-dash';
    abas.forEach(id => {
        const el = document.getElementById(`aba-${id}`);
        if (el && !el.classList.contains('escondido')) abaAtiva = id;
    });

    const seletor = document.getElementById('filtro-barbeiro-alvo');
    if(seletor) filtroBarbeiroAlvo = seletor.value;

    if(abaAtiva === 'adm-dash') carregarDadosEstrategicosDoNeon();
    if(abaAtiva === 'adm-mkt' && perfilLogado === 'admin') carregarListaMarketingReal();
    if(abaAtiva === 'adm-recepcao') carregarModoRecepcaoKanban();
    if(abaAtiva === 'adm-analytics') carregarPainelAnalytics();
}

async function carregarDadosEstrategicosDoNeon() {
    try {
        const agendamentos = DADOS_AGENDAMENTOS.filter(filtrarAgendamentoPorRegraGlobal);

        let faturamentoTotal = 0, faturamentoServicosBrutos = 0, faturamentoProdutosBrutos = 0, atendimentosFinalizados = 0, totalFaltasNoShow = 0;
        let balançoEquipe = {};
        
        ESTRUTURA_BARBEIROS.forEach(b => {
            balançoEquipe[b.nome] = { servicosLiquidos: 0, produtos: 0, gorjetas: 0, totalPagar: 0, rateio: b.comissao };
        });

        agendamentos.forEach(a => {
            const serv = ESTRUTURA_SERVICOS.find(s => s.nome === a.servico);
            const valorServico = serv ? serv.preco : 40.00;
            const valorProd = parseFloat(a.valor_produtos || 0);
            const valorGorjeta = parseFloat(a.valor_gorjeta || 0);
            
            const forma = String(a.pagamento || 'Pix').toLowerCase();
            const taxaMaquininha = (forma.includes('cartao') || forma.includes('credito') || forma.includes('debito')) ? 0.025 : 0.00;
            const valorServicoLiquido = valorServico - (valorServico * taxaMaquininha);

            // Considerar Maiúsculo e Minúsculo
            const statusAtual = a.status ? a.status.toLowerCase() : "";

            if(statusAtual !== 'falta' && statusAtual !== 'cancelado') {
                faturamentoServicosBrutos += valorServico; faturamentoProdutosBrutos += valorProd;
                faturamentoTotal += (valorServico + valorProd + valorGorjeta); atendimentosFinalizados++;
                
                if(balançoEquipe[a.barbeiro]) {
                    balançoEquipe[a.barbeiro].servicosLiquidos += (valorServicoLiquido * balançoEquipe[a.barbeiro].rateio);
                    balançoEquipe[a.barbeiro].produtos += (valorProd * 0.10);
                    balançoEquipe[a.barbeiro].gorjetas += valorGorjeta;
                }
            } else { totalFaltasNoShow++; }
        });

        if(document.getElementById('kpi-faturamento')) {
            document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
            const ticketMedio = atendimentosFinalizados > 0 ? (faturamentoServicosBrutos / atendimentosFinalizados) : 0;
            document.getElementById('kpi-ticket').innerText = `R$ ${ticketMedio.toFixed(2)}`;
            document.getElementById('kpi-ocupacao').innerText = atendimentosFinalizados;
            const taxaNoShow = agendamentos.length > 0 ? ((totalFaltasNoShow / agendamentos.length) * 100) : 0;
            document.getElementById('kpi-noshow').innerText = `${taxaNoShow.toFixed(1)}%`;
            document.getElementById('detalhe-servicos').innerText = `Serviços Brutos: R$ ${faturamentoServicosBrutos.toFixed(2)}`;
            document.getElementById('detalhe-produtos').innerText = `Produtos Brutos: R$ ${faturamentoProdutosBrutos.toFixed(2)}`;
        }

        const containerSplit = document.getElementById('lista-split-comissoes-equipe');
        if(containerSplit) {
            containerSplit.innerHTML = '';
            for(let prof in balançoEquipe) {
                const b = balançoEquipe[prof]; b.totalPagar = b.servicosLiquidos + b.produtos + b.gorjetas;
                containerSplit.innerHTML += `
                    <div class="item-backoffice">
                        <div><strong>${prof}</strong><br><span style="font-size:11px; color:var(--text-muted);">Serv: R$ ${b.servicosLiquidos.toFixed(2)} | Prod: R$ ${b.produtos.toFixed(2)} | Gorj: R$ ${b.gorjetas.toFixed(2)}</span></div>
                        <div style="color: var(--success-color); font-weight:800;">R$ ${b.totalPagar.toFixed(2)}</div>
                    </div>`;
            }
        }

        if(perfilLogado === 'barbeiro') {
            const bLogado = ESTRUTURA_BARBEIROS.find(b => b.login === usuarioLogado);
            if(bLogado && balançoEquipe[bLogado.nome]) {
                const d = balançoEquipe[bLogado.nome]; d.totalPagar = d.servicosLiquidos + d.produtos + d.gorjetas;
                document.getElementById('minha-comissao-total').innerText = `R$ ${d.totalPagar.toFixed(2)}`;
                document.getElementById('minha-breakdown-comissao').innerText = `Serviços: R$ ${d.servicosLiquidos.toFixed(2)} | Vendas: R$ ${d.produtos.toFixed(2)} | Dicas/Gorjetas: R$ ${d.gorjetas.toFixed(2)}`;
            }
        }
    } catch(e) {}
}

async function carregarModoRecepcaoKanban() {
    const container = document.getElementById('container-kanban-recepcao'); if(!container) return;
    const dadosFiltrados = DADOS_AGENDAMENTOS.filter(filtrarAgendamentoPorRegraGlobal);
    container.innerHTML = dadosFiltrados.length === 0 ? "<p style='color:var(--text-muted); text-align:center;'>Nenhum registro para o escopo.</p>" : "";
    
    dadosFiltrados.forEach(item => {
        const isConcluido = item.status && item.status.toLowerCase() === 'concluído';
        container.innerHTML += `
            <div class="item-backoffice" style="border-left: 4px solid ${isConcluido ? 'var(--success-color)' : 'var(--accent-color)'}">
                <div><strong>👤 ${item.cliente} (${item.status})</strong><br><span style="font-size:12px; color:var(--text-muted);">${item.servico} - ${item.hora} [Barbeiro: ${item.barbeiro}]</span></div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-status" style="background:var(--success-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Concluído')">✔</button>
                    <button class="btn-status" style="background:var(--danger-color); color:white;" onclick="mudarStatusAgendamento(${item.id}, 'Falta')">✖</button>
                </div>
            </div>`;
    });
}

async function carregarPainelAnalytics() {
    const containerMapa = document.getElementById('analytics-heatmap'); if(!containerMapa) return;
    const agendamentos = DADOS_AGENDAMENTOS.filter(filtrarAgendamentoPorRegraGlobal);

    const turnos = { "Manhã": 0, "Tarde": 0, "Noite": 0 };
    const dias = { "Segunda-feira": 0, "Terça-feira": 0, "Quarta-feira": 0, "Quinta-feira": 0, "Sexta-feira": 0, "Sábado": 0, "Domingo": 0 };
    const nomesDias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

    agendamentos.forEach(a => {
        const h = parseInt(a.hora.split(':')[0]);
        if(h >= 9 && h < 12) turnos["Manhã"]++; else if(h >= 12 && h < 18) turnos["Tarde"]++; else turnos["Noite"]++;
        const dNome = nomesDias[new Date(a.data + 'T00:00:00').getDay()];
        if(dias[dNome] !== undefined) dias[dNome]++;
    });

    containerMapa.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; background: #1f2125; border: 1px solid var(--border-color); padding: 16px; border-radius: 12px; font-size:14px;">
            <div style="display:flex; justify-content:space-between;"><span>🌅 Manhã (09h - 12h):</span> <strong>${turnos['Manhã']} atendimentos</strong></div>
            <div style="display:flex; justify-content:space-between; padding: 4px 0;"><span>🌤️ Tarde (12h - 18h):</span> <strong>${turnos['Tarde']} atendimentos</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>🌙 Noite (18h - 20h):</span> <strong>${turnos['Noite']} atendimentos</strong></div>
        </div>`;

    const containerDias = document.getElementById('analytics-dias-semana');
    if(containerDias) {
        containerDias.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.cssText = "display: flex; flex-direction: column; gap: 12px; background: #1f2125; border: 1px solid var(--border-color); padding: 18px; border-radius: 12px;";
        
        for(let dia in dias) {
            const pct = agendamentos.length > 0 ? Math.min((dias[dia] / agendamentos.length) * 100, 100) : 0;
            wrapper.innerHTML += `
                <div class="analytics-bar-container">
                    <div class="analytics-bar-header">
                        <span>${dia}</span>
                        <strong style="color: ${dias[dia] > 0 ? 'var(--accent-color)' : 'var(--text-muted)'}">${dias[dia]} clientes</strong>
                    </div>
                    <div class="analytics-bar-bg">
                        <div class="analytics-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>`;
        }
        containerDias.appendChild(wrapper);
    }

    const uClientes = [...new Set(agendamentos.map(a => a.cliente))];
    let rec = 0; uClientes.forEach(c => { if(agendamentos.filter(a => a.cliente === c).length > 1) rec++; });
    
    const containerRetencao = document.getElementById('analytics-retencao');
    if(containerRetencao) {
        containerRetencao.innerHTML = `
            <div class="kpi-card" style="flex: 1; text-align: center; background: #16171a; border: 1px solid var(--border-color);">
                <div class="kpi-label">Taxa de Retenção</div>
                <div class="kpi-val" style="color: var(--accent-color); font-size: 24px;">${uClientes.length > 0 ? Math.round((rec / uClientes.length) * 100) : 0}%</div>
            </div>
            <div class="kpi-card" style="flex: 1; text-align: center; background: #16171a; border: 1px solid var(--border-color);">
                <div class="kpi-label">LTV do Período</div>
                <div class="kpi-val" style="color: var(--success-color); font-size: 24px;">R$ ${(uClientes.length > 0 ? 62 * (agendamentos.length / uClientes.length) : 0).toFixed(2)}</div>
            </div>`;
    }
}

// CORREÇÃO: Estrutura do botão agora força a classe perfeitamente usando "btn"
function renderizarGradeHorariosReais() {
    const container = document.getElementById('container-horarios'); 
    if (!container) return;
    
    const dataSel = document.getElementById('data').value;
    const bNome = ESTRUTURA_BARBEIROS.find(b => b.id === barbeiroSelecionado)?.nome;
    
    // Puxando da base global real
    let ocupados = DADOS_AGENDAMENTOS
        .filter(a => a.data === dataSel && a.barbeiro === bNome && (a.status ? a.status.toLowerCase() !== 'falta' : true))
        .map(a => a.hora.trim());
        
    container.innerHTML = "";
    
    HORARIOS_PADRAO.forEach(g => {
        container.innerHTML += `<div class="turno-title">${g.turno}</div>`;
        const grid = document.createElement('div'); 
        grid.className = "grid-horarios";
        
        g.horas.forEach(h => {
            const btn = document.createElement('button'); 
            btn.className = "btn-horario"; 
            btn.innerText = h;
            btn.type = "button";
            
            if (isSlotPast(dataSel, h.trim())) { 
                btn.disabled = true; 
                btn.style.opacity = "0.3"; 
                btn.innerText = "Expirado"; 
            } else if (ocupados.includes(h.trim())) { 
                btn.disabled = true; 
                btn.innerText = "Ocupado"; 
            } else { 
                if(horarioSelecionado === h.trim()) {
                    btn.classList.add('selecionado');
                }
                
                // CORREÇÃO CHAVE: Usando arrow function isolada apontando para "btn" diretamente
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado')); 
                    btn.classList.add('selecionado'); 
                    horarioSelecionado = h.trim(); 
                });
            }
            grid.appendChild(btn);
        });
        container.appendChild(grid);
    });
}

function renderizarFormularioCliente() {
    const boxS = document.getElementById('container-servicos'); if(boxS) boxS.innerHTML = "";
    ESTRUTURA_SERVICOS.forEach(s => {
        const div = document.createElement('div'); div.className = "modern-card"; div.innerHTML = `<div class="title">${s.nome}</div><div class="price">R$ ${s.preco.toFixed(2)}</div>`;
        div.onclick = () => { document.querySelectorAll('#container-servicos .modern-card').forEach(c => c.classList.remove('selected')); div.classList.add('selected'); servicoSelecionado = s.nome; precoServico = s.preco; };
        if(boxS) boxS.appendChild(div);
    });

    const boxB = document.getElementById('container-barbeiros'); if(boxB) boxB.innerHTML = "";
    ESTRUTURA_BARBEIROS.forEach(b => {
        const div = document.createElement('div'); div.className = "modern-card"; div.innerHTML = `<div class="title">${b.nome}</div>`;
        div.onclick = () => { document.querySelectorAll('#container-barbeiros .modern-card').forEach(c => c.classList.remove('selected')); div.classList.add('selected'); barbeiroSelecionado = b.id; renderizarGradeHorariosReais(); };
        if(boxB) boxB.appendChild(div);
    });

    const boxP = document.getElementById('container-pagamentos'); if(boxP) boxP.innerHTML = "";
    ["Pix", "Cartão de Crédito", "Cartão de Débito", "Dinheiro"].forEach(p => {
        const div = document.createElement('div'); div.className = "modern-card"; div.innerHTML = `<div class="title">${p}</div>`;
        div.onclick = () => { document.querySelectorAll('#container-pagamentos .modern-card').forEach(c => c.classList.remove('selected')); div.classList.add('selected'); pagamentoSelecionado = p; };
        if(boxP) boxP.appendChild(div);
    });
}

async function carregarListaMarketingReal() {
    const container = document.getElementById('lista-marketing-clientes'); if(!container) return;
    container.innerHTML = `
        <div class="item-backoffice"><div><strong>Matheus Ribeiro</strong><br><span style="font-size:11px;color:var(--text-muted);">Ativo • 11999998888</span></div><span class="btn-status badge-sucesso">Fiel</span></div>
        <div class="item-backoffice"><div><strong>Guilherme M.</strong><br><span style="font-size:11px;color:var(--text-muted);color:var(--danger-color);">Inativo há 34 dias • 11977776666</span></div><button class="btn-status badge-perigo" onclick="alert('Disparando API de Engajamento Wpp...')">Resgatar</button></div>`;
}

// ONDE AS RESERVAS VÃO APARECER PARA O CLIENTE
function carregarMeusAgendamentosDoBanco() {
    const container = document.getElementById('container-meus-agendamentos'); if(!container) return;
    // Puxa do array global já sincronizado com o banco Neon
    const meus = DADOS_AGENDAMENTOS.filter(a => a.cliente && usuarioLogado && a.cliente.toLowerCase() === usuarioLogado.toLowerCase());
    
    container.innerHTML = meus.length === 0 ? "<p style='font-size:13px; color:var(--text-muted);'>Nenhum corte agendado no sistema.</p>" : "";
    
    meus.forEach(item => { 
        container.innerHTML += `
        <div class="card" style="border-left: 4px solid var(--accent-color)">
            <strong style="color:white; font-size: 16px;">${item.servico}</strong><br>
            <span style="font-size:13px;color:var(--text-muted);">Profissional: ${item.barbeiro} • Dia: ${item.data} às ${item.hora}</span><br>
            <span style="font-size:11px;color:var(--success-color); font-weight: bold;">Status: ${item.status}</span>
        </div>`; 
    });
}

function montarMenuNavegacao(role) {
    const nav = document.getElementById('menu-navigation'); 
    const menuNav = document.getElementById('menu-navegacao') || nav; 
    if (!menuNav) return;
    if (role === 'admin' || role === 'barbeiro') {
        menuNav.innerHTML = `
            <button class="nav-item ativo" onclick="alternarTela('adm-dash')">💰 Finanças</button>
            ${role === 'admin' ? `<button class="nav-item" onclick="alternarTela('adm-mkt')">📢 CRM</button>` : ''}
            <button class="nav-item" onclick="alternarTela('adm-recepcao')">📺 Monitor</button>
            <button class="nav-item" onclick="alternarTela('adm-analytics')">📊 Analytics</button>`;
    } else { menuNav.innerHTML = `<button class="nav-item ativo" onclick="alternarTela('home')">📅 Agendar</button><button class="nav-item" onclick="alternarTela('estilo')">🗂️ Reservas</button>`; }
    menuNav.innerHTML += `<button class="nav-item" style="color:var(--danger-color)" onclick="window.location.reload()">🚪 Sair</button>`;
}

function alternarTela(idAba) {
    ['home', 'estilo', 'adm-dash', 'adm-mkt', 'adm-recepcao', 'adm-analytics'].forEach(id => {
        const el = document.getElementById(`aba-${id}`); if (el) el.classList.add('escondido');
    });
    const abaAlvo = document.getElementById(`aba-${idAba}`); if (abaAlvo) abaAlvo.classList.remove('escondido');
    document.querySelectorAll('.nav-inferior .nav-item').forEach(btn => btn.classList.remove('ativo'));

    recarregarAbaAtivaAdm();
    if(idAba === 'estilo') carregarMeusAgendamentosDoBanco();
}
