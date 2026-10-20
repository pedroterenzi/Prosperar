/** Tipos compartilhados dos módulos autenticados (espelham o schema 0001/0006). */

export type AppRole = 'owner' | 'barber' | 'receptionist' | 'client';
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash' | 'online';
export type OrderItemKind = 'service' | 'product' | 'plan_credit';

/* --------------------------------- catálogo -------------------------------- */

export type Organization = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: { street?: string; city?: string } | null;
  timezone: string;
  logo_url: string | null;
  settings: {
    slot_interval_min?: number;
    cancellation_policy_hours?: number;
    noshow_fee_pct?: number;
    reminder_hours?: number[];
  };
};

export type Professional = {
  id: string;
  org_id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  pix_key: string | null;
  color: string | null;
  active: boolean;
  sort_order: number;
};

export type Service = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  cost: number;
  commission_pct: number;
  active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  cost: number;
  stock_qty: number | null;
  track_stock: boolean;
  show_in_store: boolean;
  active: boolean;
  sort_order: number;
};

export type AvailabilityRule = {
  id: string;
  org_id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
};

/* -------------------------------- agendamento ------------------------------ */

export type Appointment = {
  id: string;
  org_id: string;
  customer_id: string;
  professional_id: string;
  service_id: string;
  service_name: string;
  service_price: number;
  duration_min: number;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  source: string;
  customer?: { full_name: string; phone: string; notes: string | null } | null;
  professional?: { full_name: string; color: string | null } | null;
};

export type AppointmentNote = {
  id: number;
  type: string;
  payload: { text?: string; photos?: string[] };
  created_at: string;
};

/* ---------------------------------- comanda -------------------------------- */

export type OrderItem = {
  id: string;
  kind: OrderItemKind;
  ref_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  total: number;
};

export type Order = {
  id: string;
  status: 'open' | 'paying' | 'paid' | 'voided';
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  items: OrderItem[];
};

/* --------------------------------- dashboards ------------------------------ */

export type AdminSummary = {
  gross: number;
  fee: number;
  net: number;
  tips: number;
  commissions: number;
  commissions_pending: number;
  result: number;
  appointments: Record<string, number>;
  by_day: { day: string; gross: number; fee: number; net: number }[];
  by_service: { name: string; qty: number; amount: number }[];
  by_professional: {
    name: string;
    color: string | null;
    cuts: number;
    amount: number;
    commission: number;
    tips: number;
  }[];
  occupancy: { day: string; busy_min: number; chairs: number }[];
};

export type BarberSummary = {
  commission: number;
  tips: number;
  pending: number;
  sold: number;
  cuts: number;
  no_shows: number;
  by_weekday: { dow: number; qty: number; amount: number }[];
  daily: { day: string; commission: number; tips: number }[];
};

/* ----------------------------------- clientes ------------------------------ */

export type LostClient = {
  customer_id: string;
  full_name: string;
  phone: string;
  last_visit_at: string | null;
  days_away: number;
  visits_count: number;
  total_spent: number;
  last_service: string | null;
  preferred_professional: string | null;
};

export type LoyaltyStatus = {
  linked: boolean;
  target: number;
  progress: number;
  available: boolean;
  rewards: number;
  code: string | null;
  points: number;
  visits: number;
  total_spent: number;
  first_visit_at?: string | null;
};

export type Reservation = {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  status: 'reserved' | 'picked_up' | 'cancelled';
  note: string | null;
  created_at: string;
  product?: { name: string; image_url: string | null } | null;
};

export type ClientHistoryItem = {
  id: string;
  start_at: string;
  status: AppointmentStatus;
  service_name: string;
  service_id: string;
  service_price: number;
  professional: { full_name: string } | null;
  notes: AppointmentNote[];
};
