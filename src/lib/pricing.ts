export type PricingInput = {
  filamentSpoolPrice: number;
  filamentSpoolGrams: number;
  filamentUsedGrams: number;
  packagingPurchasePrice: number;
  packagingUnits: number;
  packagingUsed: number;
  printHours: number;
  energyCostPerHour: number;
  laborMinutes: number;
  laborCostPerHour: number;
  otherCosts: number;
  setupCost: number;
  quantity: number;
  quantityDiscountPercent: number;
  failureRatePercent: number;
  marginPercent: number;
  vatPercent: number;
};

export type PricingBreakdown = {
  quantity: number; filamentCost: number; packagingCost: number; energyCost: number;
  laborCost: number; otherCosts: number; variableCostPerUnit: number; setupCost: number;
  directCost: number; failureReserve: number; totalCost: number; listNetPrice: number;
  netPrice: number; vatAmount: number; finalPrice: number; unitFinalPrice: number;
  profit: number; actualMarginPercent: number;
};

const safe = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const divide = (total: number, units: number) => safe(units) ? safe(total) / safe(units) : 0;

export function calculatePrice(input: PricingInput): PricingBreakdown {
  const quantity = Math.max(1, Math.floor(safe(input.quantity) || 1));
  const filamentCost = divide(input.filamentSpoolPrice, input.filamentSpoolGrams) * safe(input.filamentUsedGrams);
  const packagingCost = divide(input.packagingPurchasePrice, input.packagingUnits) * safe(input.packagingUsed);
  const energyCost = safe(input.printHours) * safe(input.energyCostPerHour);
  const laborCost = (safe(input.laborMinutes) / 60) * safe(input.laborCostPerHour);
  const otherCosts = safe(input.otherCosts);
  const variableCostPerUnit = filamentCost + packagingCost + energyCost + laborCost + otherCosts;
  const setupCost = safe(input.setupCost);
  const directCost = variableCostPerUnit * quantity + setupCost;
  const failureReserve = directCost * (Math.min(safe(input.failureRatePercent), 100) / 100);
  const totalCost = directCost + failureReserve;
  const targetMargin = Math.min(safe(input.marginPercent), 95) / 100;
  const listNetPrice = totalCost / (1 - targetMargin);
  const discount = Math.min(safe(input.quantityDiscountPercent), 95) / 100;
  const netPrice = listNetPrice * (1 - discount);
  const vatAmount = netPrice * (safe(input.vatPercent) / 100);
  const finalPrice = netPrice + vatAmount;
  const profit = netPrice - totalCost;
  const actualMarginPercent = netPrice > 0 ? profit / netPrice * 100 : 0;

  return { quantity, filamentCost, packagingCost, energyCost, laborCost, otherCosts, variableCostPerUnit, setupCost, directCost, failureReserve, totalCost, listNetPrice, netPrice, vatAmount, finalPrice, unitFinalPrice: finalPrice / quantity, profit, actualMarginPercent };
}
