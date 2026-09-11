// Hand-written types matching supabase/schema.sql.
// (If you prefer, regenerate with `supabase gen types typescript` once the project is live.)

export type Role = "admin" | "empleado";
export type TransactionType = "ingreso" | "egreso";
export type ServiceType = "perforacion" | "tatuaje" | "otro";
export type ClosureStatus = "abierto" | "cerrado";
export type MovementReason = "venta" | "compra" | "ajuste" | "perforacion" | "egreso_inicial";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  stock_quantity: number;
  min_stock: number;
  cost_price: number;
  sale_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  base_price: number;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  payment_method_id: string | null;
  category: string | null;
  description: string | null;
  client_id: string | null;
  service_id: string | null;
  transaction_date: string;
  created_by: string | null;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: MovementReason;
  reference_transaction_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DailyClosure {
  id: string;
  closure_date: string;
  opened_by: string | null;
  closed_by: string | null;
  total_ingresos: number;
  total_egresos: number;
  totals_by_payment_method: Record<string, number>;
  status: ClosureStatus;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface GoogleCalendarStatus {
  id: number;
  calendar_id: string;
  connected: boolean;
  updated_at: string;
}
