/** Linhas retornadas pelas RPCs públicas (banco: supabase/migrations). */

export type Org = {
  id: string;
  name: string;
  phone: string | null;
  timezone: string;
  logo_url: string | null;
};

/** Uma linha de get_public_catalog (serviço × profissional). */
export type CatalogRow = {
  service_id: string;
  service_name: string;
  duration_min: number;
  price: number;
  professional_id: string;
  professional_name: string;
  professional_color: string | null;
};

export type Professional = {
  id: string;
  name: string;
  color: string | null;
};

/** Serviço agregado com os profissionais que o atendem. */
export type Service = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  professionals: Professional[];
};

/** Horário livre com o profissional concreto que o oferece (mesmo com "Qualquer"). */
export type Slot = {
  start: string; // ISO timestamptz (retornado por get_available_slots)
  professional_id: string;
};

/** Linha de appointments lida diretamente (RLS: só o próprio cliente). */
export type MyAppointment = {
  id: string;
  start_at: string;
  status: string;
  service_name: string;
  pro_name: string | null;
};

export type BookingResult = {
  id: string; // appointment_id
  token: string; // reschedule_token (link de remarcar/cancelar no WhatsApp)
};
