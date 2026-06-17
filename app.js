// 🔥 COLE AQUI O SEU LINK DO RENDER (DEIXE SEM A BARRA NO FINAL)
const API_URL = "https://prosperar.onrender.com"; 

// Simulação de usuário logado (depois faremos a tela de login se conectar aqui)
const CLIENTE_LOGADO = "pedro_teste"; 

let horarioSelecionado = null;

const campoBarbeiro = document.getElementById('barbeiro');
const campoData = document.getElementById('data');
const containerHorarios = document.getElementById('container-horarios');
const btnConfirmar = document.getElementById('btnConfirmar');
const msgStatus = document.getElementById('mensagem-status');

// Define a data de hoje como padrão no calendário
window.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date().toISOString().split('T')[0];
    campoData.value = hoje;
    buscarHorarios();
});

// Atualiza os horários se mudar o barbeiro ou a data
campoBarbeiro.addEventListener('change', buscarHorarios);
campoData.addEventListener('change', buscarHorarios);

// Busca horários livres na API do Render
async function buscarHorarios() {
    const barbeiro = campoBarbeiro.value;
    const data = campoData.value;
    horarioSelecionado = null;
    containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center;'>Buscando vagas...</p>";

    if (!data) return;

    try {
        const response = await fetch(`${API_URL}/api/agenda/disponibilidade?barbeiro=${encodeURIComponent(barbeiro)}&dia=${data}`);
        const dados = await response.json();

        containerHorarios.innerHTML = ""; // Limpa o "Buscando..."

        if (dados.horarios_disponiveis.length === 0) {
            containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Nenhum horário disponível para este dia.</p>";
            return;
        }

        dados.horarios_disponiveis.forEach(hora => {
            const botao = document.createElement('button');
            botao.className = 'btn-horario';
            botao.innerText = hora;
            botao.onclick = () => selecionarHorario(botao, hora);
            containerHorarios.appendChild(botao);
        });

    } catch (error) {
        containerHorarios.innerHTML = "<p style='grid-column: span 4; text-align:center; color: red;'>Erro ao carregar horários.</p>";
    }
}

function selecionarHorario(botao, hora) {
    // Remove seleção dos outros botões
    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
    // Seleciona o atual
    botao.classList.add('selecionado');
    horarioSelecionado = hora;
}

// Dispara o agendamento para o Render salvar no Neon
btnConfirmar.addEventListener('click', async () => {
    if (!horarioSelecionado) {
        alert("Por favor, selecione um horário antes de confirmar!");
        return;
    }

    const payload = {
        cliente_login: CLIENTE_LOGADO,
        barbeiro_nome: campoBarbeiro.value,
        data: campoData.value,
        horario: horarioSelecionado,
        servico: document.getElementById('servico').value,
        forma_pagamento: document.getElementById('pagamento').value
    };

    msgStatus.style.color = "orange";
    msgStatus.innerText = "Processando agendamento...";

    try {
        const response = await fetch(`${API_URL}/api/agenda/marcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json();

        if (response.ok) {
            msgStatus.style.color = "green";
            msgStatus.innerText = "✨ Agendamento feito com sucesso!";
            buscarHorarios(); // Atualiza a grade para sumir o horário que acabou de ser pego
        } else {
            msgStatus.style.color = "red";
            msgStatus.innerText = `Erro: ${resultado.detail}`;
        }
    } catch (error) {
        msgStatus.style.color = "red";
        msgStatus.innerText = "Erro ao conectar com o servidor.";
    }
});