// Mock catalogue + pricing rules mirrored from staff-allowance (config.js / schema.sql).
// Swap `PRODUCTS` for the Supabase `products` table when porting; `imageUrl` maps to `image_url`.

export const DISCOUNT_RATE = 0.4;

export type GarmentKind = "tee" | "hoodie" | "jacket" | "pants" | "vest" | "shorts";

export type Product = {
  sku: string;
  name: string;
  category: string;
  kind: GarmentKind;
  color: string;
  trim: string;
  rsp: number;
  sizes: string[];
  imageUrl?: string;
};

const APPAREL = ["XS", "S", "M", "L", "XL"];
const WAIST = ["28", "30", "32", "34", "36"];

export const PRODUCTS: Product[] = [
  { sku: "FOM-TEE-001", name: "Core Logo Tee", category: "Tops", kind: "tee", color: "#f1efe9", trim: "#d9d5ca", rsp: 449, sizes: APPAREL },
  { sku: "FOM-JKT-014", name: "Trail Shell Jacket", category: "Outerwear", kind: "jacket", color: "#2f3b4c", trim: "#e2573b", rsp: 1899, sizes: APPAREL },
  { sku: "FOM-HDY-007", name: "Everyday Hoodie", category: "Tops", kind: "hoodie", color: "#8a8f86", trim: "#6f746b", rsp: 899, sizes: APPAREL },
  { sku: "FOM-PNT-022", name: "Trek Cargo Pant", category: "Bottoms", kind: "pants", color: "#4b5a3f", trim: "#38452f", rsp: 1199, sizes: WAIST },
  { sku: "FOM-VST-003", name: "Wind Vest", category: "Outerwear", kind: "vest", color: "#e8b923", trim: "#c99a0f", rsp: 1099, sizes: APPAREL },
  { sku: "FOM-TEE-009", name: "Sky Merino Tee", category: "Tops", kind: "tee", color: "#8fb3d9", trim: "#6f95bd", rsp: 749, sizes: APPAREL },
  { sku: "FOM-SHT-005", name: "Summit Short", category: "Bottoms", kind: "shorts", color: "#1f2937", trim: "#111827", rsp: 599, sizes: WAIST },
  { sku: "FOM-HDY-012", name: "Oat Zip Hoodie", category: "Tops", kind: "hoodie", color: "#d8c9ac", trim: "#bfae8e", rsp: 999, sizes: APPAREL },
  { sku: "FOM-JKT-020", name: "Storm Anorak", category: "Outerwear", kind: "jacket", color: "#c2412d", trim: "#1f2937", rsp: 2199, sizes: APPAREL },
  { sku: "FOM-PNT-030", name: "Dune Jogger", category: "Bottoms", kind: "pants", color: "#b79f7e", trim: "#9c8666", rsp: 849, sizes: WAIST },
];

export type OrderMode = "allowance" | "discount";

export type CartLine = { id: string; product: Product; size: string };

export const money = (n: number) =>
  "R" + Math.round(n).toLocaleString("en-ZA").replace(/ /g, " ");

export const staffPrice = (rsp: number) => rsp * (1 - DISCOUNT_RATE);

/** Prices the cart the same way the portal does: allowance deducts RSP, discount pays RSP less 40%,
 *  and an allowance order that exceeds the balance is split with the remainder paid in at full RSP. */
export function quote(lines: CartLine[], mode: OrderMode, balance: number) {
  const totalRsp = lines.reduce((s, l) => s + l.product.rsp, 0);
  if (mode === "discount") {
    return { totalRsp, fromAllowance: 0, payIn: totalRsp * (1 - DISCOUNT_RATE), balanceAfter: balance, isSplit: false };
  }
  const fromAllowance = Math.min(totalRsp, balance);
  const payIn = totalRsp - fromAllowance;
  return { totalRsp, fromAllowance, payIn, balanceAfter: balance - fromAllowance, isSplit: payIn > 0 && fromAllowance > 0 };
}
