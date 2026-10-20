/**
 * Teste de integração — SaaS V2 × Supabase
 * Valida, contra o projeto real (anon key apenas, como em produção):
 *   1. get_org_by_slug('demo')        → org carrega
 *   2. get_public_catalog(org)        → serviços + profissionais (RPC pública)
 *   3. get_available_slots(...)       → agenda calcula slots reais
 *   4. RLS nega leitura direta de services/appointments para anônimo
 *   5. book_appointment sem OTP       → recusa com 'auth_required' (segurança)
 *
 * Uso:  node scripts/integration-test.mjs   (lê .env.local automaticamente)
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---- env ------------------------------------------------------------------
let env = {};
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* segue com env do shell */ }

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY'); process.exit(1); }

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---- 1. org por slug ------------------------------------------------------
const orgRes = await supabase.rpc('get_org_by_slug', { p_slug: 'demo' });
const org = orgRes.error ? null : (orgRes.data ?? [])[0];
check('1. get_org_by_slug(demo)', !orgRes.error && !!org,
  org ? `${org.name} (id ${org.id})` : orgRes.error?.message ?? 'org não encontrada');
if (!org) process.exit(report());

// ---- 2. catálogo público --------------------------------------------------
const catRes = await supabase.rpc('get_public_catalog', { p_org: org.id });
const rows = catRes.data ?? [];
const services = [...new Set(rows.map((r) => r.service_name))];
check('2. get_public_catalog', !catRes.error && rows.length > 0,
  catRes.error ? catRes.error.message : `${services.length} serviços / ${rows.length} linhas: ${services.join(', ')}`);

// ---- 3. slots disponíveis -------------------------------------------------
// Usa o primeiro profissional do catálogo e a duração do 1º serviço.
let slots = null;
if (rows.length > 0) {
  const proId = rows[0].professional_id;
  const dur = rows[0].duration_min;
  const day = new Date(Date.now() + 2 * 864e5);
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const slotRes = await supabase.rpc('get_available_slots', {
    p_org: org.id, p_professional: proId, p_date: key, p_duration_min: dur,
  });
  slots = slotRes.data ?? [];
  check('3. get_available_slots', !slotRes.error && Array.isArray(slots),
    slotRes.error ? slotRes.error.message : `${slots.length} slots livres em ${key} (ex.: ${slots[0]?.slot_start ?? '—'})`);
}

// ---- 4. RLS bloqueia leitura direta para anônimo --------------------------
const svcDirect = await supabase.from('services').select('id').limit(1);
check('4a. RLS: SELECT direto em services negado p/ anônimo',
  svcDirect.error !== null || (svcDirect.data ?? []).length === 0,
  svcDirect.error ? svcDirect.error.code : `${(svcDirect.data ?? []).length} linhas visíveis`);

const apptDirect = await supabase.from('appointments').select('id').limit(1);
check('4b. RLS: SELECT direto em appointments negado p/ anônimo',
  apptDirect.error !== null || (apptDirect.data ?? []).length === 0,
  apptDirect.error ? apptDirect.error.code : `${(apptDirect.data ?? []).length} linhas visíveis`);

// ---- 5. book_appointment exige OTP ----------------------------------------
if (rows.length > 0 && slots?.length > 0) {
  const bookRes = await supabase.rpc('book_appointment', {
    p_org: org.id,
    p_service_id: rows[0].service_id,
    p_professional_id: rows[0].professional_id,
    p_start_at: slots[0].slot_start,
    p_phone: '+5511999990000',
    p_full_name: 'Teste Integração',
  });
  const blocked = bookRes.error && /auth_required/i.test(bookRes.error.message);
  check('5. book_appointment bloqueado sem OTP (esperado)', blocked,
    bookRes.error ? bookRes.error.message : 'ATENÇÃO: inseriu sem autenticação!');
} else {
  check('5. book_appointment bloqueado sem OTP (esperado)', false, 'sem slots para testar');
}

// ---- resumo ---------------------------------------------------------------
function report() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} testes passaram`);
  process.exit(passed === results.length ? 0 : 1);
}
report();
